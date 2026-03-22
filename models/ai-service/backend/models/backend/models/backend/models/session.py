from datetime import datetime
import uuid

class SessionModel:
    def __init__(self, db):
        self.collection = db['sessions']
    
    def create_session(self, exam_id, student_id):
        """Create exam session"""
        session_id = str(uuid.uuid4())
        session = {
            '_id': session_id,
            'exam_id': exam_id,
            'student_id': student_id,
            'start_time': datetime.utcnow(),
            'end_time': None,
            'status': 'active',  # active, completed, terminated
            'final_score': None,
            'proctor_score': 0.0,
            'frames_analyzed': 0,
            'avg_frame_time': 0.0
        }
        self.collection.insert_one(session)
        return session_id
    
    def update_frame_analysis(self, session_id, analysis_time):
        """Update frame analysis stats"""
        self.collection.update_one(
            {'_id': session_id},
            {'$inc': {'frames_analyzed': 1},
             '$push': {'frame_times': analysis_time}}
        )
    
    def complete_session(self, session_id, score, proctor_score):
        """Mark session complete"""
        self.collection.update_one(
            {'_id': session_id},
            {'$set': {
                'end_time': datetime.utcnow(),
                'status': 'completed',
                'final_score': score,
                'proctor_score': proctor_score
            }}
        )
    
    def get_live_sessions(self, exam_id):
        """Get active sessions for exam"""
        pipeline = [
            {'$match': {'exam_id': exam_id, 'status': 'active'}},
            {'$lookup': {
                'from': 'users',
                'localField': 'student_id',
                'foreignField': '_id',
                'as': 'student'
            }},
            {'$project': {
                'student': {'$arrayElemAt': ['$student', 0]},
                'start_time': 1,
                'frames_analyzed': 1
            }}
        ]
        return list(self.collection.aggregate(pipeline))