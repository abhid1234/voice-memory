import { LlmInference, FilesetResolver } from "@mediapipe/tasks-genai";
import { getModelBytes, type GemmaVariant } from "./model-store";
import { buildGemmaPrompt } from "./gemma-prompt";

type InMsg =
  | { type: "INIT"; id: number; variant: GemmaVariant }
  | { type: "GENERATE"; id: number; query: string; context: string }
  | { type: "GENERATE_RAW"; id: number; prompt: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let llm: any = null;
let initPromise: Promise<void> | null = null;

async function doInit(variant: GemmaVariant) {
  const bytes = await getModelBytes(variant);
  const fileset = await FilesetResolver.forGenAiTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@0.10.27/wasm",
  );
  llm = await LlmInference.createFromOptions(fileset, {
    baseOptions: { modelAssetBuffer: bytes },
    maxTokens: 512,
    topK: 40,
    temperature: 0.7,
  });
}

/** Idempotent: starts init once and returns the same promise for concurrent callers. */
function ensureInit(variant: GemmaVariant) {
  if (!initPromise) {
    initPromise = doInit(variant).catch((e) => {
      initPromise = null; // allow a retry after a failed load
      throw e;
    });
  }
  return initPromise;
}

const post = (m: unknown) => (self as unknown as Worker).postMessage(m);

self.onmessage = async (ev: MessageEvent) => {
  const msg = ev.data as InMsg;
  try {
    if (msg.type === "INIT") {
      await ensureInit(msg.variant);
      post({ type: "READY", id: msg.id });
    } else if (msg.type === "GENERATE") {
      // A GENERATE can arrive while INIT's model load is still in flight; wait for it.
      if (!initPromise) throw new Error("LLM not initialized (INIT not sent)");
      await initPromise;
      const prompt = buildGemmaPrompt(msg.query, msg.context);
      let last = "";
      const progressListener = (partial: string) => {
        const delta = partial.slice(last.length);
        last = partial;
        if (delta) post({ type: "TOKEN", id: msg.id, text: delta });
      };
      const final: string = await llm.generateResponse(prompt, progressListener);
      post({ type: "DONE", id: msg.id, text: final });
    } else if (msg.type === "GENERATE_RAW") {
      if (!initPromise) throw new Error("LLM not initialized (INIT not sent)");
      await initPromise;
      let last = "";
      const progressListener = (partial: string) => {
        const delta = partial.slice(last.length);
        last = partial;
        if (delta) post({ type: "TOKEN", id: msg.id, text: delta });
      };
      const final: string = await llm.generateResponse(msg.prompt, progressListener);
      post({ type: "DONE", id: msg.id, text: final });
    }
  } catch (e) {
    post({
      type: "ERROR",
      id: (msg as { id?: number }).id ?? -1,
      error: e instanceof Error ? e.message : String(e),
    });
  }
};

