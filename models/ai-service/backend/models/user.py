from pymongo import MongoClient
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import uuid

class UserModel:
    def __init__(self, db):
        self.collection = db['users']
    
    def create(self, name, email, password, role='student'):
        if self.collection.find_one({'email': email}):
            return False, "Email exists"
        
        user_id = str(uuid.uuid4())
        user = {
            '_id': user_id,
            'name': name,
            'email': email.lower(),
            'password': generate_password_hash(password),
            'role': role,
            'created_at': datetime.utcnow(),
            'last_login': None,
            'exams_taken': 0,
            'avg_proctor_score': 0.0,
            'is_active': True,
            'permissions': ['read', 'write'] if role == 'admin' else ['read']
        }
        
        result = self.collection.insert_one(user)
        return True, user_id
    
    def authenticate(self, email, password):
        user = self.collection.find_one({'email': email.lower(), 'is_active': True})
        if user and check_password_hash(user['password'], password):
            self.collection.update_one(
                {'_id': user['_id']},
                {'$set': {'last_login': datetime.utcnow()}}
            )
            user['_id'] = str(user['_id'])
            return True, user
        return False, None
    
    def get_by_id(self, user_id):
        user = self.collection.find_one({'_id': user_id})
        if user:
            user['_id'] = str(user['_id'])
        return user
    
    def update_proctor_score(self, user_id, score):
        user = self.get_by_id(user_id)
        if user:
            exams = user['exams_taken'] + 1
            self.collection.update_one(
                {'_id': user_id},
                {'$inc': {'exams_taken': 1},
                 '$set': {'avg_proctor_score': round((user['avg_proctor_score'] * (exams-1) + score) / exams, 2)}}
            )