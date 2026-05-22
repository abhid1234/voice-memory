import { describe, it, expect } from "vitest";
import { computeWordDiff } from "./diff";

describe("computeWordDiff", () => {
  it("should handle empty strings", () => {
    expect(computeWordDiff("", "")).toEqual([]);
    expect(computeWordDiff("hello", "")).toEqual([
      { type: "removed", value: "hello" }
    ]);
    expect(computeWordDiff("", "world")).toEqual([
      { type: "added", value: "world" }
    ]);
  });

  it("should return unchanged for identical strings", () => {
    expect(computeWordDiff("hello world", "hello world")).toEqual([
      { type: "unchanged", value: "hello" },
      { type: "unchanged", value: "world" }
    ]);
  });

  it("should identify added words", () => {
    expect(computeWordDiff("hello world", "hello brave new world")).toEqual([
      { type: "unchanged", value: "hello" },
      { type: "added", value: "brave" },
      { type: "added", value: "new" },
      { type: "unchanged", value: "world" }
    ]);
  });

  it("should identify removed words", () => {
    expect(computeWordDiff("hello brave new world", "hello world")).toEqual([
      { type: "unchanged", value: "hello" },
      { type: "removed", value: "brave" },
      { type: "removed", value: "new" },
      { type: "unchanged", value: "world" }
    ]);
  });

  it("should normalize punctuation differences", () => {
    // hello and hello! are matching in normalization, so they are marked as unchanged but new version is kept
    expect(computeWordDiff("hello.", "hello!")).toEqual([
      { type: "unchanged", value: "hello!" }
    ]);
  });

  it("should handle complex replacements", () => {
    expect(computeWordDiff("the quick brown fox", "the fast brown cat")).toEqual([
      { type: "unchanged", value: "the" },
      { type: "removed", value: "quick" },
      { type: "added", value: "fast" },
      { type: "unchanged", value: "brown" },
      { type: "removed", value: "fox" },
      { type: "added", value: "cat" }
    ]);
  });
});
