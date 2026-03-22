import os
from dotenv import load_dotenv

load_dotenv()

ML_PORT = int(os.getenv("ML_PORT", 6000))
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", 0.75))
YOLO_MODEL_PATH = os.getenv("YOLO_MODEL_PATH", "models/yolov8n.pt")
FACE_MODEL_PATH = os.getenv("FACE_MODEL_PATH", "models/facenet.h5")

# Gaze thresholds (degrees)
GAZE_YAW_THRESHOLD = 25      # horizontal head turn
GAZE_PITCH_THRESHOLD = 20    # vertical head tilt
EYE_ASPECT_RATIO_THRESHOLD = 0.20   # blink detection

# Object detection classes to flag (COCO class ids)
SUSPICIOUS_CLASSES = {
    67: "phone",
    73: "book",
    84: "book",
    76: "scissors",
}
