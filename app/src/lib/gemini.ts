/**
 * Helper to query the Google Gemini API directly using a user-provided API key.
 * Uses native fetch to keep the application lightweight.
 */
export async function generateGeminiResponse(apiKey: string, prompt: string): Promise<string> {
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("Gemini API key is required");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
      },
    }),
  });

  if (!response.ok) {
    let errorMessage = `HTTP error! status: ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson?.error?.message) {
        errorMessage = errorJson.error.message;
      }
    } catch {
      // Ignored
    }
    throw new Error(`Gemini API Error: ${errorMessage}`);
  }

  const data = await response.json();
  const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (typeof candidateText !== "string") {
    throw new Error("Invalid response format received from Gemini API");
  }

  return candidateText;
}
