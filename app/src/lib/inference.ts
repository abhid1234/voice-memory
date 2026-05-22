import type { GemmaVariant } from "./model-store";

export interface LlmWorkerLike {
  postMessage(message: unknown): void;
  onmessage: ((ev: { data: unknown }) => void) | null;
}

type Pending = {
  resolve: (s: string) => void;
  reject: (e: Error) => void;
  onToken: (t: string) => void;
};

export class InferenceClient {
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private worker: LlmWorkerLike;
  private initPromise: Promise<void> | null = null;

  constructor(worker: LlmWorkerLike) {
    this.worker = worker;
    this.worker.onmessage = (ev) => this.dispatch(ev.data);
  }

  private dispatch(m: unknown) {
    const msg = m as {
      type: string;
      id?: number;
      text?: string;
      error?: string;
    };
    if (msg.type === "READY") {
      if (msg.id != null) {
        const p = this.pending.get(msg.id);
        if (p) {
          this.pending.delete(msg.id);
          p.resolve("");
        }
      }
      return;
    }
    if (msg.id == null) return;
    const p = this.pending.get(msg.id);
    if (!p) return;
    if (msg.type === "TOKEN") {
      p.onToken(msg.text ?? "");
    } else if (msg.type === "DONE") {
      this.pending.delete(msg.id);
      p.resolve(msg.text ?? "");
    } else if (msg.type === "ERROR") {
      this.pending.delete(msg.id);
      p.reject(new Error(msg.error ?? "inference error"));
    }
  }

  /**
   * Load the model in the worker. Resolves on READY, rejects if init fails so
   * callers can surface it. Idempotent while in flight; a failed init clears so
   * a later call retries the load.
   */
  init(variant: GemmaVariant): Promise<void> {
    if (this.initPromise) return this.initPromise;
    const id = this.nextId++;
    this.initPromise = new Promise<void>((resolve, reject) => {
      this.pending.set(id, {
        resolve: () => resolve(),
        reject: (e) => {
          this.initPromise = null;
          reject(e);
        },
        onToken: () => {},
      });
      this.worker.postMessage({ type: "INIT", id, variant });
    });
    return this.initPromise;
  }

  generateResponse(
    query: string,
    context: string,
    onToken: (t: string) => void,
  ): Promise<string> {
    const id = this.nextId++;
    return new Promise<string>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onToken });
      this.worker.postMessage({ type: "GENERATE", id, query, context });
    });
  }
}

let singleton: InferenceClient | null = null;

/** Lazily creates the real llm-worker-backed client (not used in unit tests). */
export function getInference(): InferenceClient {
  if (!singleton) {
    const worker = new Worker(new URL("./llm-worker.ts", import.meta.url), {
      type: "module",
    });
    singleton = new InferenceClient(worker as unknown as LlmWorkerLike);
  }
  return singleton;
}

// TEMP shim so the Phase C Demo page keeps compiling until it is reworked in Phase C.
export const inference = {
  async generateResponse(prompt: string, _context: string): Promise<string> {
    void _context;
    return `(demo placeholder) ${prompt}`;
  },
};
