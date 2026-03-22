from pipelines.video_pipeline import VideoPipeline
from services.violation_engine import ViolationEngine

# Singletons — loaded once at startup
_pipeline = None
_engine = None


def get_pipeline() -> VideoPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = VideoPipeline()
    return _pipeline


def get_engine() -> ViolationEngine:
    global _engine
    if _engine is None:
        _engine = ViolationEngine()
    return _engine


def analyze_frame(base64_frame: str, session_id: str) -> dict:
    """
    Main entry point called by the Flask route.
    Returns filtered violations ready for logging.
    """
    pipeline = get_pipeline()
    engine = get_engine()

    result = pipeline.analyze(base64_frame, session_id)
    raw_violations = result.get("violations", [])

    # Apply cooldown filtering
    filtered = engine.filter(session_id, raw_violations)

    return {
        "session_id": session_id,
        "violations": filtered,
        "metrics": result.get("metrics", {}),
        "risk_level": engine.risk_level(session_id),
        "session_score": engine.session_score(session_id),
    }
