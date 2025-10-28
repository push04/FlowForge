// src/App.tsx
import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';

// Lazy-loaded pages (created later)
const Home = lazy(() => import('@/pages/Home'));
const Lab = lazy(() => import('@/pages/Lab'));
const Experiments = lazy(() => import('@/pages/Experiments'));
const ExperimentPage = lazy(() => import('@/pages/ExperimentPage'));
const Docs = lazy(() => import('@/pages/Docs'));
const NotFound = lazy(() => import('@/pages/NotFound'));

// Simple small UI components (you'll create these files later)
import Topbar from '@/components/Topbar';
import LeftNav from '@/components/LeftNav';
import Footer from '@/components/Footer';

// App-level styles are in src/styles/index.css (Tailwind + custom vars)
export default function App(): JSX.Element {
  return (
    <div className="min-h-screen flex bg-[#0f1724] text-[#e6eef3]">
      {/* Left navigation (collapsible) */}
      <aside className="w-72 min-w-[260px] max-w-[320px] border-r border-[#0b1220] bg-gradient-to-b from-[#071224] to-[#071926] p-4 hidden md:block">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#00b4d8] to-[#0077a3] flex items-center justify-center font-bold text-[#081521]">
              FF
            </div>
            <div>
              <div className="text-lg font-semibold">FlowForge</div>
              <div className="text-xs text-[#9ca3af]">Virtual Fluid Lab</div>
            </div>
          </Link>
        </div>

        <LeftNav />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <Topbar />

        <main className="flex-1 overflow-hidden">
          <div className="h-full grid grid-rows-[auto_1fr]">
            {/* Breadcrumb / page header */}
            <div className="px-6 py-4 border-b border-[#0b1220] bg-transparent">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-semibold">Interactive Lab</h1>
                  <p className="text-sm text-[#9ca3af]">Simulations • Experiments • Visualizations</p>
                </div>
                <div className="flex items-center gap-3">
                  <Link to="/lab" className="px-3 py-1.5 bg-[#071a26] rounded-lg text-sm hover:opacity-90">Open Lab</Link>
                  <Link to="/experiments" className="px-3 py-1.5 bg-[#072233] rounded-lg text-sm hover:opacity-90">Experiments</Link>
                </div>
              </div>
            </div>

            {/* Router outlet */}
            <div className="p-6 overflow-auto">
              <Suspense fallback={<div className="p-6 text-center text-sm text-[#9ca3af]">Loading...</div>}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/lab" element={<Lab />} />
                  <Route path="/experiments" element={<Experiments />} />
                  <Route path="/experiments/:slug" element={<ExperimentPage />} />
                  <Route path="/docs/*" element={<Docs />} />
                  <Route path="/404" element={<NotFound />} />
                  <Route path="*" element={<Navigate to="/404" replace />} />
                </Routes>
              </Suspense>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
}
