import { describe, it, expect, beforeEach } from "vitest";
import {
  saveMemo,
  getAllMemos,
  getMemo,
  deleteMemo,
  exportTranscriptsForTraining,
} from "./storage";
import type { VoiceMemo } from "./storage";

function makeMemo(overrides: Partial<VoiceMemo> = {}): VoiceMemo {
  return {
    timestamp: 1_716_150_000_000,
    transcript: "hello world",
    embedding: new Float32Array([0.1, 0.2, 0.3]),
    ...overrides,
  };
}

beforeEach(async () => {
  for (const m of await getAllMemos()) {
    await deleteMemo(m.id!);
  }
});

describe("storage", () => {
  it("saves a memo and reads it back with its embedding intact", async () => {
    const id = await saveMemo(makeMemo());
    const all = await getAllMemos();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(id);
    expect(all[0].transcript).toBe("hello world");
    // Realm-agnostic type check: jsdom + fake-indexeddb can return a typed array
    // from a different JS realm, so `instanceof Float32Array` is unreliable in tests.
    expect(Object.prototype.toString.call(all[0].embedding)).toBe(
      "[object Float32Array]",
    );
    expect(all[0].embedding.length).toBe(3);
    expect(Array.from(all[0].embedding)).toEqual([
      expect.closeTo(0.1),
      expect.closeTo(0.2),
      expect.closeTo(0.3),
    ]);
  });

  it("getMemo returns the memo by id, or undefined when absent", async () => {
    const id = await saveMemo(makeMemo({ transcript: "find me" }));
    const found = await getMemo(id);
    expect(found?.transcript).toBe("find me");
    expect(await getMemo(999_999)).toBeUndefined();
  });

  it("deleteMemo removes the memo", async () => {
    const id = await saveMemo(makeMemo());
    await deleteMemo(id);
    expect(await getAllMemos()).toHaveLength(0);
  });

  it("exportTranscriptsForTraining emits one JSON line per memo", async () => {
    await saveMemo(makeMemo({ transcript: "a", timestamp: 1 }));
    await saveMemo(makeMemo({ transcript: "b", timestamp: 2 }));
    const jsonl = await exportTranscriptsForTraining();
    const lines = jsonl
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    expect(lines).toEqual(
      expect.arrayContaining([
        { text: "a", timestamp: 1 },
        { text: "b", timestamp: 2 },
      ]),
    );
  });
});
