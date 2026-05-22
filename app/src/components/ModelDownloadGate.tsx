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
    return <p className="status-text">Checking device…</p>;
  if (state === "no-webgpu")
    return (
      <p className="status-text">
        On-device AI needs WebGPU, which this browser doesn't support. Try
        Chrome on a laptop/Chromebook. Recording and your timeline still work.
      </p>
    );
  if (state === "downloading")
    return <p className="status-text">Downloading on-device model… {pct}%</p>;
  if (state === "loading")
    return <p className="status-text">Loading on-device model…</p>;
  if (state === "load-error")
    return (
      <div className="card">
        <p className="status-text">
          The on-device model failed to load (it may not have finished
          downloading). Retry to load it again.
        </p>
        <button className="record-btn" onClick={() => setState("loading")}>
          Retry
        </button>
      </div>
    );
  return (
    <div className="card">
      <p className="status-text">
        A one-time on-device AI model download is needed to answer questions.
      </p>
      <button className="record-btn" onClick={download}>
        Download model
      </button>
    </div>
  );
}
