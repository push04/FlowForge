// src/pages/Lab.tsx
// Detailed Lab page that wraps the simulation viewport and provides:
// - Live charts (Reynolds, Avg Velocity, Dynamic Pressure) using react-chartjs-2
// - Global event listeners to respond to Topbar actions (snapshot, export CSV, toggle run)
// - Polling fallback to extract readouts from LabViewport's DOM (robust even if LabViewport doesn't expose a JS API)
// - CSV logging of time-series data and CSV export
// - Snapshot capture from the embedded p5 canvas
// - Experiment instructions, theory panel, and data export UI
//
// Notes & Rationale:
// - LabViewport draws readouts in the DOM (class "readout") — this page polls those elements periodically
//   to gather live values without requiring tight coupling. If you later add explicit events from
//   LabViewport (e.g., dispatching 'flowforge:readout' CustomEvent), this page will also listen to that.
// - Snapshot/expor-csv actions will attempt to find the p5 canvas inside the viewport and operate on it.
// - Charts are intentionally light-weight and decoupled: the logged series are stored in local state and can be
//   exported as CSV for lab reports.
// - Uses TypeScript and react-chartjs-2. Make sure `chart.js` and `react-chartjs-2` are installed.
//
// Accessibility & UX:
// - All buttons have ARIA labels and keyboard-accessible handlers.
// - The UI is split into three columns on wide screens: left (nav/instructions), center (sim), right (graphs & data).
// - The polling interval is modest (500ms) to balance responsiveness and CPU usage.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';
import clsx from 'clsx';
import LabViewport from '@/components/LabViewport';

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend);

type Readout = {
  ts: number; // epoch ms
  re: number;
  v: number; // avg velocity m/s
  q: number; // dynamic pressure (kPa)
};

const POLL_INTERVAL = 500; // ms

export default function Lab(): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const [log, setLog] = useState<Readout[]>([]);
  const [running, setRunning] = useState<boolean>(true);

  // small UI state
  const [autoLog, setAutoLog] = useState<boolean>(true);
  const [logIntervalMs, setLogIntervalMs] = useState<number>(1000); // not the same as POLL_INTERVAL; controls when to record into series
  const lastLogTimeRef = useRef<number>(0);

  // ---- Helpers to read live values from LabViewport DOM ----
  // LabViewport places three .readout blocks; this tries to robustly find them and parse numbers.
  const readFromDOM = useCallback((): Readout | null => {
    try {
      // containerRef points to wrapper that contains LabViewport; find elements with class .readout within it.
      const root = containerRef.current;
      if (!root) return null;
      const readouts = Array.from(root.querySelectorAll('.readout'));
      // fallback: query based on labels text
      let reVal: number | null = null;
      let vVal: number | null = null;
      let qVal: number | null = null;

      for (const el of readouts) {
        const label = (el.querySelector('.label')?.textContent || '').trim().toLowerCase();
        const valueText = (el.querySelector('.value')?.textContent || el.textContent || '').trim();
        if (!valueText) continue;

        // normalize numbers (commas etc)
        const num = Number(valueText.replace(/,/g, '').replace(/[^\d.\-e]/g, ''));
        if (label.includes('re')) {
          if (!Number.isNaN(num)) reVal = num;
        } else if (label.includes('avg') || label.includes('v (m/s)') || label.includes('avg v')) {
          if (!Number.isNaN(num)) vVal = num;
        } else if (label.includes('q') || label.includes('kpa') || label.includes('pressure')) {
          if (!Number.isNaN(num)) qVal = num;
        } else {
          // attempt to heuristically assign based on order if label not clear
          if (reVal === null) reVal = !Number.isNaN(num) ? num : reVal;
          else if (vVal === null) vVal = !Number.isNaN(num) ? num : vVal;
          else if (qVal === null) qVal = !Number.isNaN(num) ? num : qVal;
        }
      }

      // if no .readout nodes (older LabViewport), attempt to find known IDs or textual nodes
      // Final checks: if we have at least one number, synthesize missing ones as 0 to keep structure
      if (reVal === null && vVal === null && qVal === null) {
        return null;
      }

      return {
        ts: Date.now(),
        re: reVal ?? 0,
        v: vVal ?? 0,
        q: qVal ?? 0,
      };
    } catch (e) {
      return null;
    }
  }, []);

  // ---- Optional explicit event listener (if LabViewport dispatches readouts) ----
  useEffect(() => {
    const handler = (ev: Event) => {
      const ce = ev as CustomEvent;
      const d = ce.detail;
      if (!d) return;
      if (typeof d.re !== 'number' || typeof d.v !== 'number' || typeof d.q !== 'number') return;
      const entry: Readout = { ts: Date.now(), re: d.re, v: d.v, q: d.q };
      setLog(prev => {
        const next = [...prev, entry].slice(-9000); // cap to avoid memory bloat
        return next;
      });
    };
    window.addEventListener('flowforge:readout' as any, handler as EventListener);
    return () => window.removeEventListener('flowforge:readout' as any, handler as EventListener);
  }, []);

  // ---- Polling + auto-log ----
  useEffect(() => {
    let mounted = true;
    let pollTimer: number | null = null;

    const poll = async () => {
      if (!mounted) return;
      // Try DOM read first
      const read = readFromDOM();
      if (read) {
        // When autoLog is enabled, push into series at configured intervals
        const now = Date.now();
        if (!autoLog || now - lastLogTimeRef.current >= logIntervalMs) {
          lastLogTimeRef.current = now;
          setLog(prev => {
            const next = [...prev, read].slice(-9000);
            return next;
          });
        }
      } else {
        // if readFromDOM failed, leave as-is; optionally could show a notice
      }
      pollTimer = window.setTimeout(poll, POLL_INTERVAL);
    };

    poll();
    return () => {
      mounted = false;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [autoLog, logIntervalMs, readFromDOM]);

  // ---- Chart data derivation ----
  const chartData = useMemo(() => {
    const labels = log.map(r => new Date(r.ts).toLocaleTimeString());
    return {
      labels,
      datasets: [
        {
          label: 'Reynolds (Re)',
          data: log.map(r => r.re),
          tension: 0.2,
          borderWidth: 2,
          yAxisID: 'y1',
          pointRadius: 0.6,
        },
        {
          label: 'Avg Velocity (m/s)',
          data: log.map(r => r.v),
          tension: 0.2,
          borderWidth: 2,
          yAxisID: 'y2',
          pointRadius: 0.6,
        },
        {
          label: 'Dynamic Pressure q (kPa)',
          data: log.map(r => r.q),
          tension: 0.2,
          borderWidth: 2,
          yAxisID: 'y3',
          pointRadius: 0.6,
        },
      ],
    };
  }, [log]);

  const chartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index' as const,
        intersect: false,
      },
      plugins: {
        legend: { position: 'top' as const },
        tooltip: { enabled: true, mode: 'index' as const },
      },
      scales: {
        x: { display: true },
        y1: {
          type: 'linear' as const,
          display: true,
          position: 'left' as const,
          ticks: { callback: (val: any) => `${Math.round(Number(val))}` },
        },
        y2: {
          type: 'linear' as const,
          display: true,
          position: 'right' as const,
          grid: { drawOnChartArea: false },
          ticks: { callback: (val: any) => `${Number(val).toFixed(2)}` },
        },
        y3: {
          type: 'linear' as const,
          display: false,
          position: 'right' as const,
          grid: { drawOnChartArea: false },
        },
      },
    };
  }, []);

  // ---- Snapshot utility (captures p5 canvas inside the viewport) ----
  const takeSnapshot = useCallback(async () => {
    try {
      // find canvas element within containerRef
      const root = containerRef.current;
      if (!root) throw new Error('Snapshot: canvas root not found');
      // p5 creates a canvas element (HTMLCanvasElement); search for first canvas descendant
      const canvas = root.querySelector('canvas') as HTMLCanvasElement | null;
      if (!canvas) throw new Error('Snapshot: canvas element not found');
      // convert to blob and trigger download
      const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve as any));
      if (!blob) throw new Error('Snapshot: toBlob failed');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flowforge_snapshot_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      // graceful fallback: try window.print on canvas data URL (not ideal)
      console.error('Snapshot failed:', err);
      alert('Snapshot failed. Make sure the simulation is visible and try again.');
    }
  }, []);

  // ---- Export CSV utility (export logged time-series) ----
  const exportCSV = useCallback(() => {
    if (log.length === 0) {
      alert('No data logged yet. Enable auto-log or interact with the simulation to collect data.');
      return;
    }
    const rows = [
      ['timestamp_iso', 'timestamp_ms', 're', 'avg_velocity_m_s', 'dynamic_pressure_kpa'],
      ...log.map(r => [new Date(r.ts).toISOString(), r.ts.toString(), r.re.toString(), r.v.toString(), r.q.toString()]),
    ];
    const csvContent = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flowforge_log_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [log]);

  // ---- Global event listeners (Topbar dispatches these) ----
  useEffect(() => {
    const onSnapshot = () => {
      takeSnapshot();
    };
    const onExport = () => {
      exportCSV();
    };
    const onToggleRun = (ev: Event) => {
      // Topbar sends desired running state; if not, toggle local state
      const ce = ev as CustomEvent;
      const desired = ce?.detail?.running;
      setRunning(prev => {
        const next = typeof desired === 'boolean' ? desired : !prev;
        // Emit a DOM event so LabViewport (if listening) can toggle
        window.dispatchEvent(new CustomEvent('flowforge:request-toggle-run', { detail: { running: next } }));
        return next;
      });
    };

    window.addEventListener('flowforge:snapshot' as any, onSnapshot as EventListener);
    window.addEventListener('flowforge:export-csv' as any, onExport as EventListener);
    window.addEventListener('flowforge:toggle-run' as any, onToggleRun as EventListener);

    return () => {
      window.removeEventListener('flowforge:snapshot' as any, onSnapshot as EventListener);
      window.removeEventListener('flowforge:export-csv' as any, onExport as EventListener);
      window.removeEventListener('flowforge:toggle-run' as any, onToggleRun as EventListener);
    };
  }, [takeSnapshot, exportCSV]);

  // ---- Quick controls for user (clear log, download subset) ----
  function clearLog() {
    if (!confirm('Clear logged data? This cannot be undone.')) return;
    setLog([]);
  }

  // ---- Small convenience: allow manual scraping snapshot/export buttons in UI ----
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_420px] gap-4" ref={containerRef}>
      {/* Left: experiment instructions / theory */}
      <aside className="card p-4">
        <h2 className="text-lg font-semibold">Experiment: Live Lab</h2>
        <p className="text-sm muted mt-1">
          This interactive lab lets you run multiple experiments (Venturi, Cylinder, Pipe profile, Open channel).
          Use the floating control panel on the simulation to change flow speed, viscosity, density and more.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <h4 className="text-sm font-medium">Objective</h4>
            <p className="text-xs muted mt-1">Visualize flow and capture readouts (Re, velocity, dynamic pressure).</p>
          </div>

          <div>
            <h4 className="text-sm font-medium">Theory (quick)</h4>
            <p className="text-xs muted mt-1">
              Reynolds number: <code>Re = ρ V D / μ</code>. Dynamic pressure: <code>q = 0.5 ρ V²</code>.
              When Re &lt; ~2300 flow tends to be laminar; when Re &gt; ~4000 flow is typically turbulent.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-medium">Procedure</h4>
            <ol className="text-xs muted list-decimal list-inside mt-1 space-y-1">
              <li>Choose experiment mode from the floating panel.</li>
              <li>Adjust Flow speed, Viscosity, Density and Diameter.</li>
              <li>Enable auto-log or click 'Log now'.</li>
              <li>Snapshot the canvas and export CSV for your lab report.</li>
            </ol>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <button
            className="btn btn-primary"
            onClick={() => {
              // scroll to center sim
              const el = containerRef.current?.querySelector('.sim-canvas') as HTMLElement | null;
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
          >
            Focus Simulation
          </button>

          <button
            className="btn btn-ghost"
            onClick={() => {
              // manual immediate read & log
              const r = readFromDOM();
              if (r) {
                setLog(prev => [...prev, r]);
              } else {
                alert('No readout found. Make sure the simulation is visible.');
              }
            }}
          >
            Log now
          </button>

          <div className="flex items-center gap-2 mt-2">
            <label className="text-xs muted flex items-center gap-2">
              <input type="checkbox" checked={autoLog} onChange={e => setAutoLog(e.target.checked)} />
              Auto-log
            </label>
            <div className="text-xs muted ml-auto">Interval (ms)</div>
            <input
              type="number"
              min={250}
              max={5000}
              step={250}
              value={logIntervalMs}
              onChange={e => setLogIntervalMs(Number(e.target.value))}
              className="w-24 bg-[#071224] border border-white/6 rounded px-2 py-1 text-xs"
            />
          </div>
        </div>
      </aside>

      {/* Center: Simulation viewport */}
      <section className="card p-3 relative" style={{ minHeight: 520 }} aria-label="Lab simulation">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold">Simulation</h3>
            <div className="text-xs muted">Interactive viewport — use floating controls to interact.</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="btn btn-ghost"
              onClick={() => {
                // request toggle-run event to be dispatched (handled by this page to propagate)
                window.dispatchEvent(new CustomEvent('flowforge:toggle-run', { detail: { running: !running } }));
              }}
            >
              {running ? 'Pause (Global)' : 'Play (Global)'}
            </button>

            <button
              className="btn btn-ghost"
              onClick={() => {
                takeSnapshot();
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
        </div>

        <div ref={canvasHostRef} className="rounded-lg overflow-hidden border border-white/6" style={{ height: 420 }}>
          {/* LabViewport contains the p5 canvas and floating control panel */}
          <LabViewport />
        </div>

        {/* Graph dock (minimap + quick readout badges) */}
        <div className="graph-dock mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="text-xs muted">Latest:</div>
            <div className="readout">
              <div className="label">Re</div>
              <div className="value">{log.length ? log[log.length - 1].re.toLocaleString() : '—'}</div>
            </div>
            <div className="readout">
              <div className="label">V (m/s)</div>
              <div className="value">{log.length ? log[log.length - 1].v : '—'}</div>
            </div>
            <div className="readout">
              <div className="label">q (kPa)</div>
              <div className="value">{log.length ? log[log.length - 1].q : '—'}</div>
            </div>
          </div>

          <div className="text-xs muted">Auto-logging: {autoLog ? `ON • ${logIntervalMs}ms` : 'OFF'}</div>
        </div>
      </section>

      {/* Right: Charts, log list, and export controls */}
      <aside className="card p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Live charts & data</h3>
          <div className="text-xs muted">{log.length} points</div>
        </div>

        <div className="mt-3" style={{ height: 260 }}>
          <Line data={chartData} options={chartOptions as any} />
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <button className="btn btn-primary" onClick={() => exportCSV()}>
              Export CSV
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                // export visible subset (last 50)
                const subset = log.slice(-50);
                if (subset.length === 0) return alert('No data to export.');
                const rows = [
                  ['timestamp_iso', 'timestamp_ms', 're', 'avg_velocity_m_s', 'dynamic_pressure_kpa'],
                  ...subset.map(r => [new Date(r.ts).toISOString(), r.ts.toString(), r.re.toString(), r.v.toString(), r.q.toString()]),
                ];
                const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `flowforge_log_last50_${Date.now()}.csv`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
              }}
            >
              Export last 50
            </button>

            <button
              className="btn btn-ghost"
              onClick={() => {
                clearLog();
              }}
            >
              Clear log
            </button>
          </div>

          <div className="mt-2 text-xs muted">
            Tip: Use Snapshot + Export CSV together to prepare figures for lab reports. Files download directly from the browser — no server required.
          </div>
        </div>

        {/* Log table (compact) */}
        <div className="mt-4 max-h-40 overflow-auto text-xs">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs muted">
                <th className="pr-2">Time</th>
                <th className="pr-2">Re</th>
                <th className="pr-2">V (m/s)</th>
                <th>q (kPa)</th>
              </tr>
            </thead>
            <tbody>
              {log.slice(-20).reverse().map((r, i) => (
                <tr key={r.ts + '-' + i} className="border-t border-white/6">
                  <td className="pr-2">{new Date(r.ts).toLocaleTimeString()}</td>
                  <td className="pr-2">{r.re}</td>
                  <td className="pr-2">{r.v}</td>
                  <td>{r.q}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </aside>
    </div>
  );
}
