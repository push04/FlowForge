// src/components/LeftNav.tsx
// Left navigation for FlowForge — detailed, accessible, and interactive.
// Responsibilities:
// - Show chapter list and experiments grouped by topic
// - Highlight active route (uses react-router NavLink internally)
// - Collapsible groups with keyboard support
// - Quick filters (favorites, recent, search)
// - Emits `flowforge:navigate-experiment` when a quick-jump is requested
// - Lightweight persistence of collapsed state / favorites via localStorage
//
// Note: This file intentionally contains a small built-in experiment index to bootstrap the UI.
// Replace or extend by loading `src/data/experiments.ts` later for larger lists.

import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';

type ExperimentMeta = {
  id: string;
  title: string;
  slug: string;
  chapter: string;
  difficulty?: 'Intro' | 'Intermediate' | 'Advanced';
  description?: string;
  favorite?: boolean;
};

// -- Bootstrap experiment index (small sample, extendable)
const EXPERIMENTS: ExperimentMeta[] = [
  { id: 'e1', title: 'Uniform Flow — Streamlines', slug: 'uniform-flow', chapter: 'Fundamentals', difficulty: 'Intro', description: 'Visualize uniform flow and streamlines.' },
  { id: 'e2', title: 'Reynolds Experiment', slug: 'reynolds-experiment', chapter: 'Fundamentals', difficulty: 'Intro', description: 'Observe laminar → turbulent regimes.' },
  { id: 'e3', title: 'Bernoulli Apparatus', slug: 'bernoulli', chapter: 'Energy', difficulty: 'Intermediate', description: 'Verify Bernoulli along a streamline.' },
  { id: 'e4', title: 'Venturi Meter', slug: 'venturi', chapter: 'Measurement', difficulty: 'Intermediate', description: 'Measure discharge using Venturi.' },
  { id: 'e5', title: 'Flow around Cylinder', slug: 'cylinder', chapter: 'External Flow', difficulty: 'Advanced', description: 'Study wake, drag and lift approximation.' },
  { id: 'e6', title: 'Hagen–Poiseuille', slug: 'poiseuille', chapter: 'Internal Flow', difficulty: 'Advanced', description: 'Laminar pipe flow profile and Q ∝ r^4.' },
];

const STORAGE_KEY = 'flowforge:leftnav';

// small helper for keyboard-friendly accessible button
function IconChevron({ open }: { open?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={clsx('w-4 h-4 transition-transform', open ? 'rotate-90' : 'rotate-0')} aria-hidden>
      <path fill="currentColor" d="M9 6l6 6-6 6" />
    </svg>
  );
}

export default function LeftNav(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();

  // group experiments by chapter
  const grouped = useMemo(() => {
    const map = new Map<string, ExperimentMeta[]>();
    for (const e of EXPERIMENTS) {
      const list = map.get(e.chapter) ?? [];
      list.push(e);
      map.set(e.chapter, list);
    }
    return map;
  }, []);

  // collapsed state per chapter (persisted)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw).collapsed ?? {};
    } catch {
      return {};
    }
  });

  // favorites tracking (persisted)
  const [favorites, setFavorites] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw).favorites ?? {};
    } catch {
      return {};
    }
  });

  // quick filter
  const [filter, setFilter] = useState<string>('');

  // compute visible experiments based on filter
  const visible = useMemo(() => {
    if (!filter.trim()) return EXPERIMENTS;
    const q = filter.trim().toLowerCase();
    return EXPERIMENTS.filter(
      e =>
        e.title.toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q) ||
        e.chapter.toLowerCase().includes(q) ||
        e.slug.toLowerCase().includes(q),
    );
  }, [filter]);

  // derived grouped visible map
  const groupedVisible = useMemo(() => {
    const map = new Map<string, ExperimentMeta[]>();
    for (const e of visible) {
      const list = map.get(e.chapter) ?? [];
      list.push({ ...e, favorite: !!favorites[e.id] });
      map.set(e.chapter, list);
    }
    return map;
  }, [visible, favorites]);

  // persist collapsed & favorites
  useEffect(() => {
    const payload = { collapsed, favorites, timestamp: Date.now() };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, [collapsed, favorites]);

  // listen to global navigate-experiment event (from Topbar)
  useEffect(() => {
    const handler = (ev: Event) => {
      const ce = ev as CustomEvent;
      const q = String((ce.detail && ce.detail.q) || '').trim();
      if (!q) return;
      // try to find slug or title match
      const found = EXPERIMENTS.find(e => e.slug === q || e.id === q || e.title.toLowerCase().includes(q.toLowerCase()));
      if (found) {
        navigate(`/experiments/${found.slug}`);
        return;
      }
      // fallback: navigate to experiments page with search
      navigate(`/experiments?q=${encodeURIComponent(q)}`);
    };
    window.addEventListener('flowforge:navigate-experiment' as any, handler as EventListener);
    return () => window.removeEventListener('flowforge:navigate-experiment' as any, handler as EventListener);
  }, [navigate]);

  // helper: toggle favorite
  function toggleFavorite(expId: string) {
    setFavorites(prev => {
      const next = { ...prev, [expId]: !prev[expId] };
      return next;
    });
  }

  // helper: navigate to experiment
  function openExp(slug: string) {
    navigate(`/experiments/${slug}`);
  }

  // keyboard accessibility: expand/collapse all with key 'A' (for power users)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        // toggle collapsed state for all groups
        const anyOpen = Object.values(collapsed).some(v => !v);
        const next: Record<string, boolean> = {};
        grouped.forEach((_, k) => {
          next[k] = anyOpen; // if any open -> collapse all; else expand all
        });
        setCollapsed(next);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [collapsed, grouped]);

  return (
    <nav aria-label="FlowForge navigation" className="text-sm">
      {/* Search / Quick filters */}
      <div className="mb-4">
        <input
          type="search"
          placeholder="Filter experiments (e.g., venturi)"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="w-full bg-[#071224] border border-white/6 rounded px-2 py-2 text-xs focus-visible:shadow-[0_0_0_3px_rgba(0,180,216,0.12)]"
          aria-label="Filter experiments"
        />
      </div>

      {/* quick sections */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <button
          className="btn btn-ghost text-xs"
          onClick={() => {
            // show favorites filter
            const favs = EXPERIMENTS.filter(e => !!favorites[e.id]).map(e => e.slug);
            if (favs.length === 0) {
              setFilter(''); // clear
            } else {
              setFilter(favs.join(' '));
            }
          }}
        >
          Favorites
        </button>

        <button
          className="btn btn-ghost text-xs"
          onClick={() => {
            // go to experiments listing
            window.location.href = '/experiments';
          }}
        >
          All Experiments
        </button>
      </div>

      {/* dynamic grouped list */}
      <div className="space-y-3">
        {Array.from(groupedVisible.entries()).map(([chapter, exps]) => {
          const isCollapsed = !!collapsed[chapter];
          return (
            <div key={chapter} className="card p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    aria-expanded={!isCollapsed}
                    aria-controls={`chapter-${chapter}`}
                    onClick={() => setCollapsed(prev => ({ ...prev, [chapter]: !prev[chapter] }))}
                    className="inline-flex items-center gap-2 text-sm font-medium"
                  >
                    <IconChevron open={!isCollapsed} />
                    <span>{chapter}</span>
                  </button>
                  <span className="text-xs muted ml-2">({exps.length})</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="btn btn-ghost text-xs"
                    onClick={() => {
                      // collapse/expand this group only
                      setCollapsed(prev => ({ ...prev, [chapter]: !prev[chapter] }));
                    }}
                  >
                    Toggle
                  </button>
                </div>
              </div>

              <div
                id={`chapter-${chapter}`}
                role="region"
                aria-hidden={isCollapsed}
                className={clsx('mt-3 space-y-2 transition-all', isCollapsed ? 'hidden' : 'block')}
              >
                {exps.map(e => {
                  const active = location.pathname === `/experiments/${e.slug}`;
                  return (
                    <div key={e.id} className="flex items-start gap-2">
                      <div className="flex-1">
                        <NavLink
                          to={`/experiments/${e.slug}`}
                          className={({ isActive }) =>
                            clsx(
                              'block px-2 py-1 rounded hover:bg-white/2',
                              isActive ? 'bg-gradient-to-r from-[#072b33] to-[#082f36] font-semibold' : 'text-sm',
                            )
                          }
                          title={e.description}
                          aria-current={active ? 'page' : undefined}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="text-sm">{e.title}</div>
                              <div className="text-xs muted">{e.difficulty} • {e.description}</div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <div className="text-xs muted">{e.slug}</div>
                            </div>
                          </div>
                        </NavLink>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          className={clsx('p-1 rounded hover:bg-white/4', favorites[e.id] ? 'text-[#ffcc00]' : 'text-[#9ca3af]')}
                          onClick={() => toggleFavorite(e.id)}
                          aria-pressed={!!favorites[e.id]}
                          title={favorites[e.id] ? 'Unfavorite' : 'Favorite'}
                        >
                          {/* star icon */}
                          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden>
                            <path d="M12 17.3l6.18 3.73-1.64-7.03L21 9.24l-7.19-.62L12 2 10.19 8.62 3 9.24l4.46 4.76L5.82 21z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* quick actions for this chapter */}
                <div className="mt-2 flex items-center gap-2">
                  <button
                    className="btn btn-ghost text-xs"
                    onClick={() => {
                      // open first experiment
                      if (exps[0]) openExp(exps[0].slug);
                    }}
                  >
                    Open first
                  </button>

                  <button
                    className="btn btn-ghost text-xs"
                    onClick={() => {
                      // shuffle-open random experiment in the chapter
                      const idx = Math.floor(Math.random() * exps.length);
                      openExp(exps[idx].slug);
                    }}
                  >
                    Random
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* footer quick info */}
      <div className="mt-6 text-xs muted">
        <div>Tip: Press <kbd className="bg-[#071224] px-1 rounded">/</kbd> then type to search. Press <kbd className="bg-[#071224] px-1 rounded">Space</kbd> to Play/Pause.</div>
      </div>
    </nav>
  );
}
