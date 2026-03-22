from pymongo import MongoClient
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
from datetime import datetime, timedelta
from flask import current_app
import uuid

class User:
    def __init__(self):
        self.client = MongoClient('mongodb://localhost:27017/')
        self.db = self.client['examflow']
        self.collection = self.db['users']
    
    def create_user(self, name, email, password, role='student'):
        """Create new user"""
        try:
            # Check if user exists
            if self.collection.find_one({'email': email}):
                return {'success': False, 'error': 'Email already exists'}
            
            user_data = {
                '_id': str(uuid.uuid4()),
                'name': name,
                'email': email,
                'password': generate_password_hash(password),
                'role': role,
                'created_at': datetime.utcnow(),
                'active': True,
                'exams_taken': 0,
                'proctor_score_avg': 0.0
            }
            
            result = self.collection.insert_one(user_data)
            return {'success': True, 'user_id': str(result.inserted_id)}
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def authenticate(self, email, password):
        """Authenticate user"""
        try:
            user = self.collection.find_one({'email': email, 'active': True})
            if user and check_password_hash(user['password'], password):
                # Generate JWT
                token = jwt.encode({
                    'user_id': user['_id'],
                    'email': user['email'],
                    'role': user['role'],
                    'exp': datetime.utcnow() + timedelta(hours=24)
                }, current_app.config['SECRET_KEY'], algorithm='HS256')
                
                return {
                    'success': True,
                    'token': token,
                    'user': {
                        'id': user['_id'],
                        'name': user['name'],
                        'email': user['email'],
                        'role': user['role']
                    }
                }
            return {'success': False, 'error': 'Invalid credentials'}
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def get_user_by_id(self, user_id):
        """Get user by ID"""
        try:
            user = self.collection.find_one({'_id': user_id})
            if user:
                user['_id'] = str(user['_id'])
            return user
        except Exception as e:
            return None
    
    def update_proctor_score(self, user_id, score):
        """Update average proctoring score"""
        try:
            user = self.collection.find_one({'_id': user_id})
            if user:
                exams = user.get('exams_taken', 0) + 1
                total_score = user.get('proctor_score_total', 0) + score
                avg_score = total_score / exams
                
                self.collection.update_one(
                    {'_id': user_id},
                    {'$set': {
                        'exams_taken': exams,
                        'proctor_score_avg': round(avg_score, 2),
                        'proctor_score_total': total_score,
                        'last_exam': datetime.utcnow()
                    }}
                )
                return True
            return False
        except Exception as e:
            return False
    
    def get_students_by_exam(self, exam_id):
        """Get students for specific exam"""
        try:
            pipeline = [
                {'$match': {'role': 'student', 'active': True}},
                {'$lookup': {
                    'from': 'exam_sessions',
                    'let': {'user_id': {'$toObjectId': '$_id'}},
                    'pipeline': [{'$match': {'$expr': {'$eq': ['$student_id', '$$user_id']}}}],
                    'as': 'sessions'
                }},
                {'$match': {'sessions.exam_id': exam_id}}
            ]
            students = list(self.collection.aggregate(pipeline))
            for student in students:
                student['_id'] = str(student['_id'])
            return students
        except Exception as e:
            return []

# Global instance
user_model = User()