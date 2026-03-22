from typing import List, Dict
from collections import defaultdict
import time

SEVERITY_SCORE = {"high": 10, "medium": 5, "low": 2}
RISK_THRESHOLDS = {"low": 10, "medium": 30, "high": 60}


class ViolationEngine:
    """
    Tracks violations per session, computes cumulative risk score,
    and applies cooldowns to avoid flooding repeated alerts.
    """

    def __init__(self):
        # session_id -> { type -> last_flagged_time }
        self._cooldowns: Dict[str, Dict[str, float]] = defaultdict(dict)
        # session_id -> cumulative score
        self._scores: Dict[str, float] = defaultdict(float)
        # Cooldown periods per violation type (seconds)
        self.COOLDOWNS = {
            "no_face":       5,
            "multiple_face": 5,
            "gaze_off":      8,
            "head_pose":     10,
            "phone":         10,
            "book":          15,
            "audio_talking": 10,
            "tab_switch":    3,
        }

    def filter(self, session_id: str, violations: List[Dict]) -> List[Dict]:
        """
        Apply per-type cooldowns so we don't fire the same violation
        every frame. Returns only violations ready to be emitted.
        """
        now = time.time()
        to_emit = []
        for v in violations:
            vtype = v["type"]
            cooldown = self.COOLDOWNS.get(vtype, 5)
            last = self._cooldowns[session_id].get(vtype, 0)
            if now - last >= cooldown:
                self._cooldowns[session_id][vtype] = now
                self._scores[session_id] += SEVERITY_SCORE.get(v["severity"], 2)
                to_emit.append(v)
        return to_emit

    def risk_level(self, session_id: str) -> str:
        score = self._scores.get(session_id, 0)
        if score >= RISK_THRESHOLDS["high"]:
            return "high"
        elif score >= RISK_THRESHOLDS["medium"]:
            return "medium"
        return "low"

    def session_score(self, session_id: str) -> float:
        return self._scores.get(session_id, 0)

    def reset(self, session_id: str):
        self._cooldowns.pop(session_id, None)
        self._scores.pop(session_id, None)
