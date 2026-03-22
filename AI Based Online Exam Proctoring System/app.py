import base64
import cv2
import numpy as np
from flask import Flask, render_template
from flask_socketio import SocketIO, emit
from proctoring_ai import process_frame

app = Flask(__name__)
# Simple secret key
app.config['SECRET_KEY'] = 'proctoring_secret_2026'
# Allow CORS for WebSockets
socketio = SocketIO(app, cors_allowed_origins='*', logger=False, engineio_logger=False)

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('video_frame')
def handle_video_frame(dataURL):
    """
    Receives base64 encoded JPG from client.
    Runs MediaPipe and YOLO logic.
    Sends back alerts and the processed image with bounding boxes.
    """
    try:
        # dataURL format: "data:image/jpeg;base64,...base64string..."
        header, encoded = dataURL.split(",", 1)
        image_bytes = base64.b64decode(encoded)
        
        # Convert to a numpy array for OpenCV
        np_arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        
        if img is not None:
            # Pass image to AI module
            alerts, processed_img = process_frame(img)
            
            # Re-encode to send back processed image
            _, buffer = cv2.imencode('.jpg', processed_img, [int(cv2.IMWRITE_JPEG_QUALITY), 60])
            processed_base64 = base64.b64encode(buffer).decode('utf-8')
            
            emit('proctoring_result', {
                'alerts': alerts, 
                'image': 'data:image/jpeg;base64,' + processed_base64
            })
    except Exception as e:
        print(f"Error processing video frame: {e}")

@socketio.on('audio_volume')
def handle_audio_volume(data):
    """
    Client computes average volume (0-255) locally.
    Server checks if it exceeds the noise threshold.
    """
    try:
        volume = data.get('volume', 0)
        # 50 is an arbitrary threshold; can be tuned
        if volume > 50:
            emit('audio_alert', {'message': 'High background noise or talking detected!'})
    except Exception as e:
        print(f"Error processing audio volume: {e}")

if __name__ == '__main__':
    # Using default Werkzeug server with SocketIO for local testing
    socketio.run(app, debug=True, port=5000)
