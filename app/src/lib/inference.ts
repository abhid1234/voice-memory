import type { GemmaVariant } from "./model-store";
import { fallbackPolish, fallbackInsights } from "./flow";

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
  private ready = false;

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
      this.ready = true;
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
          this.ready = false;
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
    onToken?: (t: string) => void,
  ): Promise<string> {
    const id = this.nextId++;
    return new Promise<string>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onToken: onToken ?? (() => {}) });
      this.worker.postMessage({ type: "GENERATE", id, query, context });
    });
  }

  generateRaw(
    prompt: string,
    onToken?: (t: string) => void,
  ): Promise<string> {
    const id = this.nextId++;
    return new Promise<string>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onToken: onToken ?? (() => {}) });
      this.worker.postMessage({ type: "GENERATE_RAW", id, prompt });
    });
  }

  isReady(): boolean {
    return this.ready;
  }

  async polishTranscript(rawText: string, style: string, dictionary: string[], customInstruction?: string): Promise<string> {
    if (!this.ready) {
      // Return fallback output immediately if the heavy LLM is not ready/downloaded
      return fallbackPolish(rawText, style, dictionary);
    }

    const styleInstructions: Record<string, string> = {
      cleaned: "Remove filler words, fix grammar and spelling, and output natural, polished prose.",
      bullets: "Format the main points into a clean, structured bullet-point list.",
      email: "Write a professional email draft based on the input. Include standard greeting and closing.",
      slack: "Format as a concise, friendly Slack or team message.",
      raw: "Output the verbatim transcription exactly as is.",
    };

    let styleInstruction = styleInstructions[style];
    if (!styleInstruction && style === "custom" && customInstruction) {
      styleInstruction = `Apply this user custom style instruction to the transcript: "${customInstruction}"`;
    } else if (!styleInstruction) {
      styleInstruction = styleInstructions.cleaned;
    }

    const systemPrompt = `You are Wispr Flow, an expert AI speech editor. Rewrite the following transcript based on the instructions.
    
    Instructions: ${styleInstruction}
    
    Personal Dictionary (ensure these specific words are spelled exactly as shown if they appear in the transcript):
    ${dictionary.join(", ")}
    
    Transcript: "${rawText}"
    
    Polished Output:`;

    const prompt = `<start_of_turn>user\n${systemPrompt}<end_of_turn>\n<start_of_turn>model\n`;

    try {
      const response = await this.generateRaw(prompt);
      return response.trim();
    } catch (err) {
      console.warn("Gemma-2B polishing failed, falling back to local processor:", err);
      return fallbackPolish(rawText, style, dictionary);
    }
  }

  async generateInsights(text: string): Promise<string> {
    if (!this.ready) {
      return fallbackInsights(text);
    }

    const systemPrompt = `You are a productivity helper. Extract a list of action items (todos) and key entities (names, dates, organizations) from the following text. Keep it brief and return it formatted nicely.
    
    Text: "${text}"
    
    Insights:`;

    const prompt = `<start_of_turn>user\n${systemPrompt}<end_of_turn>\n<start_of_turn>model\n`;

    try {
      const response = await this.generateRaw(prompt);
      return response.trim();
    } catch (err) {
      console.warn("Gemma-2B insights failed, falling back to local processor:", err);
      return fallbackInsights(text);
    }
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

// Export a legacy compatibility object that calls getInference()
export const inference = {
  get client() {
    return getInference();
  },
  polishTranscript(rawText: string, style: string, dictionary: string[], customInstruction?: string) {
    return getInference().polishTranscript(rawText, style, dictionary, customInstruction);
  },
  generateInsights(text: string) {
    return getInference().generateInsights(text);
  },
  generateResponse(query: string, context: string, onToken?: (t: string) => void) {
    return getInference().generateResponse(query, context, onToken);
  },
  isReady() {
    return getInference().isReady();
  },
};
