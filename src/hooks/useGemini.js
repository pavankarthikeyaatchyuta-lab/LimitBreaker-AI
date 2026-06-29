// src/hooks/useGemini.js

const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`;

export async function callGemini(systemPrompt, userMessage) {
  const response = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: userMessage }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  // Strip markdown code fences before parsing JSON
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

  return cleaned;
}

export async function callGeminiJSON(systemPrompt, userMessage) {
  const raw = await callGemini(systemPrompt, userMessage);
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("Gemini JSON parse failed:", raw);
    throw new Error("Agent returned invalid JSON");
  }
}
