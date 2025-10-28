// src/pages/ExperimentPage.tsx
// Detailed Experiment page for FlowForge.
// - Shows full experiment specification (aim, theory, apparatus, procedure, expected results).
// - Shows interactive parameter presets and lets user tweak values in-place.
// - "Open in Lab" button dispatches flowforge:open-experiment-preset (LabViewport or Lab page can listen).
// - Save / download preset, export quick lab-report template (CSV/MD stub).
// - Inline mini-quiz and grading rubric to make it classroom-ready.
// - Accessible, keyboard-friendly, and uses TypeScript + Tailwind classes consistent with project.
// - If experiment slug not found, shows friendly 404-style message.

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';

// A small local experiment index (this mirrors src/pages/Experiments fallback).
// In production, replace with import from src/data/experiments.ts or a backend.
const EXPERIMENT_INDEX = [
  {
    id: 'e1',
    slug: 'uniform-flow',
    title: 'Uniform Flow — Streamlines',
    chapter: 'Fundamentals',
    difficulty: 'Intro',
    description: 'Visualize uniform flow and streamlines; particle seeding and dye streaks.',
    defaultParams: { mode: 'uniform', flowSpeed: 1.2, viscosity: 0.001, density: 1000, pipeDiameter: 0.08 },
  },
  {
    id: 'e2',
    slug: 'reynolds-experiment',
    title: 'Reynolds Experiment',
    chapter: 'Fundamentals',
    difficulty: 'Intro',
    description: 'Observe laminar → turbulent regimes by varying velocity/viscosity.',
    defaultParams: { mode: 'uniform', flowSpeed: 0.25, viscosity: 0.001, density: 1000, pipeDiameter: 0.02 },
  },
  {
    id: 'e3',
    slug: 'venturi',
    title: 'Venturi Meter',
    chapter: 'Measurement',
    difficulty: 'Intermediate',
    description: 'Measure discharge using Venturi principle and pressure difference at throat.',
    defaultParams: { mode: 'venturi', flowSpeed: 1.6, viscosity: 0.001, density: 1000, pipeDiameter: 0.08 },
  },
  {
    id: 'e4',
    slug: 'cylinder',
    title: 'Flow around Cylinder',
    chapter: 'External Flow',
    difficulty: 'Advanced',
    description: 'Visualize wake formation and approximate drag; investigate vortex shedding heuristics.',
    defaultParams: { mode: 'cylinder', flowSpeed: 3.0, viscosity: 0.001, density: 1000, pipeDiameter: 0.25 },
  },
];

type Experiment = (typeof EXPERIMENT_INDEX)[number];

function numberInput({
  label,
  value,
  min,
  max,
  step,
  onChange,
  id,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  id?: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs muted block">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="range"
          min={min ?? 0}
          max={max ?? 10}
          step={step ?? 0.01}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="flex-1"
          aria-label={label}
        />
        <input
          type="number"
          value={Number(value.toFixed(6))}
          onChange={e => {
            const v = Number(e.target.value);
            if (!Number.isNaN(v)) onChange(v);
          }}
          className="w-28 bg-[#071224] border border-white/6 rounded px-2 py-1 text-sm"
          aria-label={`${label} numeric input`}
        />
      </div>
    </div>
  );
}

export default function ExperimentPage(): JSX.Element {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const experiment: Experiment | undefined = useMemo(() => {
    if (!slug) return undefined;
    return EXPERIMENT_INDEX.find(e => e.slug === slug);
  }, [slug]);

  // If no experiment found: friendly message
  if (!experiment) {
    return (
      <div className="card p-6">
        <h2 className="text-xl font-semibold">Experiment not found</h2>
        <p className="text-sm muted mt-2">
          Couldn’t find an experiment with slug <code>{slug}</code>. Go back to <Link to="/experiments" className="underline">Experiments</Link>.
        </p>
      </div>
    );
  }

  // local editable parameters (start from defaultParams)
  const defaults = experiment.defaultParams ?? {};
  const [params, setParams] = useState<Record<string, any>>({
    // fallbacks
    mode: defaults.mode ?? 'uniform',
    flowSpeed: defaults.flowSpeed ?? 1.0,
    viscosity: defaults.viscosity ?? 0.001,
    density: defaults.density ?? 1000,
    pipeDiameter: defaults.pipeDiameter ?? 0.08,
  });

  // logging of steps / notes for student
  const [notes, setNotes] = useState<string>('');

  // quick-quiz state
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [quizFeedback, setQuizFeedback] = useState<string | null>(null);

  // saved presets in localStorage (key per user)
  const PRESET_KEY = 'flowforge:user-presets:v1';
  const [presets, setPresets] = useState<Array<{ id: string; title: string; params: Record<string, any> }>>(() => {
    try {
      const raw = localStorage.getItem(PRESET_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  });

  useEffect(() => {
    // persist on change
    try {
      localStorage.setItem(PRESET_KEY, JSON.stringify(presets.slice(0, 50)));
    } catch {}
  }, [presets]);

  // handlers
  function setParam<K extends keyof typeof params>(key: K, value: typeof params[K]) {
    setParams(prev => ({ ...prev, [key]: value }));
  }

  function openInLabWithPreset() {
    // dispatch a well-formed event containing the experiment metadata and params
    window.dispatchEvent(
      new CustomEvent('flowforge:open-experiment-preset', {
        detail: {
          experiment: {
            id: experiment.id,
            slug: experiment.slug,
            title: experiment.title,
            chapter: experiment.chapter,
            difficulty: experiment.difficulty,
            description: experiment.description,
          },
          preset: {
            id: `preset_${Date.now()}`,
            title: `${experiment.title} — preset`,
            params,
          },
        },
      }),
    );

    // navigate to /lab where Lab page or LabViewport should listen and load preset
    navigate('/lab');
  }

  function savePreset(title?: string) {
    const t = title ?? `${experiment.title} — ${new Date().toLocaleString()}`;
    const item = { id: `userpreset_${Date.now()}`, title: t, params };
    setPresets(prev => [item, ...prev].slice(0, 50));
    alert('Preset saved locally. Open Lab and choose Load Preset to reuse it.');
  }

  function downloadPreset() {
    const payload = {
      meta: { id: experiment.id, slug: experiment.slug, title: experiment.title },
      preset: { title: `${experiment.title} - exported`, params },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${experiment.slug}_preset_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportLabReportStub() {
    // create a markdown skeleton with parameter table and placeholders
    const md = [
      `# Lab Report — ${experiment.title}`,
      '',
      `**Experiment ID:** ${experiment.id}`,
      `**Date:** ${new Date().toLocaleString()}`,
      '',
      '## Aim',
      `${experiment.description || '—'}`,
      '',
      '## Apparatus',
      '- Virtual FlowForge Lab',
      '',
      '## Parameters',
      '| Parameter | Value | Units |',
      '|---|---:|---|',
      `| mode | ${params.mode} | — |`,
      `| flowSpeed | ${params.flowSpeed} | m/s |`,
      `| viscosity | ${params.viscosity} | Pa·s |`,
      `| density | ${params.density} | kg/m³ |`,
      `| pipeDiameter | ${params.pipeDiameter} | m |`,
      '',
      '## Procedure',
      '1. Load preset into Lab.\n2. Run simulation for multiple values of flow speed.\n3. Record Re and dynamic pressure q.\n4. Plot & analyze results.',
      '',
      '## Observations',
      '- (Paste CSV or screenshots here)',
      '',
      '## Conclusions',
      '- ',
      '',
    ].join('\n');

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${experiment.slug}_lab_report_stub.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function runQuiz() {
    // simple check for a tiny built-in quiz
    const user = answers['q1']?.trim().toLowerCase() || '';
    const correct = 'reynolds'; // expecting the concept keyword
    if (user.includes('re') || user.includes('reynolds')) {
      setQuizFeedback('Good! You mentioned Reynolds — remember Re = ρVD/μ and thresholds ~2300 & ~4000.');
    } else {
      setQuizFeedback("Not quite — think of the dimensionless number that predicts laminar/turbulent flow (hint: starts with 'Re').");
    }
  }

  function loadPresetToParams(presetId: string) {
    const p = presets.find(x => x.id === presetId);
    if (!p) return;
    setParams(p.params);
    alert(`Preset "${p.title}" loaded into parameter editor.`);
  }

  // small utility: present parameter table
  const paramRows = useMemo(() => {
    return [
      { key: 'mode', label: 'Mode', value: params.mode },
      { key: 'flowSpeed', label: 'Flow speed (m/s)', value: params.flowSpeed },
      { key: 'viscosity', label: 'Viscosity (Pa·s)', value: params.viscosity },
      { key: 'density', label: 'Density (kg/m³)', value: params.density },
      { key: 'pipeDiameter', label: 'Diameter (m)', value: params.pipeDiameter },
    ];
  }, [params]);

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{experiment.title}</h1>
          <div className="text-xs muted mt-1">{experiment.chapter} • {experiment.difficulty}</div>
          <p className="mt-3 text-sm muted max-w-prose">{experiment.description}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="btn btn-primary"
            onClick={() => {
              openInLabWithPreset();
            }}
          >
            Open in Lab with preset
          </button>

          <button
            className="btn btn-ghost"
            onClick={() => {
              savePreset();
            }}
          >
            Save preset
          </button>

          <button
            className="btn btn-ghost"
            onClick={() => {
              downloadPreset();
            }}
          >
            Download preset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Theory & Procedure */}
        <section className="card p-4">
          <h3 className="text-lg font-semibold">Theory</h3>
          <div className="text-sm muted mt-2">
            <p>
              Key relations used in this experiment:
            </p>
            <ul className="mt-2 ml-4 list-disc text-xs muted space-y-1">
              <li><strong>Reynolds number</strong>: <code>Re = ρ V D / μ</code> — predicts laminar/turbulent regimes.</li>
              <li><strong>Dynamic pressure</strong>: <code>q = 0.5 ρ V²</code>.</li>
              <li>Bernoulli principle (inviscid): <code>p + 0.5ρV² + ρgz = constant</code>.</li>
            </ul>
          </div>

          <h4 className="mt-4 text-sm font-medium">Apparatus (virtual)</h4>
          <ul className="text-xs muted mt-2 ml-4 list-disc">
            <li>FlowForge Virtual Lab (LabViewport)</li>
            <li>Preset: {experiment.title}</li>
            <li>CSV export & snapshots</li>
          </ul>

          <h4 className="mt-4 text-sm font-medium">Procedure</h4>
          <ol className="text-xs muted mt-2 ml-4 list-decimal space-y-1">
            <li>Open the lab with the preset (button above).</li>
            <li>Set flow speed to the first chosen value and run the simulation until steady visual patterns appear.</li>
            <li>Record Re, Avg V and q using the data panel or export CSV.</li>
            <li>Repeat for multiple flow speeds; plot Re vs observed regime and discuss discrepancies.</li>
          </ol>

          <h4 className="mt-4 text-sm font-medium">Expected Results & Discussion</h4>
          <p className="text-xs muted mt-2">
            You should observe changes in flow appearance (streamlines, onset of vortices) when Reynolds crosses the transitional range.
            Discuss measurement error sources: discretization of particle sampling, 2D simplification, and viscosity model approximations.
          </p>
        </section>

        {/* Center: Parameter editor + preset manager */}
        <section className="card p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Parameters</h3>
            <div className="text-xs muted">Edit values and open the Lab with these settings.</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* controls */}
            <div className="space-y-3">
              {/* mode selector */}
              <div>
                <label className="text-xs muted block mb-1">Mode</label>
                <select
                  value={params.mode}
                  onChange={e => setParam('mode', e.target.value)}
                  className="w-full bg-[#071224] border border-white/6 rounded px-2 py-2 text-sm"
                >
                  <option value="uniform">Uniform</option>
                  <option value="venturi">Venturi</option>
                  <option value="cylinder">Cylinder</option>
                  <option value="pipe-profile">Pipe profile</option>
                  <option value="open-channel">Open channel</option>
                </select>
              </div>

              {/* numeric sliders (re-using numberInput helper) */}
              <div>{numberInput({ label: 'Flow speed (m/s)', value: params.flowSpeed, min: 0.01, max: 6, step: 0.01, onChange: v => setParam('flowSpeed', v), id: 'flowSpeed' })}</div>

              <div>{numberInput({ label: 'Viscosity (Pa·s)', value: params.viscosity, min: 0.0001, max: 0.02, step: 0.0001, onChange: v => setParam('viscosity', v), id: 'viscosity' })}</div>

              <div>{numberInput({ label: 'Density (kg/m³)', value: params.density, min: 100, max: 2000, step: 10, onChange: v => setParam('density', v), id: 'density' })}</div>

              <div>{numberInput({ label: 'Characteristic diameter (m)', value: params.pipeDiameter, min: 0.01, max: 1.0, step: 0.001, onChange: v => setParam('pipeDiameter', v), id: 'pipeDiameter' })}</div>

              <div className="flex items-center gap-2">
                <button className="btn btn-primary" onClick={() => openInLabWithPreset()}>Open in Lab</button>
                <button className="btn btn-ghost" onClick={() => savePreset()}>Save locally</button>
                <button className="btn btn-ghost" onClick={() => downloadPreset()}>Download JSON</button>
              </div>
            </div>

            {/* presets & quick actions */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Saved Presets</h4>
              <div className="max-h-48 overflow-auto space-y-2">
                {presets.length === 0 && <div className="text-xs muted">No saved presets yet.</div>}
                {presets.map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-2 p-2 rounded border border-white/6">
                    <div className="text-sm">{p.title}</div>
                    <div className="flex items-center gap-2">
                      <button className="btn btn-ghost text-xs" onClick={() => loadPresetToParams(p.id)}>Load</button>
                      <button className="btn btn-ghost text-xs" onClick={() => {
                        // download this preset as JSON
                        const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${experiment.slug}_preset_${p.id}.json`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                      }}>Export</button>
                      <button className="btn btn-ghost text-xs" onClick={() => {
                        if (!confirm('Delete preset?')) return;
                        setPresets(prev => prev.filter(x => x.id !== p.id));
                      }}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-2">
                <button className="btn btn-ghost" onClick={() => exportLabReportStub()}>Download report template</button>
              </div>
            </div>
          </div>

          {/* parameter table */}
          <div className="mt-4">
            <h4 className="text-sm font-medium">Parameter summary</h4>
            <div className="mt-2 text-xs">
              <table className="w-full text-left">
                <thead className="text-xs muted">
                  <tr><th>Parameter</th><th>Value</th></tr>
                </thead>
                <tbody>
                  {paramRows.map(r => (
                    <tr key={r.key} className="border-t border-white/6">
                      <td className="py-2">{r.label}</td>
                      <td className="py-2 font-medium">{String(r.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* notes */}
          <div className="mt-4">
            <h4 className="text-sm font-medium">Your notes</h4>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Record observations or paste analysis snippets here..."
              className="w-full mt-2 p-3 rounded bg-[#071224] border border-white/6 text-sm h-24"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                className="btn btn-primary"
                onClick={() => {
                  // quick-export notes as .txt
                  const blob = new Blob([notes || ''], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${experiment.slug}_notes_${Date.now()}.txt`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                }}
              >
                Export notes
              </button>

              <button className="btn btn-ghost" onClick={() => setNotes('')}>Clear</button>
            </div>
          </div>
        </section>
      </div>

      {/* Quiz and rubric */}
      <div className="card p-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">Quick quiz</h3>
            <div className="text-xs muted mt-1">A short conceptual check to reinforce learning.</div>
          </div>
          <div className="text-xs muted">For instructors: customize or extend in the admin panel later.</div>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium">Q1: Which dimensionless number predicts laminar/turbulent flow?</label>
            <input
              value={answers['q1'] || ''}
              onChange={e => setAnswers(prev => ({ ...prev, q1: e.target.value }))}
              className="w-full mt-2 p-2 rounded bg-[#071224] border border-white/6"
              placeholder="Type your answer"
              aria-label="Answer to Q1"
            />
          </div>

          <div>
            <label className="text-xs font-medium">Instructor rubric</label>
            <div className="text-xs muted mt-2">
              <ul className="list-disc ml-4 space-y-1">
                <li>Identify Reynolds number and its formula (ρVD/μ).</li>
                <li>Explain threshold values (~2300 laminar, &gt;4000 turbulent) and experimental caveats.</li>
                <li>Briefly discuss measurement errors and 2D simplifications in the virtual lab.</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button className="btn btn-primary" onClick={() => runQuiz()}>Check answer</button>
          <button className="btn btn-ghost" onClick={() => { setAnswers({}); setQuizFeedback(null); }}>Reset</button>
          <div className="text-sm muted ml-auto">{quizFeedback ?? 'No feedback yet.'}</div>
        </div>
      </div>

      {/* navigation footer */}
      <div className="flex items-center justify-between">
        <div className="text-xs muted">Need to modify the experiment? Save a preset and load it in the Lab to iterate quickly.</div>
        <div className="flex items-center gap-2">
          <Link to="/experiments" className="btn btn-ghost text-xs">Back to Experiments</Link>
          <Link to="/lab" className="btn btn-primary text-xs">Open Lab</Link>
        </div>
      </div>
    </div>
  );
}
