import { useEffect } from 'react';
import { useCamera } from '../../hooks/useCamera';
import styles from './CameraFeed.module.css';

export default function CameraFeed({ onViolation, autoConnect = true }) {
  const cam = useCamera();

  useEffect(() => { if (autoConnect) cam.connect(); }, []);

  const statusLabel = { idle:'Not Connected', connecting:'Connecting...', live:'Live', demo:'Demo Mode', error:'Error', denied:'Access Denied' }[cam.status] || 'Unknown';
  const statusCls   = cam.isLive ? styles.statusLive : cam.status === 'connecting' ? styles.statusWarn : styles.statusOff;

  return (
    <div className={styles.camCard}>
      <div className={styles.camHdr}>
        <div className={styles.camHdrL}>
          {cam.isLive && <><span className={styles.recDot}/><span className={styles.recLabel}>REC</span></>}
          {cam.isLive && <span className={styles.liveBadge}>LIVE</span>}
        </div>
        <span className={styles.camSname}>{cam.status === 'demo' ? 'DEMO MODE' : 'CAM'}</span>
      </div>

      <div className={styles.camArea}>
        {/* Real video feed */}
        <video ref={cam.videoRef} autoPlay playsInline muted
               className={styles.video}
               style={{ display: cam.status === 'live' && !cam.isCamOff ? 'block' : 'none' }} />
        {/* Demo canvas feed */}
        <canvas ref={cam.canvasRef}
                className={styles.canvas}
                style={{ display: cam.status === 'demo' && !cam.isCamOff ? 'block' : 'none' }} />
        {/* Scan line overlay */}
        <div className={styles.scanLines} />
        {/* Corner brackets */}
        <div className={styles.corners}>
          <div className={`${styles.co} ${styles.coTL}`}/>
          <div className={`${styles.co} ${styles.coTR}`}/>
          <div className={`${styles.co} ${styles.coBL}`}/>
          <div className={`${styles.co} ${styles.coBR}`}/>
        </div>
        {/* Face detection box */}
        {cam.isLive && <div className={styles.faceBox}><span className={styles.faceLbl}>Face Detected</span></div>}
        {/* Placeholder */}
        {(cam.status === 'idle' || cam.status === 'connecting') && (
          <div className={styles.placeholder}>
            <div className={styles.phIco} style={{ animation: cam.status==='connecting'?'spin 1s linear infinite':undefined }}>
              {cam.status === 'connecting' ? '⟳' : '⬤'}
            </div>
            <div className={styles.phTxt} style={{ color:'var(--a2)' }}>
              {cam.status === 'connecting' ? 'Requesting access...' : 'Connecting camera...'}
            </div>
          </div>
        )}
      </div>

      <div className={styles.camCtrls}>
        <button className={`${styles.camBtn} ${cam.isMuted ? styles.btnOff : ''}`} onClick={cam.toggleMute} title="Toggle microphone">MIC</button>
        <button className={`${styles.camBtn} ${cam.isCamOff ? styles.btnOff : ''}`} onClick={cam.toggleCam} title="Toggle camera">CAM</button>
        <button className={styles.camBtn} onClick={cam.connect} title="Retry connection">↺</button>
        <span className={`${styles.camStatus} ${statusCls}`}>{statusLabel}</span>
        {cam.isLive && <span className={styles.camElapsed}>{cam.elapsedStr}</span>}
      </div>
    </div>
  );
}
