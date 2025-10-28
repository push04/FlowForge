// src/pages/Home.tsx
// Home / landing page for FlowForge — detailed, production-minded, and accessible.
// - Hero with elevator pitch, CTA buttons
// - Feature grid describing core capabilities (interactive sims, experiments, data export, teacher mode)
// - Live mini-demo embed (lazy-loaded LabViewport) so users immediately experience the simulation
// - Quick start card with GitHub / Netlify instructions and badges
// - Recent experiments preview and links
// - Footer with attribution and keyboard tips
//
// Notes:
// - Uses framer-motion for subtle entrance animations (already included in package.json).
// - Keeps CSS and classnames consistent with the project's Tailwind theme variables.
// - Home remains purely presentational and delegates heavy logic to child components.

import React, { Suspense } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import clsx from 'clsx';

const LabViewport = React.lazy(() => import('@/components/LabViewport'));

const FeatureCard = ({
  title,
  desc,
  tag,
}: {
  title: string;
  desc: string;
  tag?: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35 }}
    className="card p-4"
    role="article"
    aria-label={title}
  >
    <div className="flex items-start justify-between">
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm muted mt-1">{desc}</p>
      </div>
      {tag && <div className="text-xs px-2 py-1 rounded bg-[#071224] border border-white/6 text-[#00b4d8]">{tag}</div>}
    </div>
  </motion.div>
);

export default function Home(): JSX.Element {
  return (
    <div className="space-y-6">
      {/* HERO */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-4">
          <motion.h1
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35 }}
            className="text-3xl md:text-4xl font-extrabold leading-tight"
          >
            FlowForge — Virtual Fluid Mechanics Lab
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.06, duration: 0.35 }}
            className="text-sm muted max-w-xl"
          >
            Run interactive experiments, visualize streamlines & pressure fields, collect measurement
            data and export lab-ready reports — all in your browser. Designed for engineering students,
            instructors, and curious makers.
          </motion.p>

          <div className="flex gap-3 items-center">
            <Link to="/lab" className="btn btn-primary">
              Open Lab
            </Link>
            <Link to="/experiments" className="btn btn-ghost">
              View Experiments
            </Link>
            <a
              className="text-sm muted underline ml-2"
              href="https://github.com/<your-org>/flowforge"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="card p-3">
              <div className="text-xs muted">Quick stat</div>
              <div className="text-2xl font-semibold">20+ Experiments</div>
              <div className="text-sm muted mt-1">From Bernoulli to Hydraulic Jump</div>
            </div>
            <div className="card p-3">
              <div className="text-xs muted">For instructors</div>
              <div className="text-2xl font-semibold">Exportable CSV</div>
              <div className="text-sm muted mt-1">Download data for grading and analysis</div>
            </div>
          </div>

          <div className="mt-4 text-xs muted">
            Tip: Press <kbd className="bg-[#071224] px-1 rounded">Space</kbd> to pause/play simulations. Press <kbd className="bg-[#071224] px-1 rounded">S</kbd> to snapshot.
          </div>
        </div>

        {/* Live demo panel */}
        <div className="card p-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-sm font-medium">Live demo</div>
              <div className="text-xs muted">Try a mini-simulation inline</div>
            </div>

            <div className="text-xs muted">Interactive • No install</div>
          </div>

          <div className="rounded-lg overflow-hidden border border-white/6" style={{ height: 420 }}>
            <Suspense fallback={<div className="w-full h-full flex items-center justify-center muted">Loading demo…</div>}>
              <LabViewport />
            </Suspense>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs muted">Use the control panel to change flow, viscosity and experiment mode.</div>
            <Link to="/lab" className="btn btn-ghost text-xs">
              Open full lab
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FeatureCard
          title="Interactive Simulations"
          desc="Real-time parameter tuning with visual streamlines, velocity maps, and experiment overlays."
          tag="Core"
        />
        <FeatureCard
          title="Experiment Templates"
          desc="Pre-built setups: Venturi meter, Reynolds experiment, Poiseuille flow, hydraulic jump."
          tag="Labs"
        />
        <FeatureCard
          title="Data & Reports"
          desc="Export CSV, snapshot PNGs, generate quick reports for lab submissions."
          tag="Export"
        />
      </section>

      {/* QUICK START & GIT */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="text-lg font-semibold">Quick start (developer)</h3>
          <p className="text-sm muted mt-1">
            Clone, install, run. The project is optimized for GitHub + Netlify continuous deployment.
          </p>

          <pre className="mt-3 p-3 rounded bg-[#071224] text-xs overflow-auto">
            <code>
{`git clone https://github.com/<your-org>/flowforge.git
cd flowforge
npm install
npm run dev
# Build for deploy
npm run build`}
            </code>
          </pre>

          <div className="mt-3 flex items-center gap-2">
            <a className="btn btn-primary text-sm" href="https://app.netlify.com/sites/new" target="_blank" rel="noreferrer">
              Deploy to Netlify
            </a>
            <a className="btn btn-ghost text-sm" href="https://github.com/<your-org>/flowforge" target="_blank" rel="noreferrer">
              View repo
            </a>
          </div>
        </div>

        {/* Recent experiments preview */}
        <div className="card p-4">
          <h3 className="text-lg font-semibold">Recent experiments</h3>
          <div className="mt-3 space-y-2">
            <Link to="/experiments/reynolds-experiment" className="block p-3 rounded hover:bg-white/2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Reynolds Experiment</div>
                  <div className="text-xs muted">Observe laminar to turbulent transition</div>
                </div>
                <div className="text-xs muted">Intro</div>
              </div>
            </Link>

            <Link to="/experiments/venturi" className="block p-3 rounded hover:bg-white/2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Venturi Meter</div>
                  <div className="text-xs muted">Measure discharge via pressure difference</div>
                </div>
                <div className="text-xs muted">Intermediate</div>
              </div>
            </Link>

            <Link to="/experiments/cylinder" className="block p-3 rounded hover:bg-white/2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Flow around Cylinder</div>
                  <div className="text-xs muted">Visualize wake and approximate drag</div>
                </div>
                <div className="text-xs muted">Advanced</div>
              </div>
            </Link>
          </div>

          <div className="mt-4 text-xs muted">Want to add another experiment? Open an issue in the repository or submit a PR.</div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-4 p-4 text-xs muted border-t border-white/6">
        <div className="flex items-center justify-between">
          <div>© {new Date().getFullYear()} FlowForge — Built for learning. Fonts: Inter, Poppins. Icons: inline SVG.</div>
          <div className="flex items-center gap-3">
            <div>Keyboard: <kbd className="bg-[#071224] px-1 rounded">Space</kbd> Pause • <kbd className="bg-[#071224] px-1 rounded">S</kbd> Snapshot</div>
            <div>
              <a href="/docs" className="underline">Docs</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
