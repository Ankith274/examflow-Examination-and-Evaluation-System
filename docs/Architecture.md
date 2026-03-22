# ExamFlow — Architecture & Developer Guide

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER                              │
│                                                             │
│  ┌──────────────┐    ┌──────────────────────────────────┐   │
│  │  Student UI  │    │         Admin Dashboard          │   │
│  │  (ExamPage)  │    │  (live feeds, violations, scores)│   │
│  └──────┬───────┘    └───────────────┬──────────────────┘   │
│         │ WebSocket frames           │ WebSocket admin feed  │
└─────────┼────────────────────────────┼─────────────────────┘
          │                            │
          ▼                            ▼
┌─────────────────────┐    ┌───────────────────────┐
│  WebSocket Server   │───▶│   Backend REST API    │
│  (ws://port 5001)   │    │   (http://port 5000)  │
│                     │    │                       │
│  frameHandler       │    │  /api/auth            │
│  audioHandler       │    │  /api/exams           │
└────────┬────────────┘    │  /api/sessions        │
         │                 │  /api/violations      │
         │ HTTP POST       └──────────┬────────────┘
         ▼                            │
┌─────────────────────┐               │ SQL queries
│  ML Service (Flask) │    ┌──────────▼────────────┐
│  (http://port 6000) │    │      PostgreSQL        │
│                     │    │  users / exams /       │
│  VideoPipeline      │    │  sessions / violations │
│  ├─ FaceDetector    │    └───────────────────────┘
│  ├─ GazeTracker     │
│  └─ ObjectDetector  │
│                     │
│  ViolationEngine    │
│  (cooldowns/scores) │
└─────────────────────┘
```

## Data Flow: Single Frame

```
Student webcam
  → React captures frame (every 2s via setInterval)
  → proctorService.sendFrame(base64)
  → WebSocket server receives { type: 'frame', data, sessionId }
  → frameHandler.process(data, sessionId)
  → POST /analyze/frame to ML service
  → VideoPipeline.analyze(frame)
      ├── FaceDetector   → no_face / multiple_face violations
      ├── GazeTracker    → gaze_off violations
      └── ObjectDetector → phone / book violations
  → ViolationEngine.filter() applies cooldowns
  → violation saved to PostgreSQL
  → WebSocket pushes { type: 'violation', payload } to:
      ├── Student (WarningPopup shown)
      └── All admin clients (AdminDashboard updates live)
```

## Key Design Decisions

### Why WebSocket + HTTP polling (not WebRTC)?
- WebRTC peer-to-peer is complex to scale and requires STUN/TURN servers.
- Sending frames via WebSocket to a central server is simpler, allows server-side ML, and is easier to record.
- Frame rate of 1 frame/2s is sufficient for behavioral detection without network overload.

### Why a separate ML microservice?
- Python ecosystem has the best CV/ML tooling (MediaPipe, YOLO, OpenCV).
- Isolates GPU resource usage from the Node.js API.
- Can be scaled independently (e.g., more replicas for more concurrent exams).

### Violation cooldowns
- Without cooldowns, gaze-off would fire on every frame (~30/min), spamming the student and admin.
- Each violation type has a minimum interval (e.g., gaze_off: 8s, phone: 10s).
- The ViolationEngine tracks last-fired time per (session, type) pair.

## Environment Variables

| Variable | Service | Description |
|----------|---------|-------------|
| `JWT_SECRET` | Backend | Secret for signing JWTs |
| `DB_HOST` | Backend | PostgreSQL host |
| `ML_SERVICE_URL` | Backend/WS | URL of Python ML service |
| `CONFIDENCE_THRESHOLD` | ML | Min confidence to report a violation |
| `YOLO_MODEL_PATH` | ML | Path to YOLOv8 .pt weights file |

## Adding a New Violation Type

1. **ML Service**: Add detection logic in a detector file, return `{ type, severity, confidence, metadata }`.
2. **ViolationEngine**: Add cooldown in `COOLDOWNS` dict.
3. **frameHandler.js**: Add message template in `MESSAGES`.
4. **Frontend**: No changes needed — WarningPopup renders any message string.

## Running Tests

```bash
# Backend
cd tests/backend && npx jest

# ML
cd tests/ml && python -m pytest -v
```
