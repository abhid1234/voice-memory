import { describe, it, expect } from "vitest";
import { InferenceClient } from "./inference";
import type { LlmWorkerLike } from "./inference";

class FakeWorker implements LlmWorkerLike {
  posted: unknown[] = [];
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  postMessage(m: unknown) {
    this.posted.push(m);
  }
  emit(m: unknown) {
    this.onmessage?.({ data: m });
  }
}

describe("InferenceClient", () => {
  it("streams tokens then resolves with the final text", async () => {
    const fake = new FakeWorker();
    const client = new InferenceClient(fake);
    const tokens: string[] = [];
    const promise = client.generateResponse("q", "ctx", (t) => tokens.push(t));
    // first GENERATE message carries an id
    const sent = fake.posted[0] as { type: string; id: number };
    expect(sent.type).toBe("GENERATE");
    fake.emit({ type: "TOKEN", id: sent.id, text: "Hel" });
    fake.emit({ type: "TOKEN", id: sent.id, text: "lo" });
    fake.emit({ type: "DONE", id: sent.id, text: "Hello" });
    expect(await promise).toBe("Hello");
    expect(tokens).toEqual(["Hel", "lo"]);
  });

  it("rejects on ERROR for that id", async () => {
    const fake = new FakeWorker();
    const client = new InferenceClient(fake);
    const promise = client.generateResponse("q", "ctx", () => {});
    const sent = fake.posted[0] as { id: number };
    fake.emit({ type: "ERROR", id: sent.id, error: "load failed" });
    await expect(promise).rejects.toThrow("load failed");
  });

  it("init() resolves when the worker reports READY for that id", async () => {
    const fake = new FakeWorker();
    const client = new InferenceClient(fake);
    const p = client.init("E2B");
    const sent = fake.posted[0] as {
      type: string;
      id: number;
      variant: string;
    };
    expect(sent.type).toBe("INIT");
    expect(sent.variant).toBe("E2B");
    fake.emit({ type: "READY", id: sent.id });
    await expect(p).resolves.toBeUndefined();
  });

  it("init() rejects on init ERROR and allows a retry", async () => {
    const fake = new FakeWorker();
    const client = new InferenceClient(fake);
    const p1 = client.init("E2B");
    const id1 = (fake.posted[0] as { id: number }).id;
    fake.emit({ type: "ERROR", id: id1, error: "model load failed" });
    await expect(p1).rejects.toThrow("model load failed");
    // initPromise was cleared on failure, so a retry posts a fresh INIT
    const p2 = client.init("E2B");
    expect(fake.posted.length).toBe(2);
    fake.emit({ type: "READY", id: (fake.posted[1] as { id: number }).id });
    await expect(p2).resolves.toBeUndefined();
  });

  it("init() is idempotent while in flight (single INIT message)", async () => {
    const fake = new FakeWorker();
    const client = new InferenceClient(fake);
    const a = client.init("E2B");
    const b = client.init("E2B");
    expect(fake.posted.length).toBe(1);
    fake.emit({ type: "READY", id: (fake.posted[0] as { id: number }).id });
    await Promise.all([a, b]);
  });

  it("generateRaw posts GENERATE_RAW and resolves with the response", async () => {
    const fake = new FakeWorker();
    const client = new InferenceClient(fake);
    const promise = client.generateRaw("custom prompt");
    const sent = fake.posted[0] as { type: string; id: number; prompt: string };
    expect(sent.type).toBe("GENERATE_RAW");
    expect(sent.prompt).toBe("custom prompt");
    fake.emit({ type: "DONE", id: sent.id, text: "raw result" });
    expect(await promise).toBe("raw result");
  });

  it("isReady reports false initially, then true after READY", async () => {
    const fake = new FakeWorker();
    const client = new InferenceClient(fake);
    expect(client.isReady()).toBe(false);
    
    // Trigger READY
    fake.emit({ type: "READY" });
    expect(client.isReady()).toBe(true);
  });

  it("polishTranscript uses fallback when not ready", async () => {
    const fake = new FakeWorker();
    const client = new InferenceClient(fake);
    expect(client.isReady()).toBe(false);

    const result = await client.polishTranscript("um hello", "cleaned", []);
    expect(result).toBe("Hello");
    expect(fake.posted).toHaveLength(0);
  });

  it("polishTranscript uses generateRaw when ready", async () => {
    const fake = new FakeWorker();
    const client = new InferenceClient(fake);
    fake.emit({ type: "READY" });
    expect(client.isReady()).toBe(true);

    const promise = client.polishTranscript("raw input", "cleaned", ["DictionaryWord"]);
    
    // We expect a GENERATE_RAW message
    const sent = fake.posted[0] as { type: string; id: number; prompt: string };
    expect(sent.type).toBe("GENERATE_RAW");
    expect(sent.prompt).toContain("DictionaryWord");
    expect(sent.prompt).toContain("raw input");

    fake.emit({ type: "DONE", id: sent.id, text: "Polished output by model" });
    expect(await promise).toBe("Polished output by model");
  });

  it("polishTranscript catches error and uses fallback", async () => {
    const fake = new FakeWorker();
    const client = new InferenceClient(fake);
    fake.emit({ type: "READY" });

    const promise = client.polishTranscript("um hello", "cleaned", []);
    const sent = fake.posted[0] as { id: number };
    fake.emit({ type: "ERROR", id: sent.id, error: "inference failed" });
    
    expect(await promise).toBe("Hello");
  });

  it("generateInsights uses fallback when not ready", async () => {
    const fake = new FakeWorker();
    const client = new InferenceClient(fake);
    expect(client.isReady()).toBe(false);

    const result = await client.generateInsights("need to do task");
    expect(result).toContain("📋 **Action Items:**");
    expect(fake.posted).toHaveLength(0);
  });

  it("generateInsights uses generateRaw when ready", async () => {
    const fake = new FakeWorker();
    const client = new InferenceClient(fake);
    fake.emit({ type: "READY" });

    const promise = client.generateInsights("some text");
    const sent = fake.posted[0] as { type: string; id: number; prompt: string };
    expect(sent.type).toBe("GENERATE_RAW");
    expect(sent.prompt).toContain("some text");

    fake.emit({ type: "DONE", id: sent.id, text: "Extracted insights by model" });
    expect(await promise).toBe("Extracted insights by model");
  });

  it("generateInsights catches error and uses fallback", async () => {
    const fake = new FakeWorker();
    const client = new InferenceClient(fake);
    fake.emit({ type: "READY" });

    const promise = client.generateInsights("need to do task");
    const sent = fake.posted[0] as { id: number };
    fake.emit({ type: "ERROR", id: sent.id, error: "inference failed" });
    
    expect(await promise).toContain("📋 **Action Items:**");
  });
});
