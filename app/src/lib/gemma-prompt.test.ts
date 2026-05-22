import { describe, it, expect } from "vitest";
import { buildGemmaPrompt } from "./gemma-prompt";

describe("buildGemmaPrompt", () => {
  const p = buildGemmaPrompt("What did I say about X?", "[1] I said X is good.");
  it("wraps a single user turn and opens a model turn", () => {
    expect(p).toContain("<start_of_turn>user\n");
    expect(p.trimEnd()).toMatch(/<start_of_turn>model$/);
  });
  it("embeds the context and the question, and instructs memory-only answers", () => {
    expect(p).toContain("[1] I said X is good.");
    expect(p).toContain("What did I say about X?");
    expect(p.toLowerCase()).toContain("only");
  });
});
