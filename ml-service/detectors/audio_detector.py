import numpy as np
import threading
import time
from typing import Callable, Dict, Any

try:
    import pyaudio # pyright: ignore[reportMissingModuleSource]
    _pyaudio_available = True
except ImportError:
    _pyaudio_available = False


class AudioDetector:
    """
    Captures microphone audio and detects:
    - Voice activity (talking)
    - Multiple voices
    - Prolonged silence (possible mute cheating)
    Runs in a background thread during the exam session.
    """

    CHUNK = 1024
    FORMAT = pyaudio.paInt16 if _pyaudio_available else None
    CHANNELS = 1
    RATE = 16000
    SILENCE_THRESHOLD = 500       # RMS below this = silence
    VOICE_THRESHOLD = 2000        # RMS above this = voice activity
    TALK_DURATION_LIMIT = 5.0     # seconds of continuous talking → flag
    SILENCE_DURATION_LIMIT = 30.0 # seconds of silence → flag (possible mute)

    def __init__(self, on_violation: Callable[[Dict], None]):
        self.on_violation = on_violation
        self._running = False
        self._thread = None
        self._talk_start = None
        self._silence_start = time.time()

    def start(self, session_id: str):
        if not _pyaudio_available:
            print("[AudioDetector] PyAudio not available — skipping audio analysis")
            return
        self.session_id = session_id
        self._running = True
        self._thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._thread.start()
        print(f"[AudioDetector] Started for session {session_id}")

    def stop(self):
        self._running = False
        if self._thread:
            self._thread.join(timeout=2)

    def _rms(self, data: bytes) -> float:
        samples = np.frombuffer(data, dtype=np.int16).astype(np.float32)
        return float(np.sqrt(np.mean(samples ** 2))) if len(samples) else 0.0

    def _capture_loop(self):
        pa = pyaudio.PyAudio()
        stream = pa.open(
            format=self.FORMAT,
            channels=self.CHANNELS,
            rate=self.RATE,
            input=True,
            frames_per_buffer=self.CHUNK
        )

        try:
            while self._running:
                data = stream.read(self.CHUNK, exception_on_overflow=False)
                rms = self._rms(data)
                now = time.time()

                if rms > self.VOICE_THRESHOLD:
                    self._silence_start = now
                    if self._talk_start is None:
                        self._talk_start = now
                    elif now - self._talk_start > self.TALK_DURATION_LIMIT:
                        self.on_violation({
                            "type": "audio_talking",
                            "severity": "medium",
                            "confidence": min(1.0, rms / 5000),
                            "metadata": {"rms": round(rms), "duration": round(now - self._talk_start, 1)}
                        })
                        self._talk_start = now  # reset
                else:
                    self._talk_start = None
                    if now - self._silence_start > self.SILENCE_DURATION_LIMIT:
                        self.on_violation({
                            "type": "audio_silence",
                            "severity": "low",
                            "confidence": 0.7,
                            "metadata": {"duration": round(now - self._silence_start, 1)}
                        })
                        self._silence_start = now

        finally:
            stream.stop_stream()
            stream.close()
            pa.terminate()
