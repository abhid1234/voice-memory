import { describe, it, expect } from "vitest";

describe("test harness", () => {
  it("runs assertions", () => {
    expect(1 + 1).toBe(2);
  });

  it("provides indexedDB via fake-indexeddb", () => {
    expect(typeof indexedDB).not.toBe("undefined");
  });
});
