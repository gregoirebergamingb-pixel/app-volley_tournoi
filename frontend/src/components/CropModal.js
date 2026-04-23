import React, { useState, useRef, useEffect, useCallback } from 'react';

const CROP_SIZE   = 260; // px on screen
const OUTPUT_SIZE = 240; // px output

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

export default function CropModal({ src, onConfirm, onCancel }) {
  const imgRef      = useRef(null);
  const [nw, setNw] = useState(0);
  const [nh, setNh] = useState(0);
  const [scale, setScale] = useState(1);
  const [dx, setDx]       = useState(0);
  const [dy, setDy]       = useState(0);

  const minScale = useRef(1);

  // Constraints: image must always cover the circular crop area
  const constrain = useCallback((s, x, y, naturalW, naturalH) => {
    const hw = (naturalW * s) / 2;
    const hh = (naturalH * s) / 2;
    const half = CROP_SIZE / 2;
    const maxX = Math.max(0, hw - half);
    const maxY = Math.max(0, hh - half);
    return { s, x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
  }, []);

  const onImageLoad = () => {
    const img = imgRef.current;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    setNw(w); setNh(h);
    const ms = CROP_SIZE / Math.min(w, h);
    minScale.current = ms;
    setScale(ms);
    setDx(0); setDy(0);
  };

  // ── Mouse drag ──────────────────────────────────────────────
  const dragRef = useRef(null);

  const onMouseDown = (e) => {
    dragRef.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseMove = useCallback((e) => {
    if (!dragRef.current) return;
    const ddx = e.clientX - dragRef.current.x;
    const ddy = e.clientY - dragRef.current.y;
    dragRef.current = { x: e.clientX, y: e.clientY };
    setDx(px => { const c = constrain(scale, px + ddx, dy, nw, nh); return c.x; });
    setDy(py => { const c = constrain(scale, dx, py + ddy, nw, nh); return c.y; });
  }, [constrain, scale, dx, dy, nw, nh]);
  const onMouseUp = () => { dragRef.current = null; };

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseMove]);

  // Scroll zoom
  const onWheel = (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setScale(s => {
      const ns = clamp(s * factor, minScale.current, minScale.current * 5);
      const c = constrain(ns, dx, dy, nw, nh);
      setDx(c.x); setDy(c.y);
      return ns;
    });
  };

  // ── Touch ────────────────────────────────────────────────────
  const touchRef = useRef(null);

  const onTouchStart = (e) => {
    if (e.touches.length === 1) {
      touchRef.current = { type: 'drag', x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      );
      touchRef.current = { type: 'pinch', dist, scale };
    }
  };

  const onTouchMove = (e) => {
    e.preventDefault();
    if (!touchRef.current) return;
    if (touchRef.current.type === 'drag' && e.touches.length === 1) {
      const ddx = e.touches[0].clientX - touchRef.current.x;
      const ddy = e.touches[0].clientY - touchRef.current.y;
      touchRef.current.x = e.touches[0].clientX;
      touchRef.current.y = e.touches[0].clientY;
      setDx(px => constrain(scale, px + ddx, dy, nw, nh).x);
      setDy(py => constrain(scale, dx, py + ddy, nw, nh).y);
    } else if (touchRef.current.type === 'pinch' && e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      );
      const ns = clamp(
        touchRef.current.scale * (dist / touchRef.current.dist),
        minScale.current, minScale.current * 5
      );
      const c = constrain(ns, dx, dy, nw, nh);
      setScale(ns); setDx(c.x); setDy(c.y);
    }
  };

  const onTouchEnd = () => { touchRef.current = null; };

  // ── Crop & export ────────────────────────────────────────────
  const handleConfirm = () => {
    if (!nw || !nh) return;
    const canvas = document.createElement('canvas');
    canvas.width  = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    const srcX    = nw / 2 - dx / scale - CROP_SIZE / (2 * scale);
    const srcY    = nh / 2 - dy / scale - CROP_SIZE / (2 * scale);
    const srcSize = CROP_SIZE / scale;
    ctx.drawImage(imgRef.current, srcX, srcY, srcSize, srcSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    onConfirm(canvas.toDataURL('image/jpeg', 0.82));
  };

  const imgLeft = CROP_SIZE / 2 + dx - (nw * scale) / 2;
  const imgTop  = CROP_SIZE / 2 + dy - (nh * scale) / 2;

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(10,18,40,0.85)', zIndex:500,
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20 }}>

      <div style={{ color:'white', fontSize:15, fontWeight:700 }}>Recadrer la photo</div>
      <div style={{ fontSize:12, color:'rgba(255,255,255,0.6)' }}>Glisse ou pince pour ajuster</div>

      {/* Crop container */}
      <div
        style={{ position:'relative', width:CROP_SIZE, height:CROP_SIZE,
          borderRadius:'50%', overflow:'hidden', cursor:'grab',
          background:'#000', flexShrink:0,
          boxShadow:'0 0 0 4px rgba(255,255,255,0.3), 0 0 0 9999px rgba(10,18,40,0.85)' }}
        onMouseDown={onMouseDown}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <img
          ref={imgRef}
          src={src}
          alt=""
          draggable={false}
          onLoad={onImageLoad}
          style={{
            position:'absolute',
            left: imgLeft, top: imgTop,
            width: nw * scale, height: nh * scale,
            userSelect:'none', pointerEvents:'none',
          }}
        />
        {/* Silhouette guideline */}
        <div style={{ position:'absolute', inset:0, borderRadius:'50%',
          border:'2px solid rgba(255,255,255,0.55)', pointerEvents:'none' }} />
        {/* Crosshair lines */}
        <div style={{ position:'absolute', top:'50%', left:0, right:0,
          height:1, background:'rgba(255,255,255,0.2)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', left:'50%', top:0, bottom:0,
          width:1, background:'rgba(255,255,255,0.2)', pointerEvents:'none' }} />
      </div>

      <div style={{ display:'flex', gap:12 }}>
        <button onClick={onCancel}
          style={{ background:'rgba(255,255,255,0.12)', color:'white', border:'1px solid rgba(255,255,255,0.3)',
            borderRadius:12, padding:'11px 24px', fontSize:14, fontWeight:600, cursor:'pointer' }}>
          Annuler
        </button>
        <button onClick={handleConfirm}
          style={{ background:'var(--primary)', color:'white', border:'none',
            borderRadius:12, padding:'11px 28px', fontSize:14, fontWeight:700, cursor:'pointer' }}>
          Valider
        </button>
      </div>
    </div>
  );
}
