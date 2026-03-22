from detectors.face_detector import FaceDetector
from detectors.gaze_tracker import GazeTracker
from detectors.object_detector import ObjectDetector
from utils.image_utils import base64_to_frame, resize_frame
from typing import Dict, Any, List
import traceback


class VideoPipeline:
    """
    Orchestrates all frame-level ML detectors in sequence.
    Returns a unified list of violations for a single frame.
    """

    def __init__(self):
        print("[Pipeline] Initializing detectors...")
        self.face_detector  = FaceDetector()
        self.gaze_tracker   = GazeTracker()
        self.object_detector = ObjectDetector()
        print("[Pipeline] All detectors ready.")

    def analyze(self, base64_frame: str, session_id: str) -> Dict[str, Any]:
        """
        Run all detectors on a single frame.
        Returns:
            {
                "session_id": str,
                "violations": [ { type, severity, confidence, metadata } ],
                "metrics": { face_count, gaze: {...}, objects: [...] }
            }
        """
        violations: List[Dict] = []
        metrics: Dict[str, Any] = {}

        try:
            frame = base64_to_frame(base64_frame)
            frame = resize_frame(frame, max_width=640)
        except Exception as e:
            return {"session_id": session_id, "violations": [], "metrics": {}, "error": str(e)}

        # ── 1. Face detection ──────────────────────────────────────
        try:
            face_result = self.face_detector.detect(frame)
            violations.extend(face_result["violations"])
            metrics["face_count"] = face_result["face_count"]
            metrics["face_boxes"] = face_result["boxes"]
        except Exception:
            traceback.print_exc()

        # ── 2. Gaze / head-pose (only if exactly one face present) ──
        if metrics.get("face_count") == 1:
            try:
                gaze_result = self.gaze_tracker.analyze(frame)
                violations.extend(gaze_result["violations"])
                metrics["gaze"] = gaze_result["metrics"]
            except Exception:
                traceback.print_exc()

        # ── 3. Object detection ────────────────────────────────────
        try:
            obj_result = self.object_detector.detect(frame)
            violations.extend(obj_result["violations"])
            metrics["objects"] = obj_result["detections"]
        except Exception:
            traceback.print_exc()

        # De-duplicate: if same violation type appears more than once keep highest confidence
        seen: Dict[str, Dict] = {}
        for v in violations:
            t = v["type"]
            if t not in seen or v["confidence"] > seen[t]["confidence"]:
                seen[t] = v
        violations = list(seen.values())

        return {
            "session_id": session_id,
            "violations": violations,
            "metrics": metrics
        }

    def close(self):
        self.face_detector.close()
        self.gaze_tracker.close()
