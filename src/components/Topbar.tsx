// src/components/Topbar.tsx
// Topbar for FlowForge — detailed, accessible, feature-rich.
// Responsibilities:
// - Global actions: Play/Pause all sims, Snapshot, Export last-run CSV, Undo, Redo
// - Quick experiment search / jump
// - Theme toggle (placeholder for dark/light implementation)
// - Shortcuts help modal
// - Small user/account menu (placeholder for future auth)
// - Keyboard shortcuts: Space = Play/Pause, S = Snapshot, E = Export CSV, / = focus search, ? = help
//
// Notes:
// - This component is intentionally self-contained and does not assume a global state library,
//   but exposes and emits custom DOM events (window.dispatchEvent) for small cross-component actions.
//   Other components (e.g., LabViewport) should listen to these events to respond.
// - Keep the visual style consistent with the FlowForge brand (tailwind + CSS vars).
// - No external icon libraries are used; icons are inline SVG for portability.

import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

type TopbarProps = {
  /** Optional brand title override */
  title?: string;
};

export default function Topbar({ title = 'FlowForge' }: TopbarProps) {
  const [running, setRunning] = useState<boolean>(true);
  const [helpOpen, setHelpOpen] = useState<boolean>(false);
  const [query, setQuery] = useState<string>('');
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Dispatches a simple custom event to coordinate global actions without coupling.
  // Listeners: LabViewport or other simulation containers can register for these.
  function dispatchAction(name: string, detail: Record<string, any> = {}) {
    window.dispatchEvent(new CustomEvent(`flowforge:${name}`, { detail }));
  }

  // Toggle play/pause and dispatch an event
  function toggleRun() {
    setRunning(r => {
      const next = !r;
      dispatchAction('toggle-run', { running: next });
      return next;
    });
  }

  // Snapshot event
  function snapshot() {
    dispatchAction('snapshot');
  }

  // Export CSV event
  function exportCSV() {
    dispatchAction('export-csv');
  }

  // Undo / Redo (for UI interactions or parameter history)
  function undo() {
    dispatchAction('undo');
  }
  function redo() {
    dispatchAction('redo');
  }

  // Keyboard shortcuts handler
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ignore if user typing in input or textarea
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement as HTMLElement)?.isContentEditable) {
        return;
      }

      // Space toggles play/pause (prevent default to avoid page scrolling)
      if (e.code === 'Space') {
        e.preventDefault();
        toggleRun();
        return;
      }

      // S for snapshot (S or s)
      if (e.key.toLowerCase() === 's' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        snapshot();
        return;
      }

      // E for export CSV
      if (e.key.toLowerCase() === 'e' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        exportCSV();
        return;
      }

      // Slash to focus search
      if (e.key === '/' && !e.shiftKey) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

      // ? for help modal (shift+/)
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // simple theme toggler (stores in localStorage)
  useEffect(() => {
    const stored = (localStorage.getItem('flowforge:theme') as 'dark' | 'light' | null) || null;
    if (stored) setTheme(stored);
  }, []);

  useEffect(() => {
    localStorage.setItem('flowforge:theme', theme);
    // toggle class on document element for global css variables if needed
    if (theme === 'light') {
      document.documentElement.classList.remove('ff-theme-dark');
      document.documentElement.classList.add('ff-theme-light');
    } else {
      document.documentElement.classList.remove('ff-theme-light');
      document.documentElement.classList.add('ff-theme-dark');
    }
  }, [theme]);

  // handle quick search / navigate to an experiment by slug
  function handleSearchSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    // dispatch a navigation event. Experiment list or router can listen and navigate.
    dispatchAction('navigate-experiment', { q });
    // clear search but keep focus for chaining
    setQuery('');
    searchRef.current?.blur();
  }

  // small helper to render inline SVG icons (kept minimal for production)
  const Icon = {
    Play: ({ className = 'w-4 h-4' }: { className?: string }) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
        <path d="M5 3v18l15-9L5 3z" fill="currentColor" />
      </svg>
    ),
    Pause: ({ className = 'w-4 h-4' }: { className?: string }) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
        <path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor" />
      </svg>
    ),
    Camera: ({ className = 'w-4 h-4' }: { className?: string }) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
        <path d="M4 7h4l2-2h4l2 2h4v12H4z" fill="currentColor" />
        <circle cx="12" cy="13" r="3" fill="#fff" />
      </svg>
    ),
    Download: ({ className = 'w-4 h-4' }: { className?: string }) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
        <path d="M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 11l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 21H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    Help: ({ className = 'w-4 h-4' }: { className?: string }) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
        <path d="M12 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M9.09 9a3 3 0 1 1 5.82 0c0 1.75-1.5 2.5-2.5 3.25S11 14 11 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  };

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-[#0b1220] bg-gradient-to-r from-transparent to-transparent z-40">
      <div className="flex items-center gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[#00b4d8] to-[#0077a3] text-[#031521] font-bold">
            FF
          </div>
          <div>
            <div className="text-sm font-semibold">{title}</div>
            <div className="text-xs muted">Virtual Fluid Lab</div>
          </div>
        </div>

        {/* Global play/pause */}
        <div className="ml-4 flex items-center gap-2">
          <button
            className={clsx('btn', 'btn-ghost', 'flex items-center gap-2')}
            onClick={toggleRun}
            aria-pressed={!running}
            title="Play / Pause (Space)"
          >
            <span className="inline-flex items-center">{running ? <Icon.Pause /> : <Icon.Play />}</span>
            <span className="text-xs">{running ? 'Pause' : 'Play'}</span>
          </button>

          <button
            className="btn btn-ghost flex items-center gap-2"
            onClick={() => {
              snapshot();
            }}
            title="Snapshot (S)"
          >
            <Icon.Camera />
            <span className="text-xs">Snapshot</span>
          </button>

          <button
            className="btn btn-ghost flex items-center gap-2"
            onClick={() => {
              exportCSV();
            }}
            title="Export CSV (E)"
          >
            <Icon.Download />
            <span className="text-xs">Export</span>
          </button>
        </div>
      </div>

      {/* center: search / quick nav */}
      <div className="flex-1 max-w-2xl px-4">
        <form onSubmit={handleSearchSubmit} className="relative">
          <input
            ref={searchRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search experiments, e.g. 'venturi', 'reynolds' — press / to focus"
            className="w-full rounded-lg border border-white/6 bg-[#071224] py-2 px-3 text-sm placeholder:muted focus:outline-none focus-visible:shadow-[0_0_0_3px_rgba(0,180,216,0.12)]"
            aria-label="Search experiments"
          />
          <button type="submit" className="absolute right-1 top-1/2 -translate-y-1/2 btn btn-ghost text-xs" aria-label="Go">
            Go
          </button>
        </form>
      </div>

      {/* right: utilities */}
      <div className="flex items-center gap-2">
        {/* Undo / Redo */}
        <div className="hidden sm:flex items-center gap-1">
          <button className="btn btn-ghost text-xs" onClick={undo} title="Undo (Ctrl+Z)">
            Undo
          </button>
          <button className="btn btn-ghost text-xs" onClick={redo} title="Redo (Ctrl+Y)">
            Redo
          </button>
        </div>

        {/* Theme toggle */}
        <button
          className="btn btn-ghost"
          onClick={() => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))}
          title="Toggle theme"
          aria-label="Toggle theme"
        >
          <span className="text-xs">{theme === 'dark' ? 'Dark' : 'Light'}</span>
        </button>

        {/* Help */}
        <button
          className="btn btn-ghost"
          onClick={() => setHelpOpen(true)}
          title="Keyboard shortcuts & help (?)"
          aria-label="Help"
        >
          <Icon.Help />
        </button>

        {/* Account placeholder */}
        <div className="relative">
          <button
            className="w-9 h-9 rounded-full bg-gradient-to-br from-[#00b4d8] to-[#0077a3] text-[#031521] font-semibold"
            aria-label="Account menu"
            title="Account"
            onClick={() => {
              // placeholder action
              dispatchAction('open-account');
              alert('Account features coming soon — integrate auth to enable.');
            }}
          >
            PS
          </button>
        </div>
      </div>

      {/* Help modal */}
      {helpOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setHelpOpen(false)}
        >
          <div
            className="max-w-2xl w-full card p-6"
            onClick={e => {
              e.stopPropagation();
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">Shortcuts & Help</h3>
                <p className="text-sm muted mt-1">Quick keyboard shortcuts and global actions for FlowForge.</p>
              </div>
              <div>
                <button className="btn btn-ghost" onClick={() => setHelpOpen(false)} aria-label="Close help">
                  Close
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium">Global</h4>
                <ul className="mt-2 text-sm muted space-y-1">
                  <li><strong>Space</strong> — Play / Pause</li>
                  <li><strong>S</strong> — Snapshot (download PNG)</li>
                  <li><strong>E</strong> — Export CSV (particles / readouts)</li>
                  <li><strong>/</strong> — Focus search</li>
                  <li><strong>?</strong> — Open this help</li>
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-medium">Tips</h4>
                <ul className="mt-2 text-sm muted space-y-1">
                  <li>Double-click the simulation canvas to reseed particles (if available).</li>
                  <li>Drag floating panels by their header to reorganize your workspace.</li>
                  <li>Use snapshot + export together to create lab reports quickly.</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setHelpOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
