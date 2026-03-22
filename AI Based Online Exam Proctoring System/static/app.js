const socket = io();

// UI Elements
const video = document.getElementById('videoElement');
const canvas = document.getElementById('canvasElement');
const processedImage = document.getElementById('processedImage');
const startExamBtn = document.getElementById('startExamBtn');
const endExamBtn = document.getElementById('endExamBtn');
const statusIndicator = document.getElementById('status');
const alertsList = document.getElementById('alertsList');
const showProcessedCheckbox = document.getElementById('showProcessed');

// Media variables
let stream = null;
let videoInterval = null;
let audioContext = null;
let microphone = null;
let analyser = null;
let audioInterval = null;

// Track last alert time to prevent spam
const alertCooldowns = {};
const COOLDOWN_MS = 3000; // 3 seconds per identical alert

socket.on('connect', () => {
    statusIndicator.textContent = '● Connected to Server';
    statusIndicator.classList.add('connected');
});

socket.on('disconnect', () => {
    statusIndicator.textContent = '● Disconnected';
    statusIndicator.classList.remove('connected');
});

// Receiving video frame results
socket.on('proctoring_result', (data) => {
    // Show AI output if user toggled the checkbox
    if (showProcessedCheckbox.checked && data.image) {
        video.style.display = 'none';
        processedImage.style.display = 'block';
        processedImage.src = data.image;
    } else {
        video.style.display = 'block';
        processedImage.style.display = 'none';
        
        // Ensure standard video feed mirrors correctly if needed
        video.style.transform = 'scaleX(-1)'; 
    }

    if (data.alerts && data.alerts.length > 0) {
        data.alerts.forEach(alertMsg => {
            handleAlert(alertMsg, 'danger');
        });
    }
});

// Receiving audio volume alerts
socket.on('audio_alert', (data) => {
    if (data.message) {
        handleAlert(data.message, 'warning');
    }
});

function handleAlert(message, type) {
    const now = Date.now();
    // Throttle duplicate alerts
    if (!alertCooldowns[message] || (now - alertCooldowns[message] > COOLDOWN_MS)) {
        addAlert(message, type);
        alertCooldowns[message] = now;
    }
}

function addAlert(message, type = 'info') {
    const li = document.createElement('li');
    li.className = `alert-${type}`;
    
    // Formatting time
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    li.innerHTML = `<strong>[${time}]</strong> ${message}`;
    
    // Add to top of list
    alertsList.prepend(li);
    
    // Prune old alerts (keep max 30)
    if (alertsList.children.length > 30) {
        alertsList.removeChild(alertsList.lastChild);
    }
}

async function startExam() {
    try {
        // Request webcam and microphone
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15 } },
            audio: true 
        });
        
        video.srcObject = stream;
        
        startExamBtn.disabled = true;
        endExamBtn.disabled = false;
        
        addAlert("Exam started. Camera and microphone active.", "success");
        
        // Send a frame to backend every 500ms (2 FPS)
        videoInterval = setInterval(captureAndSendFrame, 500);
        
        // Analyze audio volume every second
        setupAudioAnalysis(stream);

    } catch (err) {
        console.error("Error accessing media devices.", err);
        addAlert("Failed to access camera/microphone. Please check permissions.", "danger");
    }
}

function stopExam() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    
    clearInterval(videoInterval);
    if (audioInterval) clearInterval(audioInterval);
    if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
    }
    
    video.srcObject = null;
    startExamBtn.disabled = false;
    endExamBtn.disabled = true;
    
    video.style.display = 'block';
    processedImage.style.display = 'none';
    
    addAlert("Exam ended. Monitoring stopped.", "info");
}

function captureAndSendFrame() {
    if (!stream || video.videoWidth === 0) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    
    // Draw current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // JPEG base64, quality 0.6 reduces payload size significantly
    const dataURL = canvas.toDataURL('image/jpeg', 0.6);
    socket.emit('video_frame', dataURL);
}

function setupAudioAnalysis(stream) {
    // Cross-browser AudioContext
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    
    audioContext = new AudioContextClass();
    analyser = audioContext.createAnalyser();
    
    // Extract audio stream
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;
    
    const audioStream = new MediaStream([audioTracks[0]]);
    microphone = audioContext.createMediaStreamSource(audioStream);
    
    analyser.smoothingTimeConstant = 0.8;
    analyser.fftSize = 1024;
    
    microphone.connect(analyser);
    
    const array = new Uint8Array(analyser.frequencyBinCount);
    
    audioInterval = setInterval(() => {
        analyser.getByteFrequencyData(array);
        let values = 0;
        
        for (let i = 0; i < array.length; i++) {
            values += array[i];
        }
        
        // Calculate average volume (0-255)
        const average = values / array.length;
        socket.emit('audio_volume', { volume: average });
    }, 1000); // 1 sec interval
}

startExamBtn.addEventListener('click', startExam);
endExamBtn.addEventListener('click', stopExam);
