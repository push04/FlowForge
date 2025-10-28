// src/components/LabViewport.tsx
// Detailed, thoughtful, and self-contained Lab viewport component for FlowForge.
// Responsibilities:
// - Hosts simulation canvas (p5.js based lightweight particle/streamline layer)
// - Provides draggable control panel (parameters, play/pause, snapshot, export CSV)
// - Emits live readouts (Reynolds, avg velocity, pressure proxy)
// - Allows pausing / single-step and reset
// - Provides hooks for hosting different simulation "modes" (pipe, venturi, cylinder, open-channel)
// - Clean TypeScript, accessible controls, and comments for maintainability

import React, { useEffect, useRef, useState, useCallback } from 'react';
import p5 from 'p5';
import clsx from 'clsx';

type Mode = 'uniform' | 'venturi' | 'cylinder' | 'pipe-profile' | 'open-channel';

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  id: number;
};

const DEFAULT_WIDTH = 1100;
const DEFAULT_HEIGHT = 560;

// utility to download data as CSV
function downloadCSV(filename: string, rows: string[][]) {
  const content = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// simple UUID-like id for particles
let particleCounter = 0;

export default function LabViewport(): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const p5InstanceRef = useRef<p5 | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const simFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);

  // Simulation state
  const [mode, setMode] = useState<Mode>('uniform');
  const [running, setRunning] = useState<boolean>(true);
  const [width, setWidth] = useState<number>(DEFAULT_WIDTH);
  const [height, setHeight] = useState<number>(DEFAULT_HEIGHT);

  // physical parameters (user-manipulable)
  const [flowSpeed, setFlowSpeed] = useState<number>(1.2); // m/s, nominal
  const [viscosity, setViscosity] = useState<number>(1e-3); // Pa.s (water ~0.001)
  const [density, setDensity] = useState<number>(1000); // kg/m3
  const [pipeDiameter, setPipeDiameter] = useState<number>(0.2); // m
  const [reynoldsOverride, setReynoldsOverride] = useState<number | null>(null); // null = compute

  // UI toggles
  const [showStreamlines, setShowStreamlines] = useState<boolean>(true);
  const [particleCount, setParticleCount] = useState<number>(220);
  const [trailFade, setTrailFade] = useState<number>(0.08); // 0..1 alpha overwrite

  // readouts (derived)
  const [reynolds, setReynolds] = useState<number>(0);
  const [avgVelocity, setAvgVelocity] = useState<number>(0);
  const [pressureProxy, setPressureProxy] = useState<number>(0);

  // draggable position state for control panel
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelPos, setPanelPos] = useState<{ x: number; y: number }>({ x: 24, y: 24 });
  const draggingPanelRef = useRef<{ dragging: boolean; offsetX: number; offsetY: number }>({
    dragging: false,
    offsetX: 0,
    offsetY: 0,
  });

  // --- Simulation core (p5 sketch driver) ---
  const setupP5 = useCallback(() => {
    if (!canvasRef.current) return;
    // If there's an existing instance, clean up
    if (p5InstanceRef.current) {
      try {
        p5InstanceRef.current.remove();
      } catch {}
      p5InstanceRef.current = null;
    }

    const sketch = (s: p5) => {
      s.setup = () => {
        const canvas = s.createCanvas(width, height);
        canvas.parent(canvasRef.current!);
        s.pixelDensity(1);
        s.frameRate(60);

        // initialize particles
        particlesRef.current = [];
        for (let i = 0; i < particleCount; i++) {
          particlesRef.current.push(spawnParticle(s));
        }

        // initial timestamps
        lastTimestampRef.current = performance.now();
      };

      s.windowResized = () => {
        const container = containerRef.current;
        if (!container) return;
        // Try to fit within container while preserving aspect ratio
        const rect = container.getBoundingClientRect();
        const w = Math.max(320, Math.floor(Math.min(DEFAULT_WIDTH, rect.width - 16)));
        const h = Math.max(240, Math.floor(Math.min(DEFAULT_HEIGHT, rect.height - 120)));
        s.resizeCanvas(w, h);
      };

      s.draw = () => {
        // Basic pause support
        if (!running) {
          // still render a paused overlay so user sees it
          s.push();
          s.fill(0, 120);
          s.rect(0, 0, s.width, s.height);
          s.pop();
          return;
        }

        // Trail fade
        s.push();
        s.noStroke();
        s.fill(0, trailFade * 255);
        s.rect(0, 0, s.width, s.height);
        s.pop();

        // simulation step (very lightweight, not full CFD)
        const dt = 1 / (s.frameRate() || 60);
        stepParticles(s, dt);

        // render particles
        renderParticles(s);

        // draw apparatus overlay based on mode
        drawApparatusOverlay(s);

        // compute derived readouts periodically
        if ((s.frameCount & 3) === 0) {
          computeReadouts();
        }
      };

      s.mousePressed = () => {
        // If clicking on canvas, spawn local particle burst for visualization/testing
        for (let i = 0; i < 8; i++) {
          const p = spawnParticle(s, { x: s.mouseX, y: s.mouseY });
          particlesRef.current.push(p);
        }
      };

      s.doubleClicked = () => {
        // quick reset of particles
        particlesRef.current = [];
        for (let i = 0; i < particleCount; i++) particlesRef.current.push(spawnParticle(s));
      };
    };

    p5InstanceRef.current = new p5(sketch);
  }, [width, height, particleCount, running, trailFade]);

  // spawn a particle with optional position
  function spawnParticle(s?: p5, opts?: { x?: number; y?: number }): Particle {
    particleCounter += 1;
    const w = (s && s.width) || width;
    const h = (s && s.height) || height;
    const edge = Math.random();

    // spawn at left edge with vertical distribution, or at custom pos
    const x = opts?.x ?? -10 - Math.random() * 40;
    const y = opts?.y ?? Math.max(12, Math.min(h - 12, Math.random() * h));
    const baseV = flowSpeed * (0.7 + Math.random() * 0.6);

    return {
      x,
      y,
      vx: baseV,
      vy: (Math.random() - 0.5) * 0.05,
      life: 0,
      id: particleCounter,
    };
  }

  // very lightweight physics integrator for particles — not a CFD solver.
  function stepParticles(s: p5, dt: number) {
    const particles = particlesRef.current;
    const w = s.width;
    const h = s.height;

    // flow field influences — simple analytical approximations depending on mode
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      // compute local flow vector (u,v) from analytical field
      const local = computeFlowFieldAt(p.x, p.y, w, h);
      // apply viscous damping proportional to viscosity
      const damping = Math.exp(-viscosity * 200 * dt); // heuristic scale
      p.vx = p.vx * damping + (local.u - p.vx) * 0.08;
      p.vy = p.vy * damping + (local.v - p.vy) * 0.08;

      p.x += p.vx * dt * 60; // scale to pixels per frame
      p.y += p.vy * dt * 60;
      p.life += dt;

      // recycle particle if out of bounds or too old
      if (p.x > w + 40 || p.y < -40 || p.y > h + 40 || p.life > 18) {
        particles.splice(i, 1);
        particles.push(spawnParticle(s));
      }
    }
  }

  // compute flow field vector (u,v) at pixel coordinates (x,y)
  function computeFlowFieldAt(px: number, py: number, w: number, h: number) {
    // map pixel coords to normalized pipe domain [-1..1] x [0..1]
    const nx = (px / Math.max(1, w)) * 2 - 0.0;
    const ny = py / Math.max(1, h);

    // base uniform flow to the right
    let u = flowSpeed;
    let v = 0;

    // mode-specific perturbations (analytic approximations)
    if (mode === 'venturi') {
      // accelerate near center x region (simulate throat)
      const throatCenterX = 0.55 * w;
      const throatWidth = Math.max(60, Math.min(180, (1 / (pipeDiameter || 0.2)) * 24));
      const dx = px - throatCenterX;
      const throatEffect = Math.exp(-((dx * dx) / (2 * throatWidth * throatWidth)));
      // accelerate u and create slight vertical shear
      u = flowSpeed * (1 + 0.6 * throatEffect);
      v = (py - h / 2) * 0.0008 * throatEffect * -1;
    } else if (mode === 'cylinder') {
      // approximate potential flow around cylinder at center
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.max(24, Math.min(80, (pipeDiameter || 0.2) * 80));
      const dx = px - cx;
      const dy = py - cy;
      const rr = Math.sqrt(dx * dx + dy * dy);
      if (rr < r * 0.98) {
        // inside cylinder — near-zero velocity (solid body)
        u = 0;
        v = 0;
      } else {
        // potential flow approximation (uniform + dipole)
        const theta = Math.atan2(dy, dx);
        const factor = (r * r) / (rr * rr + 1e-9);
        // base uniform to right
        u = flowSpeed * (1 - factor * Math.cos(2 * theta));
        v = flowSpeed * (-factor * Math.sin(2 * theta)) * 0.6;
        // add small wake randomization downstream
        if (dx > 0 && Math.abs(dy) < r * 2) {
          u *= 0.85;
          v += (Math.random() - 0.5) * 0.03 * (r / 40);
        }
      }
    } else if (mode === 'pipe-profile') {
      // parabolic laminar profile across vertical axis (ny)
      const radius = h * 0.45;
      const centerY = h / 2;
      const rLocal = Math.abs(py - centerY);
      const uMax = flowSpeed * 1.2;
      u = uMax * (1 - (rLocal * rLocal) / (radius * radius));
      u = Math.max(0.02, u);
    } else if (mode === 'open-channel') {
      // open-channel shallow flow with free surface near top
      const depth = h * 0.8;
      const surface = h * 0.12;
      // shallower near the surface, faster at surface
      const relY = (h - py) / h;
      u = flowSpeed * (0.5 + 0.9 * relY);
      v = 0;
    }

    // convert to pixel-space approximate velocities
    // u/v represent m/s; scale to small pixel velocities
    // The step integrator multiplies by dt*60 to convert to pixels/frame.
    return { u: u * 0.9, v: v * 0.9 };
  }

  // rendering routine for particles / streamlines
  function renderParticles(s: p5) {
    const particles = particlesRef.current;
    s.push();
    // blend mode for nicer trails
    s.blendMode(s.ADD);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const ageFactor = Math.min(1, Math.max(0, 1 - p.life * 0.06));
      const size = 1.6 + 2.6 * (1 - ageFactor);
      const alpha = Math.round(120 * ageFactor);

      // color mapping by speed
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      // hue mapping: slow=azure, fast=coral
      const t = Math.min(1, Math.max(0, (speed - 0.2) / 3.0));
      const r = Math.round(0 + (255 - 0) * t * 0.9);
      const g = Math.round(180 + (122 - 180) * t * 0.6);
      const b = Math.round(216 - 140 * t);

      s.noStroke();
      s.fill(r, g, b, alpha);
      s.ellipse(p.x, p.y, size, size);

      // optional trailing line
      if (showStreamlines && i % 3 === 0) {
        s.stroke(r, g, b, Math.floor(alpha * 0.2));
        s.strokeWeight(1);
        const prevX = p.x - p.vx * 0.9;
        const prevY = p.y - p.vy * 0.9;
        s.line(prevX, prevY, p.x, p.y);
      }
    }
    s.pop();
  }

  // draws apparatus overlay: pipe walls, venturi shape, cylinder, axes labels
  function drawApparatusOverlay(s: p5) {
    s.push();
    s.noFill();
    s.strokeWeight(2);
    s.stroke(255, 255, 255, 20);

    const w = s.width;
    const h = s.height;

    // base bounding rectangle
    s.stroke(255, 255, 255, 16);
    s.rect(6, 6, w - 12, h - 12, 12);

    if (mode === 'venturi') {
      // draw venturi shape
      const throatW = Math.max(40, Math.floor(w * (pipeDiameter / 1.0) * 0.4));
      const leftX = w * 0.12;
      const rightX = w * 0.88;
      const centerY = h / 2;
      s.stroke(255, 255, 255, 28);
      s.fill(0, 0, 0, 0);
      s.beginShape();
      s.vertex(leftX, centerY - h * 0.22);
      s.bezierVertex(w * 0.36, centerY - h * 0.22, w * 0.44, centerY - h * 0.12, w * 0.56, centerY - h * 0.12);
      s.vertex(w * 0.56, centerY - h * 0.12);
      s.bezierVertex(w * 0.66, centerY - h * 0.12, rightX, centerY - h * 0.22, rightX, centerY - h * 0.22);
      s.vertex(rightX, centerY + h * 0.22);
      s.bezierVertex(w * 0.66, centerY + h * 0.22, w * 0.56, centerY + h * 0.12, w * 0.44, centerY + h * 0.12);
      s.vertex(w * 0.44, centerY + h * 0.12);
      s.bezierVertex(w * 0.36, centerY + h * 0.12, leftX, centerY + h * 0.22, leftX, centerY + h * 0.22);
      s.endShape(s.CLOSE);

      // throat marker
      s.stroke(255, 200);
      s.line(w * 0.52, centerY - h * 0.28, w * 0.52, centerY + h * 0.28);
    } else if (mode === 'cylinder') {
      // center circle
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.max(24, Math.min(80, (pipeDiameter || 0.2) * 80));
      s.stroke(255, 255, 255, 36);
      s.fill(6, 12, 22, 220);
      s.circle(cx, cy, r * 2);
      // small arrow for flow direction
      s.stroke(255, 255, 255, 70);
      s.strokeWeight(2);
      s.line(12, cy, 60, cy);
      s.triangle(60, cy - 6, 60, cy + 6, 70, cy);
    } else if (mode === 'pipe-profile') {
      // pipe boundaries horizontally centered
      const cx = w / 2;
      const radius = Math.max(24, Math.min(h * 0.45, 200));
      s.stroke(255, 255, 255, 36);
      s.noFill();
      s.rect(12, (h - radius * 2) / 2, w - 24, radius * 2, 16);
      // centerline
      s.stroke(255, 255, 255, 14);
      s.line(12, h / 2, w - 12, h / 2);
    } else if (mode === 'open-channel') {
      // free-surface at top quarter
      s.stroke(255, 255, 255, 22);
      s.fill(6, 12, 22, 40);
      const surfaceY = h * 0.18;
      s.rect(12, surfaceY, w - 24, h - surfaceY - 12, 10);
      s.stroke(255, 255, 255, 60);
      s.line(12, surfaceY, w - 12, surfaceY);
    } else {
      // uniform - base flow arrows
      const cy = h / 2;
      s.stroke(255, 255, 255, 22);
      for (let x = 20; x < w - 20; x += 60) {
        s.line(x, cy - 20, x + 32, cy - 20);
        s.triangle(x + 32, cy - 26, x + 32, cy - 14, x + 40, cy - 20);
      }
    }

    s.pop();
  }

  // compute derived readouts
  function computeReadouts() {
    // Reynolds number (Re = rho * V * D / mu)
    const D = pipeDiameter; // user parameter (m)
    const V = flowSpeed;
    const rho = density;
    const mu = viscosity;
    const Re = reynoldsOverride ?? Math.max(1, (rho * V * (D || 0.001)) / (mu || 1e-6));
    setReynolds(Math.round(Re));
    setAvgVelocity(Number(V.toFixed(3)));

    // pressure proxy: dynamic pressure q = 0.5 * rho * V^2 (Pa) -> convert to kPa
    const q = 0.5 * rho * V * V;
    setPressureProxy(Number((q / 1000).toFixed(3)));
  }

  // snapshot: capture canvas as PNG blob and trigger download
  async function snapshot() {
    const inst = p5InstanceRef.current;
    if (!inst) return;
    const canvas = inst.canvas as HTMLCanvasElement;
    try {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve as any));
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flowforge_snapshot_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      // fallback: use dataURL
      const data = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = data;
      a.download = `flowforge_snapshot_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }

  // export logged particle data as CSV (positions, velocities)
  function exportCSV() {
    const header = ['id', 'x_px', 'y_px', 'vx', 'vy', 'life'];
    const rows = [header];
    for (const p of particlesRef.current.slice(0, 1000)) {
      rows.push([p.id, p.x.toFixed(3), p.y.toFixed(3), p.vx.toFixed(6), p.vy.toFixed(6), p.life.toFixed(3)]);
    }
    downloadCSV(`flowforge_particles_${Date.now()}.csv`, rows);
  }

  // reset simulation to initial state
  function resetSim() {
    const inst = p5InstanceRef.current;
    particlesRef.current = [];
    if (inst) {
      for (let i = 0; i < particleCount; i++) {
        particlesRef.current.push(spawnParticle(inst));
      }
    }
    // quick recompute
    computeReadouts();
  }

  // toggle run/pause
  function toggleRun() {
    setRunning(v => !v);
  }

  // resize observer to adapt canvas
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        setWidth(Math.max(320, Math.floor(cr.width - 0)));
        setHeight(Math.max(240, Math.floor(cr.height - 80)));
        // resize handled by p5.windowResized
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // initialize p5 instance once
  useEffect(() => {
    setupP5();
    return () => {
      if (p5InstanceRef.current) {
        try {
          p5InstanceRef.current.remove();
        } catch {}
        p5InstanceRef.current = null;
      }
    };
    // intentionally exclude dependencies to create once on mount; dynamic updates handled by refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // handle panel dragging (mouse)
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingPanelRef.current.dragging) return;
      const nx = e.clientX - draggingPanelRef.current.offsetX;
      const ny = e.clientY - draggingPanelRef.current.offsetY;
      setPanelPos({ x: Math.max(8, nx), y: Math.max(8, ny) });
    };
    const onUp = () => {
      draggingPanelRef.current.dragging = false;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  // attach position style updates to panel element
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    el.style.left = `${panelPos.x}px`;
    el.style.top = `${panelPos.y}px`;
  }, [panelPos]);

  // recompute Reynolds when physical params change
  useEffect(() => {
    computeReadouts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowSpeed, viscosity, density, pipeDiameter, reynoldsOverride]);

  // when particleCount changes, reinitialize some particles
  useEffect(() => {
    const inst = p5InstanceRef.current;
    if (!inst) return;
    const arr: Particle[] = [];
    for (let i = 0; i < particleCount; i++) arr.push(spawnParticle(inst));
    particlesRef.current = arr;
  }, [particleCount]);

  // when mode or pipeDiameter changed - slight visual reset
  useEffect(() => {
    resetSim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pipeDiameter]);

  // Render: main viewport + draggable control panel + readouts
  return (
    <div ref={containerRef} className="relative w-full h-[640px] rounded-xl overflow-hidden card">
      {/* Canvas host */}
      <div ref={canvasRef} className="sim-canvas w-full h-full relative" aria-label="Simulation canvas" />

      {/* Top-right readouts */}
      <div className="absolute right-6 top-6 flex flex-col gap-2 z-40">
        <div className="readout">
          <div className="label">Re</div>
          <div className="value">{reynolds.toLocaleString()}</div>
        </div>
        <div className="readout">
          <div className="label">Avg V (m/s)</div>
          <div className="value">{avgVelocity}</div>
        </div>
        <div className="readout">
          <div className="label">q (kPa)</div>
          <div className="value">{pressureProxy}</div>
        </div>
      </div>

      {/* Draggable control panel */}
      <div
        ref={panelRef}
        className={clsx('draggable panel-glass z-50')}
        style={{ width: 360, left: panelPos.x, top: panelPos.y }}
        role="dialog"
        aria-label="Simulation controls"
      >
        <div
          className="panel-header"
          onMouseDown={e => {
            // start dragging (but do not capture if clicking an interactive control)
            // ignore if target is an input / button
            const target = e.target as HTMLElement;
            if (['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'LABEL'].includes(target.tagName)) return;
            draggingPanelRef.current.dragging = true;
            const rect = panelRef.current?.getBoundingClientRect();
            draggingPanelRef.current.offsetX = e.clientX - (rect?.left ?? 0);
            draggingPanelRef.current.offsetY = e.clientY - (rect?.top ?? 0);
          }}
        >
          <div>
            <div className="panel-title">Experiment Controls</div>
            <div className="text-xs muted">Mode: {mode}</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="btn btn-ghost"
              onClick={() => {
                resetSim();
              }}
              title="Reset simulation"
              aria-label="Reset simulation"
            >
              Reset
            </button>

            <button
              className="btn btn-primary"
              onClick={() => {
                toggleRun();
              }}
              aria-pressed={!running}
              title={running ? 'Pause' : 'Play'}
            >
              {running ? 'Pause' : 'Play'}
            </button>
          </div>
        </div>

        {/* controls body */}
        <div className="grid grid-cols-1 gap-3">
          <div className="text-xs muted">Experiment</div>
          <div className="flex gap-2">
            <select
              value={mode}
              onChange={e => setMode(e.target.value as Mode)}
              className="bg-transparent border border-white/6 rounded px-2 py-1 text-sm w-full"
            >
              <option value="uniform">Uniform Flow</option>
              <option value="venturi">Venturi Meter</option>
              <option value="cylinder">Flow around Cylinder</option>
              <option value="pipe-profile">Pipe Velocity Profile</option>
              <option value="open-channel">Open Channel</option>
            </select>
          </div>

          {/* physical sliders */}
          <div>
            <label className="text-xs muted">Flow speed (m/s): {flowSpeed.toFixed(2)}</label>
            <input
              type="range"
              min="0.05"
              max="6"
              step="0.01"
              value={flowSpeed}
              onChange={e => setFlowSpeed(Number(e.target.value))}
              aria-label="Flow speed"
            />
          </div>

          <div>
            <label className="text-xs muted">Viscosity (Pa·s): {viscosity.toExponential(2)}</label>
            <input
              type="range"
              min="0.0001"
              max="0.02"
              step="0.0001"
              value={viscosity}
              onChange={e => setViscosity(Number(e.target.value))}
              aria-label="Viscosity"
            />
          </div>

          <div>
            <label className="text-xs muted">Density (kg/m³): {density}</label>
            <input
              type="range"
              min="200"
              max="2000"
              step="10"
              value={density}
              onChange={e => setDensity(Number(e.target.value))}
              aria-label="Density"
            />
          </div>

          <div>
            <label className="text-xs muted">Characteristic diameter (m): {pipeDiameter.toFixed(3)}</label>
            <input
              type="range"
              min="0.01"
              max="1.2"
              step="0.005"
              value={pipeDiameter}
              onChange={e => setPipeDiameter(Number(e.target.value))}
              aria-label="Pipe diameter"
            />
          </div>

          <div>
            <label className="text-xs muted">Particles: {particleCount}</label>
            <input
              type="range"
              min="32"
              max="1000"
              step="1"
              value={particleCount}
              onChange={e => setParticleCount(Number(e.target.value))}
              aria-label="Particle count"
            />
          </div>

          <div>
            <label className="text-xs muted">Trail fade (0-1): {trailFade.toFixed(2)}</label>
            <input
              type="range"
              min="0"
              max="0.3"
              step="0.005"
              value={trailFade}
              onChange={e => setTrailFade(Number(e.target.value))}
              aria-label="Trail fade"
            />
          </div>

          <div className="flex gap-2 items-center">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showStreamlines}
                onChange={e => setShowStreamlines(e.target.checked)}
                aria-label="Show streamlines"
              />
              <span className="text-xs muted">Show streamlines</span>
            </label>

            <button
              className="btn btn-ghost"
              onClick={() => {
                snapshot();
              }}
            >
              Snapshot
            </button>

            <button
              className="btn btn-ghost"
              onClick={() => {
                exportCSV();
              }}
            >
              Export CSV
            </button>
          </div>

          <div className="text-[11px] muted">
            Tip: Drag the control panel by its header. Double-click the canvas to reseed particles.
          </div>
        </div>
      </div>
    </div>
  );
}
