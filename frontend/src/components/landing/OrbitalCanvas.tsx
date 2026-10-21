import { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
}

/** Surface nodes — Indian monitoring regions, plotted on the wireframe globe. */
const NODES = [
  { lat: 15.85, lon: 74.5 },  // Belagavi
  { lat: 19.07, lon: 72.87 }, // Mumbai
  { lat: 12.97, lon: 77.59 }, // Bengaluru
  { lat: 28.61, lon: 77.2 },  // Delhi
  { lat: 22.57, lon: 88.36 }, // Kolkata
  { lat: 9.93, lon: 76.26 },  // Kochi
  { lat: 26.9, lon: 75.8 },   // Jaipur
  { lat: 25.6, lon: 85.1 },   // Patna
];

/**
 * Decorative orbital scene: starfield, scanning wireframe globe, orbit track.
 * Pure canvas 2D — no WebGL dependencies, no external assets.
 */
export function OrbitalCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerTarget = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pointer = { x: 0, y: 0 };
    let w = 0;
    let h = 0;
    let stars: Star[] = [];
    let raf = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas!.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = Array.from(
        { length: Math.min(220, Math.max(60, Math.round((w * h) / 9000))) },
        () => ({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 1.2 + 0.2,
          phase: Math.random() * Math.PI * 2,
          speed: 0.4 + Math.random() * 1.2,
        }),
      );
    }

    function project(lat: number, lon: number, rot: number, cx: number, cy: number, R: number) {
      const latR = (lat * Math.PI) / 180;
      const lonR = (lon * Math.PI) / 180 + rot;
      const x3 = Math.cos(latR) * Math.sin(lonR);
      const y3 = Math.sin(latR);
      const z3 = Math.cos(latR) * Math.cos(lonR);
      return { x: cx + x3 * R, y: cy - y3 * R, z: z3 };
    }

    function draw(t: number) {
      const time = reduced ? 0 : t;
      ctx!.clearRect(0, 0, w, h);

      // ── Starfield ──
      for (const s of stars) {
        const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(time * 0.001 * s.speed + s.phase));
        ctx!.beginPath();
        ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(190, 235, 240, ${a * 0.5})`;
        ctx!.fill();
      }

      // ── Pointer parallax (eased) ──
      pointer.x += (pointerTarget.current.x - pointer.x) * 0.05;
      pointer.y += (pointerTarget.current.y - pointer.y) * 0.05;

      const cx = w * 0.5 + pointer.x * 16;
      const cy = h * 0.5 + pointer.y * 12;
      const R = Math.min(w * 0.4, h * 0.42);

      // ── Atmosphere halo ──
      const halo = ctx!.createRadialGradient(cx, cy, R * 0.65, cx, cy, R * 1.45);
      halo.addColorStop(0, 'rgba(0, 194, 209, 0.10)');
      halo.addColorStop(0.5, 'rgba(0, 194, 209, 0.045)');
      halo.addColorStop(1, 'rgba(0, 194, 209, 0)');
      ctx!.fillStyle = halo;
      ctx!.beginPath();
      ctx!.arc(cx, cy, R * 1.45, 0, Math.PI * 2);
      ctx!.fill();

      // ── Sphere body ──
      const body = ctx!.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.05, cx, cy, R);
      body.addColorStop(0, 'rgba(28, 66, 72, 0.9)');
      body.addColorStop(0.5, 'rgba(12, 32, 36, 0.92)');
      body.addColorStop(1, 'rgba(5, 14, 16, 0.96)');
      ctx!.beginPath();
      ctx!.arc(cx, cy, R, 0, Math.PI * 2);
      ctx!.fillStyle = body;
      ctx!.fill();

      // ── Wireframe ──
      const rot = time * 0.00009;
      ctx!.lineWidth = 1;

      const strokeArc = (pts: { x: number; y: number; z: number }[]) => {
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i];
          const b = pts[i + 1];
          if (a.z <= 0.02 || b.z <= 0.02) continue;
          const depth = (a.z + b.z) / 2;
          ctx!.beginPath();
          ctx!.moveTo(a.x, a.y);
          ctx!.lineTo(b.x, b.y);
          ctx!.strokeStyle = `rgba(0, 194, 209, ${0.07 + depth * 0.2})`;
          ctx!.stroke();
        }
      };

      for (let lat = -60; lat <= 60; lat += 20) {
        const pts = [];
        for (let lon = 0; lon <= 360; lon += 6) pts.push(project(lat, lon, rot, cx, cy, R));
        strokeArc(pts);
      }
      for (let lon = 0; lon < 360; lon += 20) {
        const pts = [];
        for (let lat = -90; lat <= 90; lat += 4) pts.push(project(lat, lon, rot, cx, cy, R));
        strokeArc(pts);
      }

      // ── Rim light ──
      ctx!.beginPath();
      ctx!.arc(cx, cy, R, 0, Math.PI * 2);
      ctx!.strokeStyle = 'rgba(0, 194, 209, 0.38)';
      ctx!.shadowColor = 'rgba(0, 194, 209, 0.55)';
      ctx!.shadowBlur = 26;
      ctx!.stroke();
      ctx!.shadowBlur = 0;

      // ── Scan sweep, clipped to the sphere ──
      const sweepX = cx - R + ((time * 0.045) % (R * 2));
      ctx!.save();
      ctx!.beginPath();
      ctx!.arc(cx, cy, R, 0, Math.PI * 2);
      ctx!.clip();
      const sweep = ctx!.createLinearGradient(sweepX - R * 0.28, 0, sweepX + R * 0.28, 0);
      sweep.addColorStop(0, 'rgba(0, 194, 209, 0)');
      sweep.addColorStop(0.5, 'rgba(0, 194, 209, 0.13)');
      sweep.addColorStop(1, 'rgba(0, 194, 209, 0)');
      ctx!.fillStyle = sweep;
      ctx!.fillRect(cx - R, cy - R, R * 2, R * 2);
      ctx!.restore();

      // ── Surface nodes ──
      NODES.forEach((node, i) => {
        const p = project(node.lat, node.lon, rot, cx, cy, R);
        if (p.z <= 0.15) return;
        const pulse = 0.5 + 0.5 * Math.sin(time * 0.002 + i * 1.3);

        ctx!.beginPath();
        ctx!.arc(p.x, p.y, 2.1, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(0, 194, 209, ${0.45 + p.z * 0.5})`;
        ctx!.fill();

        ctx!.beginPath();
        ctx!.arc(p.x, p.y, 4 + pulse * 11, 0, Math.PI * 2);
        ctx!.strokeStyle = `rgba(0, 194, 209, ${(1 - pulse) * 0.4 * p.z})`;
        ctx!.lineWidth = 1;
        ctx!.stroke();
      });

      // ── Orbit track ──
      ctx!.save();
      ctx!.translate(cx, cy);
      ctx!.rotate(-0.42);
      ctx!.scale(1, 0.34);
      ctx!.beginPath();
      ctx!.arc(0, 0, R * 1.5, 0, Math.PI * 2);
      ctx!.strokeStyle = 'rgba(127, 168, 176, 0.22)';
      ctx!.setLineDash([2, 7]);
      ctx!.lineWidth = 1;
      ctx!.stroke();
      ctx!.setLineDash([]);

      const angle = time * 0.0004;
      ctx!.beginPath();
      ctx!.arc(Math.cos(angle) * R * 1.5, Math.sin(angle) * R * 1.5, 2.4, 0, Math.PI * 2);
      ctx!.fillStyle = 'rgba(0, 194, 209, 0.95)';
      ctx!.shadowColor = 'rgba(0, 194, 209, 0.9)';
      ctx!.shadowBlur = 14;
      ctx!.fill();
      ctx!.restore();

      if (!reduced) raf = requestAnimationFrame(draw);
    }

    function onPointerMove(e: PointerEvent) {
      pointerTarget.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      };
    }

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointerMove);
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, []);

  return <canvas ref={canvasRef} className="orbital-canvas" aria-hidden="true" />;
}
