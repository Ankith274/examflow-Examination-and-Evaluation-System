import { useState, useEffect, useRef, useCallback } from 'react';

export function useCamera() {
  const [stream,     setStream]     = useState(null);
  const [status,     setStatus]     = useState('idle');   // idle|connecting|live|demo|error|denied
  const [elapsed,    setElapsed]    = useState(0);
  const [isMuted,    setIsMuted]    = useState(false);
  const [isCamOff,   setIsCamOff]   = useState(false);
  const videoRef      = useRef(null);
  const canvasRef     = useRef(null);
  const elapsedRef    = useRef(null);
  const demoRef       = useRef(null);
  const frameRef      = useRef(0);

  const startElapsedTimer = useCallback(() => {
    setElapsed(0);
    elapsedRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
  }, []);

  const startDemoMode = useCallback((reason = '') => {
    setStatus('demo');
    startElapsedTimer();
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    canvasRef.current.width  = 320;
    canvasRef.current.height = 240;
    let frame = 0;
    const draw = () => {
      frame++;
      ctx.fillStyle = '#080e1a';
      ctx.fillRect(0, 0, 320, 240);
      const scanY = (frame * 2) % 260;
      const grad  = ctx.createLinearGradient(0, scanY - 20, 0, scanY + 4);
      grad.addColorStop(0, 'rgba(15,184,164,0)');
      grad.addColorStop(1, 'rgba(15,184,164,0.18)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, scanY - 20, 320, 24);
      const cx = 160, cy = 105;
      ctx.save();
      ctx.strokeStyle = 'rgba(15,184,164,0.55)';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 42, 52, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 70, 200);
      ctx.quadraticCurveTo(cx - 50, 155, cx - 30, 148);
      ctx.quadraticCurveTo(cx, 144, cx + 30, 148);
      ctx.quadraticCurveTo(cx + 50, 155, cx + 70, 200);
      ctx.stroke();
      const blink = Math.sin(frame * 0.08) > 0.97;
      if (!blink) {
        ctx.beginPath(); ctx.ellipse(cx-15, cy-5, 7, 5, 0, 0, Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(cx+15, cy-5, 7, 5, 0, 0, Math.PI*2); ctx.stroke();
        ctx.fillStyle = 'rgba(15,184,164,0.7)';
        ctx.beginPath(); ctx.arc(cx-15, cy-5, 3, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx+15, cy-5, 3, 0, Math.PI*2); ctx.fill();
      }
      ctx.beginPath(); ctx.moveTo(cx, cy+2); ctx.lineTo(cx-5, cy+14); ctx.lineTo(cx+5, cy+14); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy+26, 10, 0.15, Math.PI-0.15); ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = 'rgba(15,184,164,0.6)';
      ctx.lineWidth   = 2;
      [[6,6],[302,6],[6,228],[302,228]].forEach(([x,y],idx) => {
        const sx = idx%2===0?1:-1, sy = idx<2?1:-1;
        ctx.beginPath(); ctx.moveTo(x, y+sy*14); ctx.lineTo(x, y); ctx.lineTo(x+sx*14, y); ctx.stroke();
      });
      ctx.fillStyle = 'rgba(15,184,164,0.9)';
      ctx.font = 'bold 9px monospace';
      ctx.fillText('FACE DETECTED', 72, 22);
      if (reason) {
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.font = '8px monospace';
        ctx.fillText(`DEMO — ${reason}`, 8, 232);
      }
      if (Math.floor(frame / 15) % 2 === 0) {
        ctx.fillStyle = 'rgba(232,64,74,0.9)';
        ctx.beginPath(); ctx.arc(304, 12, 4, 0, Math.PI*2); ctx.fill();
      }
      for (let i = 0; i < 30; i++) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.02})`;
        ctx.fillRect(Math.random() * 320, Math.random() * 240, 1, 1);
      }
      demoRef.current = requestAnimationFrame(draw);
    };
    demoRef.current = requestAnimationFrame(draw);
  }, [startElapsedTimer]);

  const connect = useCallback(async () => {
    setStatus('connecting');
    if (!navigator.mediaDevices?.getUserMedia) {
      startDemoMode('API unavailable — needs HTTPS');
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' },
        audio: true,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
      setStream(s);
      setStatus('live');
      startElapsedTimer();
    } catch (e) {
      const reason = e.name === 'NotAllowedError'  ? 'Permission denied'
                   : e.name === 'NotFoundError'    ? 'No camera found'
                   : e.name === 'NotReadableError' ? 'Camera in use by another app'
                   : location.protocol === 'file:' ? 'File:// needs HTTPS'
                   : e.name || 'Unknown error';
      startDemoMode(reason);
    }
  }, [startDemoMode, startElapsedTimer]);

  const disconnect = useCallback(() => {
    if (stream) { stream.getTracks().forEach(t => t.stop()); setStream(null); }
    if (elapsedRef.current) clearInterval(elapsedRef.current);
    if (demoRef.current) cancelAnimationFrame(demoRef.current);
    setStatus('idle');
  }, [stream]);

  const toggleMute = useCallback(() => {
    if (stream) stream.getAudioTracks().forEach(t => { t.enabled = isMuted; });
    setIsMuted(m => !m);
  }, [stream, isMuted]);

  const toggleCam = useCallback(() => {
    if (stream) stream.getVideoTracks().forEach(t => { t.enabled = isCamOff; });
    setIsCamOff(c => !c);
  }, [stream, isCamOff]);

  useEffect(() => () => disconnect(), []);

  const pad = n => String(n).padStart(2, '0');
  const elapsedStr = `${pad(Math.floor(elapsed/60))}:${pad(elapsed%60)}`;

  return {
    stream, status, elapsed, elapsedStr,
    isMuted, isCamOff, isLive: status === 'live' || status === 'demo',
    videoRef, canvasRef,
    connect, disconnect, toggleMute, toggleCam,
  };
}
