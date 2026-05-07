import { useState, useRef, useEffect, useCallback } from 'react';
import C from '../theme';

// ── Display size (what the user sees on screen) ───────────────────────
const DISPLAY_SIZE = 320;

// ── Export size (what actually gets uploaded — 1200×1200 for crisp quality) ──
const EXPORT_SIZE = 1200;

export default function ImageCropModal({ file, onCrop, onCancel }) {
  const canvasRef  = useRef(null);
  const imgRef     = useRef(null);
  const [ready,    setReady]    = useState(false);
  const [scale,    setScale]    = useState(1);
  const [offset,   setOffset]   = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart      = useRef(null);
  const lastTouch      = useRef(null);
  const lastPinchDist  = useRef(null);
  const scaleRef       = useRef(1);
  const offsetRef      = useRef({ x: 0, y: 0 });

  // Keep refs in sync for use inside event handlers
  useEffect(() => { scaleRef.current  = scale;  }, [scale]);
  useEffect(() => { offsetRef.current = offset; }, [offset]);

  // Load image and set initial scale to fill square
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const minScale = Math.max(DISPLAY_SIZE / img.width, DISPLAY_SIZE / img.height);
      scaleRef.current = minScale;
      setScale(minScale);
      setOffset({ x: 0, y: 0 });
      setReady(true);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Draw preview frame on display canvas whenever scale/offset change
  useEffect(() => {
    if (!ready || !canvasRef.current || !imgRef.current) return;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    const img    = imgRef.current;
    ctx.clearRect(0, 0, DISPLAY_SIZE, DISPLAY_SIZE);
    const w = img.width  * scale;
    const h = img.height * scale;
    ctx.drawImage(img, (DISPLAY_SIZE - w) / 2 + offset.x, (DISPLAY_SIZE - h) / 2 + offset.y, w, h);
  }, [ready, scale, offset]);

  const clamp = useCallback((ox, oy, s) => {
    if (!imgRef.current) return { x: ox, y: oy };
    const img  = imgRef.current;
    const maxX = Math.max(0, (img.width  * s - DISPLAY_SIZE) / 2);
    const maxY = Math.max(0, (img.height * s - DISPLAY_SIZE) / 2);
    return { x: Math.max(-maxX, Math.min(maxX, ox)), y: Math.max(-maxY, Math.min(maxY, oy)) };
  }, []);

  // ── Mouse ────────────────────────────────────────────────────────
  const onMouseDown = e => {
    setDragging(true);
    dragStart.current = { x: e.clientX - offsetRef.current.x, y: e.clientY - offsetRef.current.y };
  };
  const onMouseMove = e => {
    if (!dragging || !dragStart.current) return;
    const raw = { x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y };
    setOffset(clamp(raw.x, raw.y, scaleRef.current));
  };
  const onMouseUp = () => { setDragging(false); dragStart.current = null; };

  // ── Touch ─────────────────────────────────────────────────────────
  const onTouchStart = e => {
    if (e.touches.length === 1) {
      lastTouch.current = { x: e.touches[0].clientX - offsetRef.current.x, y: e.touches[0].clientY - offsetRef.current.y };
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDist.current = Math.sqrt(dx * dx + dy * dy);
    }
  };
  const onTouchMove = e => {
    e.preventDefault();
    if (e.touches.length === 1 && lastTouch.current) {
      const raw = { x: e.touches[0].clientX - lastTouch.current.x, y: e.touches[0].clientY - lastTouch.current.y };
      setOffset(clamp(raw.x, raw.y, scaleRef.current));
    } else if (e.touches.length === 2 && lastPinchDist.current && imgRef.current) {
      const dx   = e.touches[0].clientX - e.touches[1].clientX;
      const dy   = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const img  = imgRef.current;
      const min  = Math.max(DISPLAY_SIZE / img.width, DISPLAY_SIZE / img.height);
      const next = Math.max(min, Math.min(scaleRef.current * (dist / lastPinchDist.current), min * 4));
      scaleRef.current = next;
      setScale(next);
      setOffset(prev => clamp(prev.x, prev.y, next));
      lastPinchDist.current = dist;
    }
  };
  const onTouchEnd = () => { lastTouch.current = null; lastPinchDist.current = null; };

  // ── Scroll to zoom ────────────────────────────────────────────────
  const onWheel = e => {
    e.preventDefault();
    if (!imgRef.current) return;
    const img  = imgRef.current;
    const min  = Math.max(DISPLAY_SIZE / img.width, DISPLAY_SIZE / img.height);
    const next = Math.max(min, Math.min(scaleRef.current * (1 - e.deltaY * 0.001), min * 4));
    scaleRef.current = next;
    setScale(next);
    setOffset(prev => clamp(prev.x, prev.y, next));
  };

  // ── Crop & return — exports at EXPORT_SIZE for high quality ───────
  // The display canvas is 320×320. We calculate the same crop region
  // but render it onto a 1200×1200 canvas so the uploaded image is crisp.
  const handleUse = () => {
    if (!imgRef.current) return;
    const img    = imgRef.current;
    const ratio  = EXPORT_SIZE / DISPLAY_SIZE;

    // Create a high-res export canvas
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width  = EXPORT_SIZE;
    exportCanvas.height = EXPORT_SIZE;
    const ctx = exportCanvas.getContext('2d');

    // Scale up the same scale/offset values by the ratio
    const exportScale  = scaleRef.current * ratio;
    const exportOffset = { x: offsetRef.current.x * ratio, y: offsetRef.current.y * ratio };

    const w = img.width  * exportScale;
    const h = img.height * exportScale;
    ctx.drawImage(
      img,
      (EXPORT_SIZE - w) / 2 + exportOffset.x,
      (EXPORT_SIZE - h) / 2 + exportOffset.y,
      w, h
    );

    // Export at 0.95 quality (higher than before)
    exportCanvas.toBlob(blob => {
      const croppedFile = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      onCrop(url, croppedFile);
    }, 'image/jpeg', 0.95);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000f0', zIndex: 1200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', maxWidth: 480, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ width: '100%', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onCancel} style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: 600 }}>Cancel</button>
        <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>Move and Scale</span>
        <button onClick={handleUse} style={{ color: C.sky, fontSize: 15, fontWeight: 800 }}>Use Photo</button>
      </div>

      {/* Display canvas — 320×320 for the UI, exports at 1200×1200 */}
      <div
        style={{ width: DISPLAY_SIZE, height: DISPLAY_SIZE, position: 'relative', cursor: dragging ? 'grabbing' : 'grab', borderRadius: 2, overflow: 'hidden', touchAction: 'none' }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
        onWheel={onWheel}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      >
        <canvas ref={canvasRef} width={DISPLAY_SIZE} height={DISPLAY_SIZE} style={{ display: 'block' }} />
        {/* Rule-of-thirds grid overlay */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', border: '1px solid rgba(255,255,255,0.4)' }}>
          {[1, 2].map(i => (
            <div key={`h${i}`} style={{ position: 'absolute', left: 0, right: 0, top: `${(i / 3) * 100}%`, height: 1, background: 'rgba(255,255,255,0.2)' }} />
          ))}
          {[1, 2].map(i => (
            <div key={`v${i}`} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(i / 3) * 100}%`, width: 1, background: 'rgba(255,255,255,0.2)' }} />
          ))}
        </div>
        {!ready && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
            Loading…
          </div>
        )}
      </div>

      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 16, textAlign: 'center', lineHeight: 1.6 }}>
        Drag to reposition · Pinch or scroll to zoom
      </div>
    </div>
  );
}
