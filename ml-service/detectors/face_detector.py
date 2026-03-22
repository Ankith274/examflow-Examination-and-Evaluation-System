import mediapipe as mp
import cv2
import numpy as np
from typing import List, Dict, Any

mp_face_detection = mp.solutions.face_detection
mp_face_mesh = mp.solutions.face_mesh


class FaceDetector:
    """
    Detects faces in a frame using MediaPipe Face Detection.
    Returns face count and bounding boxes.
    """

    def __init__(self, min_detection_confidence: float = 0.6):
        self.detector = mp_face_detection.FaceDetection(
            model_selection=1,
            min_detection_confidence=min_detection_confidence
        )

    def detect(self, frame: np.ndarray) -> Dict[str, Any]:
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.detector.process(rgb)

        violations = []
        face_count = 0
        boxes = []

        if results.detections:
            face_count = len(results.detections)
            h, w = frame.shape[:2]

            for det in results.detections:
                box = det.location_data.relative_bounding_box
                boxes.append({
                    "x": box.xmin, "y": box.ymin,
                    "w": box.width, "h": box.height,
                    "confidence": det.score[0]
                })

        if face_count == 0:
            violations.append({
                "type": "no_face",
                "severity": "high",
                "confidence": 0.95,
                "metadata": {"face_count": 0}
            })
        elif face_count > 1:
            violations.append({
                "type": "multiple_face",
                "severity": "high",
                "confidence": min(b["confidence"] for b in boxes),
                "metadata": {"face_count": face_count}
            })

        return {
            "face_count": face_count,
            "boxes": boxes,
            "violations": violations
        }

    def close(self):
        self.detector.close()
