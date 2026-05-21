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
});
