import React, { forwardRef } from 'react';
import ReactWebcam from 'react-webcam';

const Webcam = forwardRef(({ stream }, ref) => {
  return (
    <div className="webcam-wrapper">
      <ReactWebcam
        ref={ref}
        audio={false}
        screenshotFormat="image/jpeg"
        screenshotQuality={0.7}
        videoConstraints={{
          width: 320,
          height: 240,
          facingMode: 'user'
        }}
        className="webcam-feed"
      />
      <div className="webcam-overlay">
        <div className="face-box"></div>
      </div>
      <div className="webcam-label">Camera · Live</div>
    </div>
  );
});

Webcam.displayName = 'Webcam';
export default Webcam;
