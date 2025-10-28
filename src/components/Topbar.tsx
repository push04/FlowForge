// src/components/Topbar.tsx
// A detailed, feature-rich top navigation bar for FlowForge.
// Responsibilities:
// - Global controls: Play/Pause all simulations, Reset, Snapshot, Export CSV
// - Quick experiment search / selector
// - Theme toggle (dark/light) and accessibility toggles
// - Compact user/menu area (profile placeholder, settings modal trigger)
// - Keyboard shortcuts help
//
// Notes:
// - This component uses minimal external deps (React + simple SVG icons).
// - It references a `useLabStore` Zustand store (to be implemented later) for global simulation state.
// - Snapshot/export functions assume experiment canvas elements expose `data-canvas-id` attributes
//   or that the active experiment registers a callback via `window.flowforgeSnapshotHandlers`.
// - Keyboard shortcuts implemented: Space (Play/Pause), r (Reset), s (Snapshot), e (Export CSV), / (Focus search).
//
// Accessibility:
// - All buttons have aria-labels, keyboard accessible, visible focus styling via global CSS.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

// Placeholder for the global lab store (Zustand) — actual store file to be provided later.
import { useLabStore } from '@/state/labStore'; // create this file later

// Simple small inline SVG icons to avoid adding icon libs
const IconPlay = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M8 5v14l11-7L8 5z" fill="currentColor" />
  </svg>
);
const IconPause = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor" />
  </svg>
);
const IconCamera = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM21 7h-3.2l-1.8-2H8L6.2 7H3v12h18V7z" fill="currentColor"/>
  </svg>
);
const IconDownload = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M12 3v10m0 0l4-4m-4 4l-4-4M21 21H3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconReset = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M21 12a9 9 0 10-2.6 6.01L21 21l-1.8-3.6A9 9 0 0021 12z" fill="currentColor" />
  </svg>
);
const IconSearch = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconHelp = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M11 18h2v-2h-2v2zM12 6a6 6 0 100 12 6 6 0 000-12zm0 0v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

type QuickPreset = {
  id: string;
  label: string;
  description?: string;
  params: Record<string, number | string>;
};

export default function Topbar(): JSX.Element {
  // Lab store: playing state, activeExperimentId, and simple controls
  const playing = useLabStore((s) => s.playing);
  const setPlaying = useLabStore((s) => s.setPlaying);
  const resetAll = useLabStore((s) => s.resetAll);
  const activeExperiment = useLabStore((s) => s.activeExperimentId);
  const exportCSVCallback = useLabStore((s) => s.exportCSV); // optional callback in store

  // Local UI state
  const [search, setSearch] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [presets] = useState<QuickPreset[]>(() => [
    {
      id: 'laminar-fast',
      label: 'Laminar — Fast Flow',
      description: 'Low viscosity, moderate diameter',
      params: { velocity: 1.4, viscosity: 0.001, diameter: 0.02 },
    },
    {
      id: 'turbulent-high',
      label: 'Turbulent — High Re',
      description: 'High velocity, low viscosity',
      params: { velocity: 5.2, viscosity: 0.00089, diameter: 0.05 },
    },
    {
      id: 'viscous-honey',
      label: 'Viscous — Honey-like',
      description: 'High viscosity scenario',
      params: { velocity: 0.2, viscosity: 2.0, density: 1400 },
    },
  ]);
  const searchRef = useRef<HTMLInputElement | null>(null);

  // ---- Keyboard shortcuts ----
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      // ignore keybindings while typing in inputs (unless it's the slash which focuses search)
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
        if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          searchRef.current?.focus();
        }
        return;
      }

      if (e.key === ' ' && !e.metaKey && !e.ctrlKey) {
        // Space toggles play/pause
        e.preventDefault();
        setPlaying(!playing);
      } else if (e.key === 'r' || e.key === 'R') {
        // Reset all experiments
        e.preventDefault();
        resetAll();
      } else if (e.key === 's' || e.key === 'S') {
        // Snapshot
        e.preventDefault();
        snapshotActive();
      } else if (e.key === 'e' || e.key === 'E') {
        // Export CSV
        e.preventDefault();
        exportCSV();
      } else if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        // Show shortcuts
        e.preventDefault();
        setShowShortcuts((v) => !v);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [playing]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  // ---- Snapshot helper ----
  // Snapshot strategy:
  // 1) If window.flowforgeSnapshotHandlers[activeId] exists, call it to get Blob/dataURL
  // 2) Otherwise, fallback: find a canvas[data-canvas-id="{activeId}"] and toDataURL()
  async function snapshotActive() {
    try {
      const handlers: Record<string, () => Promise<Blob | string> | (Blob | string)> =
        (window as any).flowforgeSnapshotHandlers ?? {};
      let out: Blob | string | null = null;

      if (activeExperiment && handlers[activeExperiment]) {
        const result = handlers[activeExperiment]();
        out = result instanceof Promise ? await result : result;
      } else {
        // fallback to canvas element scan
        const selector = activeExperiment ? `canvas[data-canvas-id="${activeExperiment}"]` : 'canvas.sim-canvas';
        const canvas = document.querySelector(selector) as HTMLCanvasElement | null;
        if (!canvas) throw new Error('No canvas found to snapshot');
        const url = canvas.toDataURL('image/png');
        out = url;
      }

      if (out instanceof Blob) {
        const url = URL.createObjectURL(out);
        triggerDownload(url, `flowforge-snapshot-${activeExperiment ?? 'global'}.png`);
        URL.revokeObjectURL(url);
      } else if (typeof out === 'string') {
        triggerDownload(out, `flowforge-snapshot-${activeExperiment ?? 'global'}.png`);
      } else {
        throw new Error('Snapshot handler returned unexpected type');
      }
    } catch (err) {
      console.error('Snapshot failed:', err);
      // show a small toast or console fallback (to be replaced with global toast)
      alert('Snapshot failed. Open console for details.');
    }
  }

  function triggerDownload(dataUrlOrUrl: string, filename: string) {
    // If it looks like a data URL, use it directly; otherwise fetch the resource
    if (dataUrlOrUrl.startsWith('data:')) {
      const a = document.createElement('a');
      a.href = dataUrlOrUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }

    // else treat as blob URL or normal URL
    const a = document.createElement('a');
    a.href = dataUrlOrUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // ---- CSV export helper ----
  function exportCSV() {
    try {
      // Prefer store-provided exporter
      if (exportCSVCallback) {
        exportCSVCallback();
        return;
      }

      // Otherwise attempt generic: look for table[data-exportable="true"] in the experiment panel
      const table = document.querySelector('table[data-exportable="true"]') as HTMLTableElement | null;
      if (!table) {
        alert('No exportable data found on the page.');
        return;
      }
      // Convert table to CSV
      const rows: string[] = [];
      const trList = Array.from(table.querySelectorAll('tr'));
      for (const tr of trList) {
        const cells = Array.from(tr.querySelectorAll('th, td')).map((cell) =>
          `"${(cell.textContent ?? '').replace(/"/g, '""').trim()}"`
        );
        rows.push(cells.join(','));
      }
      const csv = rows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `flowforge-data-${activeExperiment ?? 'export'}.csv`);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSV export failed', err);
      alert('Export failed. Check console for details.');
    }
  }

  // ---- Reset handler (with optional confirmation) ----
  function handleReset() {
    // small confirmation to avoid accidental resets
    if (!confirm('Reset all experiments to default parameters?')) return;
    resetAll();
  }

  // ---- Apply quick preset ----
  function applyPreset(p: QuickPreset) {
    // If the store exposes an applyParameters method, prefer that.
    const applyParams = (useLabStore as any).getState()?.applyParameters;
    if (applyParams) {
      applyParams(p.params);
    } else {
      // fallback: dispatch a simple event so experiments can listen
      window.dispatchEvent(new CustomEvent('flowforge-apply-preset', { detail: p.params }));
    }
  }

  // ---- Simple experiment search (client-side, light) ----
  // In the future this can be backed by an indexed search or API.
  const experimentsList = useLabStore((s) => s.experiments) ?? []; // [{ id, title, slug }]
  const filtered = experimentsList.filter((e: any) => {
    if (!search) return true;
    return `${e.title} ${e.slug}`.toLowerCase().includes(search.toLowerCase());
  });

  // ---- Small user menu state ----
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-[#0b1220] bg-gradient-to-b from-transparent to-transparent z-40">
      <div className="flex items-center gap-4 min-w-0">
        {/* Brand / mini logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#00b4d8] to-[#0077a3] flex items-center justify-center text-xs font-bold text-[#081521]">
            FF
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-semibold">FlowForge</div>
            <div className="text-xs muted">Virtual Fluid Lab</div>
          </div>
        </div>

        {/* Global controls */}
        <div className="flex items-center gap-2">
          <button
            aria-label={playing ? 'Pause simulations' : 'Play simulations'}
            className={clsx('btn', 'btn-ghost')}
            onClick={() => setPlaying(!playing)}
            title="Play / Pause (Space)"
          >
            {playing ? <IconPause /> : <IconPlay />}
            <span className="hidden sm:inline text-xs muted pl-1">{playing ? 'Pause' : 'Play'}</span>
          </button>

          <button aria-label="Reset experiments" className="btn btn-ghost" onClick={handleReset} title="Reset (R)">
            <IconReset />
            <span className="hidden sm:inline text-xs muted pl-1">Reset</span>
          </button>

          <button aria-label="Take snapshot" className="btn btn-ghost" onClick={snapshotActive} title="Snapshot (S)">
            <IconCamera />
            <span className="hidden sm:inline text-xs muted pl-1">Snapshot</span>
          </button>

          <button aria-label="Export CSV" className="btn btn-ghost" onClick={exportCSV} title="Export (E)">
            <IconDownload />
            <span className="hidden sm:inline text-xs muted pl-1">Export</span>
          </button>
        </div>
      </div>

      {/* Middle area: quick search / experiment selector */}
      <div className="flex-1 px-4 max-w-2xl">
        <div className="relative">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <IconSearch />
          </div>
          <input
            ref={searchRef}
            aria-label="Search experiments"
            placeholder="Search experiments, e.g. Venturi, Bernoulli, Reynolds..."
            className="w-full bg-[#071224] border border-transparent rounded-xl py-2 pl-10 pr-3 text-sm focus-visible:shadow-none focus-visible:outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filtered.length === 1) {
                // navigate to the single filtered experiment (if you wire a router)
                const slug = filtered[0].slug;
                // For now dispatch an event; router navigation to be implemented in pages.
                window.dispatchEvent(new CustomEvent('flowforge-navigate', { detail: { slug } }));
              }
            }}
          />

          {/* Dropdown suggestions */}
          {search && filtered.length > 0 && (
            <div className="absolute mt-2 w-full bg-[#071226] border border-[#0b1220] rounded-xl shadow-lg z-50">
              {filtered.slice(0, 6).map((exp: any) => (
                <button
                  key={exp.id}
                  className="w-full text-left px-3 py-2 hover:bg-[#081a27] flex items-center gap-3"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('flowforge-navigate', { detail: { slug: exp.slug } }));
                    setSearch('');
                  }}
                >
                  <div className="text-sm font-medium">{exp.title}</div>
                  <div className="text-xs muted ml-auto">{exp.category ?? 'Experiment'}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right area: quick presets, help, user */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2">
          {/* Quick presets dropdown */}
          <div className="relative">
            <details className="group">
              <summary className="btn btn-ghost list-none flex items-center gap-2" aria-haspopup="true" aria-expanded={false}>
                <span className="text-xs muted hidden md:inline">Presets</span>
                <svg className="w-3 h-3 text-[#9ca3af]" viewBox="0 0 20 20" fill="none"><path d="M5 7l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </summary>
              <div className="absolute right-0 mt-2 w-64 bg-[#071226] border border-[#0b1220] rounded-lg p-2">
                {presets.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 px-2 py-1 hover:bg-[#081a27] rounded">
                    <div>
                      <div className="text-sm font-medium">{p.label}</div>
                      <div className="text-xs muted">{p.description}</div>
                    </div>
                    <div>
                      <button className="btn btn-ghost" onClick={() => applyPreset(p)} aria-label={`Apply preset ${p.label}`}>
                        Apply
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </div>

          {/* Shortcuts / help */}
          <button className="btn btn-ghost" onClick={() => setShowShortcuts(true)} aria-label="Keyboard shortcuts">
            <IconHelp />
            <span className="hidden md:inline text-xs muted pl-1">Shortcuts</span>
          </button>
        </div>

        {/* Profile / user area (placeholder) */}
        <div className="relative">
          <button
            className="w-9 h-9 rounded-lg bg-[#071226] flex items-center justify-center"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="true"
            aria-expanded={menuOpen}
            aria-label="User menu"
          >
            <span className="text-sm font-semibold">PS</span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-44 bg-[#071226] border border-[#0b1220] rounded-lg p-2 z-50">
              <button className="w-full text-left px-2 py-2 hover:bg-[#081a27] rounded" onClick={() => alert('Profile/settings placeholder')}>
                Profile & Settings
              </button>
              <button className="w-full text-left px-2 py-2 hover:bg-[#081a27] rounded" onClick={() => alert('Open docs placeholder')}>
                Documentation
              </button>
              <hr className="my-2 border-t border-[#0b1220]" />
              <button
                className="w-full text-left px-2 py-2 hover:bg-[#081a27] rounded text-sm muted"
                onClick={() => {
                  // small sign-out placeholder
                  if (confirm('Sign out?')) {
                    // implement signout flow later
                    alert('Signed out (placeholder).');
                  }
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Shortcuts modal */}
      {showShortcuts && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-60 flex items-center justify-center p-4"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="w-full max-w-lg bg-[#071226] border border-[#0b1220] rounded-xl p-4 card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Keyboard Shortcuts</h3>
              <button className="btn btn-ghost" onClick={() => setShowShortcuts(false)} aria-label="Close shortcuts">Close</button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-[#061119] rounded">
                <div className="text-xs muted">Play / Pause</div>
                <div className="font-semibold">Space</div>
              </div>
              <div className="p-3 bg-[#061119] rounded">
                <div className="text-xs muted">Reset experiments</div>
                <div className="font-semibold">R</div>
              </div>
              <div className="p-3 bg-[#061119] rounded">
                <div className="text-xs muted">Snapshot active experiment</div>
                <div className="font-semibold">S</div>
              </div>
              <div className="p-3 bg-[#061119] rounded">
                <div className="text-xs muted">Export CSV</div>
                <div className="font-semibold">E</div>
              </div>
              <div className="p-3 bg-[#061119] rounded col-span-2">
                <div className="text-xs muted">Focus search</div>
                <div className="font-semibold">/ (slash)</div>
              </div>
            </div>

            <div className="mt-4 text-xs muted">Tip: you can press <span className="font-semibold">Space</span> to quickly pause simulations during heavy animations.</div>
          </div>
        </div>
      )}
    </header>
  );
}
