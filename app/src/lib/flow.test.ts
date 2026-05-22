import { describe, it, expect } from "vitest";
import { fallbackPolish, fallbackInsights } from "./flow";

describe("fallbackPolish", () => {
  it("should return empty string for empty input", () => {
    expect(fallbackPolish("", "cleaned", [])).toBe("");
    expect(fallbackPolish("   ", "cleaned", [])).toBe("");
  });

  it("should remove filler words", () => {
    expect(fallbackPolish("um, so uh, er, hello ah eh world", "cleaned", [])).toBe(", so , , hello world");
    // Clean spaces
    expect(fallbackPolish("um hello", "cleaned", [])).toBe("Hello");
  });

  it("should replace dictionary words case-insensitively using dictionary casing", () => {
    const dictionary = ["Gemma", "Whisper", "Vite"];
    expect(fallbackPolish("using gemma and whisper and vite", "cleaned", dictionary)).toBe(
      "Using Gemma and Whisper and Vite"
    );
  });

  it("should format as bullets", () => {
    const text = "Hello world. This is a sentence. Need to do stuff.";
    const result = fallbackPolish(text, "bullets", []);
    expect(result).toBe("• Hello world.\n• This is a sentence.\n• Need to do stuff.");
  });

  it("should format as email", () => {
    const text = "Meeting notes";
    const result = fallbackPolish(text, "email", []);
    expect(result).toContain("Subject: Dictated Notes");
    expect(result).toContain("Hi team,\n\nMeeting notes\n\nBest regards,\n[My Name]");
  });

  it("should format as slack", () => {
    const text = "hello";
    const result = fallbackPolish(text, "slack", []);
    expect(result).toBe("👋 Hello");
  });

  it("should format as custom", () => {
    const text = "hello";
    const result = fallbackPolish(text, "custom", []);
    expect(result).toContain("[Local Fallback: Gemma model is downloading/offline.");
    expect(result).toContain("Hello");
  });

  it("should return raw text unmodified for style raw", () => {
    expect(fallbackPolish("  um hello  ", "raw", [])).toBe("  um hello  ");
  });
});

describe("fallbackInsights", () => {
  it("should return default message for empty input", () => {
    expect(fallbackInsights("")).toBe("No content to analyze.");
    expect(fallbackInsights("   ")).toBe("No content to analyze.");
  });

  it("should detect action items", () => {
    const text = "I need to call John tomorrow. Remember to buy milk. Today is a nice day.";
    const result = fallbackInsights(text);
    expect(result).toContain("📋 **Action Items:**");
    expect(result).toContain("• I need to call John tomorrow.");
    expect(result).toContain("• Remember to buy milk.");
    expect(result).not.toContain("Today is a nice day.");
  });

  it("should detect entities based on capitalization rules", () => {
    const text = "John visited Paris and Berlin.";
    const result = fallbackInsights(text);
    expect(result).toContain("🔑 **Key Entities:** John, Paris, Berlin");
  });

  it("should handle cases with no action items or entities", () => {
    const text = "hello world";
    const result = fallbackInsights(text);
    expect(result).toContain("📋 **Action Items:** None detected.");
    expect(result).toContain("🔑 **Key Entities:** None detected.");
  });
});
