import { useEffect, useState } from 'react';

export default function useWebcam() {
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [permitted, setPermitted] = useState(false);

  useEffect(() => {
    let mediaStream;
    const getMedia = async () => {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: true
        });
        setStream(mediaStream);
        setPermitted(true);
      } catch (err) {
        setError(err.message);
        console.error('Webcam access denied:', err);
      }
    };
    getMedia();
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return { stream, error, permitted };
}
