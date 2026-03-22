import cv2
import numpy as np
import mediapipe as mp
from ultralytics import YOLO

# 1. Initialization
print("Loading AI Models...")

# Initialize MediaPipe Face Detection
try:
    if hasattr(mp, 'solutions'):
        mp_face_detection = mp.solutions.face_detection
        face_detection = mp_face_detection.FaceDetection(
            model_selection=0, 
            min_detection_confidence=0.5
        )

        mp_face_mesh = mp.solutions.face_mesh
        face_mesh = mp_face_mesh.FaceMesh(
            max_num_faces=2, 
            refine_landmarks=True, 
            min_detection_confidence=0.5, 
            min_tracking_confidence=0.5
        )
        mp_drawing = mp.solutions.drawing_utils
        mp_drawing_styles = mp.solutions.drawing_styles
        USE_MEDIAPIPE = True
    else:
        raise AttributeError("mediapipe has no attribute 'solutions'")
except Exception as e:
    print(f"MediaPipe not fully supported on this Python version: {e}")
    USE_MEDIAPIPE = False
    
# Initialize YOLOv8 Nano for Object Detection (Books & Cell phones)
# It downloads yolov8n.pt automatically if it doesn't exist
try:
    model = YOLO("yolov8n.pt") 
except Exception as e:
    print(f"Error loading YOLO model: {e}")
    model = None


def process_frame(image):
    alerts = []
    
    # Convert the BGR image to RGB for MediaPipe
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    h, w, c = image.shape
    
    # -------------------------
    # A. Face Detection
    # -------------------------
    if USE_MEDIAPIPE:
        results_face = face_detection.process(image_rgb)
        num_faces = 0
        
        if results_face.detections:
            num_faces = len(results_face.detections)
            if num_faces > 1:
                alerts.append(f"Multiple faces detected ({num_faces})")
                
            for detection in results_face.detections:
                mp_drawing.draw_detection(image, detection)
        else:
             alerts.append("Face not detected")
             
        # -------------------------
        # B. Head Pose / Gaze tracking
        # -------------------------
        results_mesh = face_mesh.process(image_rgb)
        if results_mesh.multi_face_landmarks:
            for face_landmarks in results_mesh.multi_face_landmarks:
                # Landmarks: 33 = left eye corner, 263 = right eye corner, 1 = nose tip
                left_eye_x = face_landmarks.landmark[33].x * w
                right_eye_x = face_landmarks.landmark[263].x * w
                nose_x = face_landmarks.landmark[1].x * w
                
                # Calculate simple ratio
                eye_dist = right_eye_x - left_eye_x
                if eye_dist > 0:
                    ratio = (nose_x - left_eye_x) / eye_dist
                    # Typical forward ratio is around 0.5. Deviations imply turning head.
                    if ratio < 0.35:
                        alerts.append("Looking away from screen (Right)")
                    elif ratio > 0.65:
                        alerts.append("Looking away from screen (Left)")
                
                # Draw Face Mesh
                mp_drawing.draw_landmarks(
                    image=image,
                    landmark_list=face_landmarks,
                    connections=mp_face_mesh.FACEMESH_TESSELATION,
                    landmark_drawing_spec=None,
                    connection_drawing_spec=mp_drawing_styles.get_default_face_mesh_tesselation_style()
                )

    # -------------------------
    # C. Object Detection (Phones & Books)
    # -------------------------
    if model:
        # COCO classes: 67 = cell phone, 73 = book
        results_yolo = model.predict(image, classes=[67, 73], verbose=False)
        for r in results_yolo:
            for box in r.boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                
                if conf > 0.5:
                    label = model.names[cls_id]
                    if cls_id == 67:
                        alerts.append("Mobile phone detected in frame")
                    elif cls_id == 73:
                        alerts.append("Book detected in frame")
                    
                    # Draw bounding box for object
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    cv2.rectangle(image, (x1, y1), (x2, y2), (0, 0, 255), 2)
                    cv2.putText(image, f"{label} {conf:.2f}", (x1, y1-10), 
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
                
    # Remove duplicates from alerts list while preserving order
    unique_alerts = []
    for a in alerts:
        if a not in unique_alerts:
            unique_alerts.append(a)
            
    return unique_alerts, image
