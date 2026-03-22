from datetime import datetime
from bson import ObjectId

class ViolationModel:
    def __init__(self, db):
        self.collection = db['violations']
    
    def log_violation(self, session_id, violation_type, score, details):
        """Log violation event"""
        violation = {
            '_id': str(ObjectId()),
            'session_id': session_id,
            'timestamp': datetime.utcnow(),
            'type': violation_type,  # NO_FACE, PHONE, MULTIPLE_FACES
            'severity': 'low' if score < 40 else 'medium' if score < 70 else 'high',
            'anomaly_score': score,
            'details': details,  # screenshot_b64, confidence
            'teacher_notified': False,
            'action_taken': None  # warning, terminated
        }
        self.collection.insert_one(violation)
        return str(violation['_id'])
    
    def get_violations_by_session(self, session_id, limit=50):
        """Get violations for session"""
        pipeline = [
            {'$match': {'session_id': session_id}},
            {'$sort': {'timestamp': -1}},
            {'$limit': limit},
            {'$lookup': {
                'from': 'sessions',
                'localField': 'session_id',
                'foreignField': '_id',
                'as': 'session'
            }}
        ]
        return list(self.collection.aggregate(pipeline))
    
    def get_exam_violations(self, exam_id):
        """Dashboard violations summary"""
        pipeline = [
            {'$match': {'session.exam_id': exam_id}},
            {'$group': {
                '_id': '$type',
                'count': {'$sum': 1},
                'avg_score': {'$avg': '$anomaly_score'}
            }},
            {'$sort': {'count': -1}}
        ]
        return list(self.collection.aggregate(pipeline))