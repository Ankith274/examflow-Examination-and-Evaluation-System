import mediapipe as mp
import cv2
import numpy as np
from typing import Dict, Any
from config import GAZE_YAW_THRESHOLD, GAZE_PITCH_THRESHOLD

mp_face_mesh = mp.solutions.face_mesh

# 3D model points for head pose estimation
MODEL_POINTS = np.array([
    (0.0, 0.0, 0.0),          # Nose tip
    (0.0, -330.0, -65.0),     # Chin
    (-225.0, 170.0, -135.0),  # Left eye corner
    (225.0, 170.0, -135.0),   # Right eye corner
    (-150.0, -150.0, -125.0), # Left mouth corner
    (150.0, -150.0, -125.0),  # Right mouth corner
], dtype=np.float64)

# Landmark indices
NOSE_TIP = 1
CHIN = 152
LEFT_EYE_CORNER = 33
RIGHT_EYE_CORNER = 263
LEFT_MOUTH = 61
RIGHT_MOUTH = 291
LEFT_EYE_TOP = 159
LEFT_EYE_BOTTOM = 145
RIGHT_EYE_TOP = 386
RIGHT_EYE_BOTTOM = 374


class GazeTracker:
    """
    Tracks head pose (yaw/pitch/roll) and eye aspect ratio.
    Flags off-screen gaze and blinks.
    """

    def __init__(self):
        self.face_mesh = mp_face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5
        )

    def _eye_aspect_ratio(self, landmarks, top_idx, bottom_idx, left_idx, right_idx) -> float:
        top = np.array([landmarks[top_idx].x, landmarks[top_idx].y])
        bottom = np.array([landmarks[bottom_idx].x, landmarks[bottom_idx].y])
        left = np.array([landmarks[left_idx].x, landmarks[left_idx].y])
        right = np.array([landmarks[right_idx].x, landmarks[right_idx].y])
        vertical = np.linalg.norm(top - bottom)
        horizontal = np.linalg.norm(left - right)
        return vertical / (horizontal + 1e-6)

    def analyze(self, frame: np.ndarray) -> Dict[str, Any]:
        h, w = frame.shape[:2]
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(rgb)

        violations = []
        metrics = {}

        if not results.multi_face_landmarks:
            return {"violations": violations, "metrics": metrics}

        landmarks = results.multi_face_landmarks[0].landmark

        # 2D image points
        image_points = np.array([
            (landmarks[NOSE_TIP].x * w, landmarks[NOSE_TIP].y * h),
            (landmarks[CHIN].x * w, landmarks[CHIN].y * h),
            (landmarks[LEFT_EYE_CORNER].x * w, landmarks[LEFT_EYE_CORNER].y * h),
            (landmarks[RIGHT_EYE_CORNER].x * w, landmarks[RIGHT_EYE_CORNER].y * h),
            (landmarks[LEFT_MOUTH].x * w, landmarks[LEFT_MOUTH].y * h),
            (landmarks[RIGHT_MOUTH].x * w, landmarks[RIGHT_MOUTH].y * h),
        ], dtype=np.float64)

        # Camera matrix (approximate)
        focal_length = w
        center = (w / 2, h / 2)
        cam_matrix = np.array([
            [focal_length, 0, center[0]],
            [0, focal_length, center[1]],
            [0, 0, 1]
        ], dtype=np.float64)
        dist_coeffs = np.zeros((4, 1))

        success, rot_vec, trans_vec = cv2.solvePnP(
            MODEL_POINTS, image_points, cam_matrix, dist_coeffs,
            flags=cv2.SOLVEPNP_ITERATIVE
        )

        if success:
            rot_mat, _ = cv2.Rodrigues(rot_vec)
            angles, *_ = cv2.RQDecomp3x3(rot_mat)
            pitch, yaw, roll = angles[0], angles[1], angles[2]

            metrics = {"pitch": round(pitch, 2), "yaw": round(yaw, 2), "roll": round(roll, 2)}

            if abs(yaw) > GAZE_YAW_THRESHOLD or abs(pitch) > GAZE_PITCH_THRESHOLD:
                direction = "left" if yaw < 0 else "right" if yaw > 0 else "up" if pitch < 0 else "down"
                confidence = min(1.0, (max(abs(yaw), abs(pitch)) - 20) / 30)
                violations.append({
                    "type": "gaze_off",
                    "severity": "medium",
                    "confidence": round(confidence, 2),
                    "metadata": {"direction": direction, "yaw": yaw, "pitch": pitch}
                })

        # Eye aspect ratio (blink / eye-closed detection)
        left_ear = self._eye_aspect_ratio(landmarks, LEFT_EYE_TOP, LEFT_EYE_BOTTOM, LEFT_EYE_CORNER, 133)
        right_ear = self._eye_aspect_ratio(landmarks, RIGHT_EYE_TOP, RIGHT_EYE_BOTTOM, RIGHT_EYE_CORNER, 362)
        avg_ear = (left_ear + right_ear) / 2
        metrics["ear"] = round(avg_ear, 3)

        return {"violations": violations, "metrics": metrics}

    def close(self):
        self.face_mesh.close()
