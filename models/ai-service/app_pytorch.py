import torch
import torch.nn as nn
import torchvision.transforms as transforms
import cv2
import numpy as np
import base64
import mediapipe as mp
from flask import Flask, request, jsonify
from flask_cors import CORS
from scipy.spatial import distance as dist
import time
import logging
import torchvision.models as models

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# PyTorch Device
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"🚀 Using device: {device}")

class PyTorchProctor(nn.Module):
    def __init__(self):
        super(PyTorchProctor, self).__init__()
        
        # Face Detection Backbone (ResNet18)
        backbone = models.resnet18(pretrained=True)
        self.backbone = nn.Sequential(*list(backbone.children())[:-2])
        
        # Face Classification Head
        self.face_head = nn.Sequential(
            nn.AdaptiveAvgPool2d((1, 1)),
            nn.Flatten(),
            nn.Linear(512, 256),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(256, 1),
            nn.Sigmoid()
        )
        
        # Gaze Estimation Head
        self.gaze_head = nn.Sequential(
            nn.Flatten(),
            nn.Linear(512 * 7 * 7, 512),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(512, 128),
            nn.ReLU(),
            nn.Linear(128, 1),
            nn.Sigmoid()
        )
        
        # Object Detection Classes (phone, book, laptop)
        self.object_head = nn.Sequential(
            nn.AdaptiveAvgPool2d((1, 1)),
            nn.Flatten(),
            nn.Linear(512, 256),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(256, 10),  # 10 classes
            nn.Softmax(dim=1)
        )
        
        self.weights = {
            'no_face': 35, 'multiple_faces': 45, 'low_gaze': 30,
            'phone': 60, 'book': 40, 'head_tilt': 20, 'drowsy': 25
        }
    
    def forward_face(self, x):
        features = self.backbone(x)
        return self.face_head(features)
    
    def forward_gaze(self, x):
        features = self.backbone(x)
        return self.gaze_head(features)
    
    def forward_objects(self, x):
        features = self.backbone(x)
        return self.object_head(features)

# Initialize Model
model = PyTorchProctor().to(device)
model.eval()  # Inference mode

# Image Transforms
transform = transforms.Compose([
    transforms.ToPILImage(),
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

# MediaPipe
mp_face_detection = mp.solutions.face_detection
mp_face_mesh = mp.solutions.face_mesh
face_detection = mp_face_detection.FaceDetection(min_detection_confidence=0.5)
face_mesh = mp_face_mesh.FaceMesh(max_num_faces=2, refine_landmarks=True)

class ProctorAnalyzer:
    def __init__(self):
        self.model = model
        self.device = device
        self.transform = transform
        
    def preprocess_frame(self, frame):
        """PyTorch preprocessing"""
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        tensor = self.transform(rgb).unsqueeze(0).to(self.device)
        return tensor
    
    def pytorch_face_detection(self, frame):
        """PyTorch Face Detection"""
        tensor = self.preprocess_frame(frame)
        with torch.no_grad():
            face_prob = self.model.forward_face(tensor).cpu().numpy()[0][0]
        
        h, w = frame.shape[:2]
        if face_prob > 0.7:
            return [(w//4, h//4, w//2, h//2)]  # Center face ROI
        return []
    
    def pytorch_object_detection(self, frame):
        """PyTorch Multi-class Detection"""
        tensor = self.preprocess_frame(frame)
        with torch.no_grad():
            obj_probs = self.model.forward_objects(tensor).cpu().numpy()[0]
        
        classes = ['phone', 'book', 'laptop', 'person', 'remote', 'tv', 'calculator', 'notes', 'headphones', 'watch']
        detections = []
        
        for i, prob in enumerate(obj_probs):
            if prob > 0.6:
                detections.append({
                    'class': classes[i],
                    'confidence': float(prob)
                })
        return detections
    
    def pytorch_gaze_estimation(self, landmarks):
        """PyTorch Gaze from landmarks"""
        if len(landmarks) == 0:
            return 0.5
        
        # Extract eye regions
        eye_landmarks = landmarks[33:362]  # Eye area
        eye_features = torch.tensor(eye_landmarks.flatten(), dtype=torch.float32).unsqueeze(0).to(self.device)
        
        with torch.no_grad():
            gaze_conf = self.model.forward_gaze(eye_features).cpu().numpy()[0][0]
        
        return float(gaze_conf)
    
    def decode_frame(self, base64_frame):
        try:
            if ',' in base64_frame:
                _, data = base64_frame.split(',')
            else:
                data = base64_frame
            img_data = base64.b64decode(data)
            nparr = np.frombuffer(img_data, np.uint8)
            return cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        except:
            return None
    
    def mediapipe_faces(self, frame):
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = face_detection.process(rgb)
        faces = []
        if results.detections:
            for det in results.detections:
                bbox = det.location_data.relative_bounding_box
                h, w = frame.shape[:2]
                x, y, w_box, h_box = int(bbox.xmin*w), int(bbox.ymin*h), int(bbox.width*w), int(bbox.height*h)
                faces.append((x, y, w_box, h_box))
        return faces
    
    def mediapipe_landmarks(self, frame):
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = face_mesh.process(rgb)
        landmarks = []
        if results.multi_face_landmarks:
            h, w = frame.shape[:2]
            for face_landmarks in results.multi_face_landmarks:
                lm = [(int(p.x * w), int(p.y * h)) for p in face_landmarks.landmark]
                landmarks.append(np.array(lm))
        return landmarks
    
    def calculate_ear(self, landmarks):
        try:
            # Left eye indices
            LEFT_EYE = [33, 7, 163, 144, 145, 153]
            eye_pts = landmarks[LEFT_EYE]
            A = dist.euclidean(eye_pts[1], eye_pts[5])
            B = dist.euclidean(eye_pts[2], eye_pts[4])
            C = dist.euclidean(eye_pts[0], eye_pts[3])
            return (A + B) / (2.0 * C)
        except:
            return 0.3
    
    def analyze_frame(self, frame):
        start_time = time.time()
        
        analysis = {
            'timestamp': time.time(),
            'faces_pytorch': 0,
            'faces_mediapipe': 0,
            'gaze_confidence': 0.0,
            'objects': [],
            'drowsiness': False,
            'anomaly_score': 0,
            'suspicious': False,
            'violation_type': None,
            'processing_time_ms': 0,
            'device': str(device)
        }
        
        try:
            h, w = frame.shape[:2]
            
            # 1. DUAL FACE DETECTION
            pytorch_faces = self.pytorch_face_detection(frame)
            mediapipe_faces = self.mediapipe_faces(frame)
            
            total_faces = len(pytorch_faces) + len(mediapipe_faces)
            analysis['faces_pytorch'] = len(pytorch_faces)
            analysis['faces_mediapipe'] = len(mediapipe_faces)
            
            # Face scoring
            if total_faces == 0:
                analysis['violation_type'] = 'NO_FACE'
                analysis['anomaly_score'] += 35
            elif total_faces > 1:
                analysis['violation_type'] = 'MULTIPLE_FACES'
                analysis['anomaly_score'] += 45
            
            # 2. LANDMARKS + GAZE
            landmarks_list = self.mediapipe_landmarks(frame)
            if landmarks_list:
                landmarks = landmarks_list[0]
                gaze_conf = self.pytorch_gaze_estimation(landmarks)
                analysis['gaze_confidence'] = gaze_conf
                
                ear = self.calculate_ear(landmarks)
                analysis['drowsiness'] = ear < 0.22
                
                if gaze_conf < 0.65:
                    analysis['anomaly_score'] += 30
                if analysis['drowsiness']:
                    analysis['anomaly_score'] += 25
            
            # 3. OBJECT DETECTION
            objects = self.pytorch_object_detection(frame)
            analysis['objects'] = objects
            
            phone_detected = any('phone' in obj['class'].lower() for obj in objects)
            if phone_detected:
                analysis['violation_type'] = 'PHONE_DETECTED'
                analysis['anomaly_score'] += 60
            
            # 4. FINAL DECISION
            analysis['anomaly_score'] = min(100, analysis['anomaly_score'])
            analysis['suspicious'] = analysis['anomaly_score'] > 30
            
        except Exception as e:
            logger.error(f"PyTorch Error: {e}")
        
        analysis['processing_time_ms'] = round((time.time() - start_time) * 1000, 1)
        return analysis

# Global Analyzer
analyzer = ProctorAnalyzer()

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'pytorch': torch.__version__,
        'cuda_available': torch.cuda.is_available(),
        'device': str(device),
        'model_loaded': True
    })

@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        data = request.get_json()
        frame_b64 = data.get('frame', '')
        
        frame = analyzer.decode_frame(frame_b64)
        if frame is None:
            return jsonify({'error': 'Invalid frame'}), 400
        
        result = analyzer.analyze_frame(frame)
        logger.info(f"PyTorch Analysis: {result['faces_pytorch']}+{result['faces_mediapipe']} faces, score: {result['anomaly_score']}")
        
        return jsonify(result)
    except Exception as e:
        logger.error(f"Analysis error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("🎓 PyTorch ExamFlow AI Starting...")
    print(f"📱 GPU: {torch.cuda.is_available()}")
    app.run(host='0.0.0.0', port=5001, debug=True, threaded=True)