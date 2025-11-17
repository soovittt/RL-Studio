import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

function LandingPage() {
  const [zoomedImage, setZoomedImage] = useState<string | null>(null)

  // Close on ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setZoomedImage(null)
      }
    }
    if (zoomedImage) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [zoomedImage])

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="border-b border-gray-200">
        <div className="max-w-[880px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-xl font-semibold text-gray-900">RL Studio</div>
            <div className="flex items-center">
              <Link
                to="/login"
                className="text-sm px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Login
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-[880px] mx-auto px-6 py-16">
        <div className="flex flex-col md:flex-row items-start gap-12">
          <div className="flex-1">
            <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
              RL Studio
            </h1>
            <p className="text-xl text-gray-700 mb-4 leading-relaxed">
              Build, visualize, and train reinforcement learning environments — all in your browser.
            </p>
            <p className="text-gray-600 mb-6 leading-relaxed">
              A lightweight studio for designing RL environments, running rollouts, launching training jobs, and exporting Gym-ready Python code.
            </p>
            <p className="text-gray-600 mb-8 leading-relaxed">
              No setup. No boilerplate. Everything happens in one place.
            </p>
            <div className="flex gap-4">
              <Link
                to="/dashboard"
                className="px-6 py-3 bg-gray-900 text-white rounded hover:bg-gray-800 transition-colors font-medium"
              >
                Launch Studio
              </Link>
              <a
                href="#"
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors font-medium"
              >
                View Docs
              </a>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-md aspect-square border border-gray-200 rounded bg-gray-50 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <svg
                  className="w-32 h-32 mx-auto mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                  />
                </svg>
                <p className="text-sm">Environment Preview</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-[880px] mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-12 text-center">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 border-2 border-gray-300 rounded flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                1. Create an Environment
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Use the visual editor to place objects, define agents, set action/observation spaces, and build rules for rewards and termination.
              </p>
              <p className="text-gray-600 leading-relaxed mt-2">
                Grid or continuous — it all fits one universal EnvSpec.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 border-2 border-gray-300 rounded flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                2. Simulate & Debug
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Run rollouts instantly in your browser.
              </p>
              <p className="text-gray-600 leading-relaxed mt-2">
                Inspect rewards, events, trajectories, and environment behavior before training.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 border-2 border-gray-300 rounded flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                3. Train & Export
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Launch PPO, DQN, or imitation learning runs on GPU via a single click.
              </p>
              <p className="text-gray-600 leading-relaxed mt-2">
                Track metrics live, replay rollouts, and export full Gym environments with ready-to-run training scripts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What It Can Do Section */}
      <section className="py-16">
        <div className="max-w-[880px] mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-12 text-center">
            What It Can Do
          </h2>
          <div className="space-y-16">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                  Universal Environment Builder
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Design grid worlds, 2D continuous environments, custom geometry, multi-agent setups — all powered by the same SceneGraph engine.
                </p>
              </div>
              <div className="border border-gray-200 rounded overflow-hidden bg-white shadow-sm cursor-pointer hover:opacity-90 transition-opacity">
                <img
                  src="/images/landing/environment-builder.png"
                  alt="RL Studio environment editor showing 3D grid canvas with object palette, environment controls, and structure settings"
                  className="w-full h-auto object-contain"
                  loading="lazy"
                  onClick={() => setZoomedImage('/images/landing/environment-builder.png')}
                />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="order-2 md:order-1 border border-gray-200 rounded overflow-hidden bg-white shadow-sm cursor-pointer hover:opacity-90 transition-opacity">
                <img
                  src="/images/landing/rollout-visualizer.png"
                  alt="RL Studio rollout preview showing 3D grid environment with agent navigation, rollout controls, and real-time metrics"
                  className="w-full h-auto object-contain"
                  loading="lazy"
                  onClick={() => setZoomedImage('/images/landing/rollout-visualizer.png')}
                />
              </div>
              <div className="order-1 md:order-2">
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                  Live Rollout Visualizer
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Step through episodes, inspect state transitions, debug reward triggers, and preview learned policies.
                </p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                  One-Click Training
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Launch GPU training jobs with PPO or DQN.
                </p>
                <p className="text-gray-600 leading-relaxed mt-2">
                  Monitor progress in real time with metrics, logs, and rollouts streamed back into the studio.
                </p>
              </div>
              <div className="border border-gray-200 rounded overflow-hidden bg-white shadow-sm cursor-pointer hover:opacity-90 transition-opacity">
                <img
                  src="/images/landing/training-config.png"
                  alt="RL Studio training configuration modal showing algorithm selection, hyperparameters, GPU settings, and RL concepts"
                  className="w-full h-auto object-contain"
                  loading="lazy"
                  onClick={() => setZoomedImage('/images/landing/training-config.png')}
                />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="order-2 md:order-1 border border-gray-200 rounded overflow-hidden bg-white shadow-sm cursor-pointer hover:opacity-90 transition-opacity">
                <img
                  src="/images/landing/export-dialog.png"
                  alt="RL Studio export functionality showing file save dialog for exporting environments and training code"
                  className="w-full h-auto object-contain"
                  loading="lazy"
                  onClick={() => setZoomedImage('/images/landing/export-dialog.png')}
                />
              </div>
              <div className="order-1 md:order-2">
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                  Export Everything
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Generate Gymnasium-compatible Python code, training scripts, config files, and complete project bundles.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why RL Studio Section */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-[880px] mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">
            Why RL Studio
          </h2>
          <div className="max-w-2xl mx-auto space-y-6 mb-12">
            <ul className="space-y-4 text-left">
              <li className="flex items-start gap-3">
                <span className="text-gray-900 mt-1">•</span>
                <span className="text-gray-600 flex-1">
                  <strong className="text-gray-900">Simple enough to start.</strong> Powerful enough for real RL research.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-gray-900 mt-1">•</span>
                <span className="text-gray-600 flex-1">
                  <strong className="text-gray-900">No local setup or Python environment headaches.</strong> Everything runs in your browser.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-gray-900 mt-1">•</span>
                <span className="text-gray-600 flex-1">
                  <strong className="text-gray-900">Every environment uses a clean, universal spec.</strong> Built-in rollout debugger and metrics viewer.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-gray-900 mt-1">•</span>
                <span className="text-gray-600 flex-1">
                  <strong className="text-gray-900">GPU training that just works.</strong> Perfect for students, researchers, and engineers.
                </span>
              </li>
            </ul>
          </div>
          <Link
            to="/dashboard"
            className="inline-block px-8 py-3 bg-gray-900 text-white rounded hover:bg-gray-800 transition-colors font-medium"
          >
            Start Building →
          </Link>
        </div>
      </section>

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setZoomedImage(null)}
        >
          <div className="relative max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center">
            <button
              onClick={() => setZoomedImage(null)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-10"
              aria-label="Close"
            >
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <img
              src={zoomedImage}
              alt="Zoomed preview"
              className="max-w-full max-h-full object-contain rounded"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8">
        <div className="max-w-[880px] mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-600">
            <div>© 2024 RL Studio. All rights reserved.</div>
            <div className="flex gap-6">
              <Link to="/login" className="hover:text-gray-900 transition-colors">
                Login
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
