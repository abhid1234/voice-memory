import { describe, it, expect, vi, afterEach } from "vitest";
import { generateGeminiResponse } from "./gemini";

describe("generateGeminiResponse", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("should throw error if apiKey is empty", async () => {
    await expect(generateGeminiResponse("", "test")).rejects.toThrow("Gemini API key is required");
  });

  it("should call fetch with correct URL and headers and return candidate text on 200 OK", async () => {
    const mockResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: "Hello from Gemini" }],
          },
        },
      ],
    };

    const mockFetch = vi.fn().mockImplementation((url, init) => {
      expect(url).toContain("key=test-key");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body).contents[0].parts[0].text).toBe("Hello prompt");
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });
    });

    vi.stubGlobal("fetch", mockFetch);

    const result = await generateGeminiResponse("test-key", "Hello prompt");
    expect(result).toBe("Hello from Gemini");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should throw formatted error message when API returns error status", async () => {
    const mockErrorResponse = {
      error: {
        message: "API key expired",
      },
    };

    const mockFetch = vi.fn().mockImplementation(() => {
      return Promise.resolve({
        ok: false,
        status: 400,
        json: () => Promise.resolve(mockErrorResponse),
      });
    });

    vi.stubGlobal("fetch", mockFetch);

    await expect(generateGeminiResponse("test-key", "Hello prompt")).rejects.toThrow("Gemini API Error: API key expired");
  });
});
