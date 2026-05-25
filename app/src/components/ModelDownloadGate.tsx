import { useEffect, useState } from "react";
import {
  downloadModel,
  isModelCached,
  isWebGPUAvailable,
  type GemmaVariant,
} from "../lib/model-store";
import { getInference } from "../lib/inference";

const VARIANT: GemmaVariant = "E2B"; // Chromebook can switch to 'E4B' (Task 1 spike)

type State =
  | "checking"
  | "no-webgpu"
  | "needs-download"
  | "downloading"
  | "loading"
  | "ready"
  | "load-error";

export default function ModelDownloadGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<State>("checking");
  const [pct, setPct] = useState(0);

  useEffect(() => {
    void (async () => {
      if (!(await isWebGPUAvailable())) return setState("no-webgpu");
      // Cached -> load into the worker; otherwise prompt for the one-time download.
      setState((await isModelCached(VARIANT)) ? "loading" : "needs-download");
    })();
  }, []);

  // Load the model into the worker, and surface a failure (e.g. a corrupt or
  // partial cache) instead of rendering the query UI on a false "ready" state.
  useEffect(() => {
    if (state !== "loading") return;
    let cancelled = false;
    getInference()
      .init(VARIANT)
      .then(() => {
        if (!cancelled) setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("load-error");
      });
    return () => {
      cancelled = true;
    };
  }, [state]);

  const download = async () => {
    setState("downloading");
    try {
      await downloadModel(VARIANT, ({ loadedBytes, totalBytes }) =>
        setPct(totalBytes ? Math.round((loadedBytes / totalBytes) * 100) : 0),
      );
      setState("loading");
    } catch {
      setState("needs-download");
    }
  };

  if (state === "ready") return <>{children}</>;
  if (state === "checking")
    return (
      <main className="query-workspace">
        <div className="section-card model-gate-card checking-state">
          <div className="gate-spinner"></div>
          <h3 className="gate-title">Checking Device</h3>
          <p className="status-text">Evaluating hardware and caching status…</p>
        </div>
      </main>
    );
  if (state === "no-webgpu")
    return (
      <main className="query-workspace">
        <div className="section-card model-gate-card warning-card">
          <div className="warning-icon">⚠️</div>
          <div className="gate-content">
            <h3 className="gate-title">WebGPU Required</h3>
            <p className="status-text">
              On-device AI needs WebGPU, which this browser doesn't support. Try
              Chrome on a laptop/Chromebook. Recording and your timeline still work.
            </p>
          </div>
        </div>
      </main>
    );
  if (state === "downloading")
    return (
      <main className="query-workspace">
        <div className="section-card model-gate-card downloading-state">
          <h3 className="gate-title">Downloading Model</h3>
          <p className="status-text">Retrieving weights to enable secure, offline semantic query capabilities.</p>
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${pct}%` }}></div>
          </div>
          <span className="progress-percent">{pct}%</span>
        </div>
      </main>
    );
  if (state === "loading")
    return (
      <main className="query-workspace">
        <div className="section-card model-gate-card loading-state">
          <div className="gate-spinner"></div>
          <h3 className="gate-title">Loading Model</h3>
          <p className="status-text">Initializing offline neural engine. This may take a few seconds...</p>
        </div>
      </main>
    );
  if (state === "load-error")
    return (
      <main className="query-workspace">
        <div className="section-card model-gate-card error-card">
          <div className="error-icon">❌</div>
          <div className="gate-content">
            <h3 className="gate-title">Initialization Failed</h3>
            <p className="status-text">
              The on-device model failed to load (it may not have finished
              downloading or system resources are low).
            </p>
            <button className="gate-btn" onClick={() => setState("loading")}>
              <span>Retry Load</span>
              <svg 
                style={{ width: '16px', height: '16px', strokeWidth: 2.5 }} 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M23 4v6h-6" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
          </div>
        </div>
      </main>
    );
  return (
    <main className="query-workspace">
      <div className="section-card model-gate-card download-request-card">
        <div className="sparkle-icon">✨</div>
        <div className="gate-content">
          <h3 className="gate-title">Activate Offline Search Engine</h3>
          <p className="status-text">
            A one-time on-device AI model download is needed to analyze and answer questions from your local memories database.
          </p>
          <button className="gate-btn" onClick={download}>
            <span>Download local AI model</span>
            <svg 
              style={{ width: '16px', height: '16px', strokeWidth: 2.5 }} 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
        </div>
      </div>
    </main>
  );
}
