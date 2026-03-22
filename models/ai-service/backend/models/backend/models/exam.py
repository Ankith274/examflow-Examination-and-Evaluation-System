from datetime import datetime
from bson import ObjectId

class ExamModel:
    def __init__(self, db):
        self.collection = db['exams']
    
    def create(self, title, teacher_id, duration, questions):
        """Create new exam"""
        exam = {
            '_id': str(ObjectId()),
            'title': title,
            'teacher_id': teacher_id,
            'duration': duration,  # minutes
            'questions': questions,  # [{"text": "", "options": [], "answer": 0}]
            'created_at': datetime.utcnow(),
            'status': 'draft',  # draft, active, closed
            'students_enrolled': [],
            'max_students': 100,
            'proctoring_enabled': True
        }
        result = self.collection.insert_one(exam)
        return str(result.inserted_id)
    
    def get_by_id(self, exam_id):
        exam = self.collection.find_one({'_id': exam_id})
        if exam:
            exam['_id'] = str(exam['_id'])
            return exam
        return None
    
    def get_active_by_teacher(self, teacher_id):
        """Get teacher's active exams"""
        pipeline = [
            {'$match': {'teacher_id': teacher_id, 'status': 'active'}},
            {'$project': {'title': 1, 'duration': 1, 'students_enrolled': 1}}
        ]
        return list(self.collection.aggregate(pipeline))
    
    def enroll_student(self, exam_id, student_id):
        """Enroll student in exam"""
        return self.collection.update_one(
            {'_id': exam_id, 'students_enrolled': {'$ne': student_id}},
            {'$push': {'students_enrolled': student_id}}
        )