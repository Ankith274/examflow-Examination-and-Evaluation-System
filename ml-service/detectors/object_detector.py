import numpy as np
import cv2
from typing import Dict, Any, List
from config import YOLO_MODEL_PATH, CONFIDENCE_THRESHOLD, SUSPICIOUS_CLASSES

try:
    from ultralytics import YOLO
    _yolo_available = True
except ImportError:
    _yolo_available = False


class ObjectDetector:
    """
    Detects suspicious objects (phones, books, earphones) using YOLOv8.
    Falls back gracefully if model file is missing.
    """

    def __init__(self):
        self.model = None
        if _yolo_available:
            try:
                self.model = YOLO(YOLO_MODEL_PATH)
                print(f"[ObjectDetector] YOLOv8 loaded from {YOLO_MODEL_PATH}")
            except Exception as e:
                print(f"[ObjectDetector] Model load failed: {e}. Running without object detection.")

    def detect(self, frame: np.ndarray) -> Dict[str, Any]:
        violations: List[Dict] = []
        detections: List[Dict] = []

        if self.model is None:
            return {"violations": violations, "detections": detections}

        results = self.model(frame, verbose=False)[0]

        for box in results.boxes:
            cls_id = int(box.cls[0])
            conf = float(box.conf[0])

            if conf < CONFIDENCE_THRESHOLD:
                continue

            cls_name = results.names.get(cls_id, "")

            # Check against suspicious class list
            label = SUSPICIOUS_CLASSES.get(cls_id) or (
                "phone" if "phone" in cls_name or "cell" in cls_name else
                "book"  if "book"  in cls_name else
                None
            )

            if label:
                xyxy = box.xyxy[0].tolist()
                detections.append({
                    "label": label,
                    "confidence": round(conf, 3),
                    "bbox": [round(v) for v in xyxy]
                })
                violations.append({
                    "type": label,          # e.g. "phone" / "book"
                    "severity": "high" if label == "phone" else "medium",
                    "confidence": round(conf, 3),
                    "metadata": {"class": cls_name, "bbox": xyxy}
                })

        return {"violations": violations, "detections": detections}
