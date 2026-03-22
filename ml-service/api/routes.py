from flask import Blueprint, request, jsonify
from services.inference import analyze_frame
from services.violation_engine import get_engine

bp = Blueprint("api", __name__, url_prefix="/")


@bp.route("/analyze/frame", methods=["POST"])
def analyze():
    """
    Accepts a base64 webcam frame and session_id.
    Returns detected violations and metrics.
    """
    body = request.get_json(force=True)
    frame = body.get("frame")
    session_id = body.get("session_id", "unknown")

    if not frame:
        return jsonify({"error": "No frame provided"}), 400

    try:
        result = analyze_frame(frame, session_id)
        return jsonify(result), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e), "violations": []}), 500


@bp.route("/session/<session_id>/risk", methods=["GET"])
def risk(session_id):
    """Return current risk level and cumulative score for a session."""
    engine = get_engine()
    return jsonify({
        "session_id": session_id,
        "risk_level": engine.risk_level(session_id),
        "score": engine.session_score(session_id),
    })


@bp.route("/session/<session_id>/reset", methods=["POST"])
def reset(session_id):
    """Reset violation state for a session (e.g. on exam end)."""
    engine = get_engine()
    engine.reset(session_id)
    return jsonify({"status": "reset", "session_id": session_id})
