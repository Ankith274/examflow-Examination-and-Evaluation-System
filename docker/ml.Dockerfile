# ml.Dockerfile
FROM python:3.11-slim

# System deps for OpenCV + MediaPipe
RUN apt-get update && apt-get install -y \
    libglib2.0-0 libsm6 libxext6 libxrender-dev \
    libgomp1 portaudio19-dev gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create models dir (mount your actual model files here)
RUN mkdir -p models

EXPOSE 6000
CMD ["python", "-m", "gunicorn", "api.app:app", \
     "--bind", "0.0.0.0:6000", \
     "--workers", "2", \
     "--timeout", "60"]
