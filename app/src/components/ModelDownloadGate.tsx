import { useEffect, useState } from "react";
import {
  downloadModel,
  isModelCached,
  isWebGPUAvailable,
  type GemmaVariant,
} from "../lib/model-store";
import { getInference } from "../lib/inference";

const VARIANT: GemmaVariant = "E2B"; // Chromebook can switch to 'E4B' (Task 1 spike)

export type AssetState =
  | "checking"
  | "no-webgpu"
  | "needs-download"
  | "downloading"
  | "loading"
  | "ready"
  | "load-error";

export default function ModelDownloadGate({
  children,
  onStateChange,
  inline = false,
}: {
  children?: React.ReactNode;
  onStateChange?: (state: AssetState) => void;
  inline?: boolean;
}) {
  const [state, setState] = useState<AssetState>("checking");
  const [pct, setPct] = useState(0);

  useEffect(() => {
    void (async () => {
      if (!(await isWebGPUAvailable())) return setState("no-webgpu");
      // Cached -> load into the worker; otherwise prompt for the one-time download.
      setState((await isModelCached(VARIANT)) ? "loading" : "needs-download");
    })();
  }, []);

  // Notify parent of state changes if callback is provided
  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

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

  if (inline) {
    if (state === "ready") {
      return (
        <div className="model-status-badge">
          <span className="status-dot green"></span>
          <span className="status-text">AI Synthesis Active (Gemma 4 E2B)</span>
        </div>
      );
    }
    if (state === "checking") {
      return (
        <div className="model-gate-card-inline checking-state">
          <div className="gate-spinner-small"></div>
          <span className="status-text">Checking AI hardware and cache status…</span>
        </div>
      );
    }
    if (state === "no-webgpu") {
      return (
        <div className="model-gate-card-inline warning-card">
          <span className="warning-icon" style={{ fontSize: '1.25rem', marginRight: '0.2rem' }}>⚠️</span>
          <span className="status-text">
            Offline AI synthesis requires WebGPU (unsupported on this browser). Semantic search is active.
          </span>
        </div>
      );
    }
    if (state === "downloading") {
      return (
        <div className="model-gate-card-inline downloading-state">
          <div className="gate-title-row">
            <h4 className="gate-title-inline">Downloading AI Model (One-Time Setup)</h4>
            <span className="progress-percent" style={{ fontSize: 'var(--fs-sm)' }}>{pct}%</span>
          </div>
          <div className="progress-bar-container" style={{ margin: '0.4rem 0 0.2rem 0', maxWidth: 'none' }}>
            <div className="progress-bar-fill" style={{ width: `${pct}%` }}></div>
          </div>
          <span className="status-text" style={{ fontSize: 'var(--fs-xs)' }}>
            Retrieving 2.2GB model weights locally. Feel free to use semantic search in the meantime.
          </span>
        </div>
      );
    }
    if (state === "loading") {
      return (
        <div className="model-gate-card-inline loading-state">
          <div className="gate-spinner-small"></div>
          <span className="status-text">Initializing offline neural engine. This may take a few seconds...</span>
        </div>
      );
    }
    if (state === "load-error") {
      return (
        <div className="model-gate-card-inline error-card">
          <span className="error-icon" style={{ fontSize: '1.25rem', marginRight: '0.2rem' }}>❌</span>
          <div className="gate-content">
            <span className="status-text">AI engine failed to load (low device memory or WebGPU issue).</span>
            <button className="gate-btn-small" onClick={() => setState("loading")}>
              <span>Retry Load</span>
              <svg 
                style={{ width: '12px', height: '12px', strokeWidth: 2.5 }} 
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
      );
    }
    // needs-download
    return (
      <div className="model-gate-card-inline download-request-card">
        <span className="sparkle-icon" style={{ fontSize: '1.25rem', marginRight: '0.2rem' }}>✨</span>
        <div className="gate-content">
          <p className="status-text">
            Activate local AI synthesis to get customized summaries of your memories (2.2GB download).
          </p>
          <button className="gate-btn-small" onClick={download}>
            <span>Activate AI Synthesis</span>
            <svg 
              style={{ width: '12px', height: '12px', strokeWidth: 2.5 }} 
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
    );
  }

  // Original Full-screen wrapped rendering (compatibility mode for existing tests)
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
