import Groq from "groq-sdk";

const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_TIMEOUT_MS = 20000;

let client;

function getGroqKey() {
  return import.meta.env.VITE_GROQ_API_KEY?.trim();
}

function getClient() {
  const apiKey = getGroqKey();
  if (!apiKey) {
    throw new Error("Groq API error: missing VITE_GROQ_API_KEY");
  }

  if (!client) {
    client = new Groq({
      apiKey,
      dangerouslyAllowBrowser: true,
    });
  }

  return client;
}

function stripJsonFences(text) {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

export async function callGroq(systemPrompt, userMessage) {
  const timeout = AbortSignal.timeout(GROQ_TIMEOUT_MS);
  const response = await getClient().chat.completions.create(
    {
      model: GROQ_MODEL,
      temperature: 0.2,
      max_tokens: 2048,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${systemPrompt}\n\nReturn only raw valid JSON. Do not include markdown fences, prose, comments, or explanations.`,
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
    },
    { signal: timeout },
  );

  return stripJsonFences(response.choices?.[0]?.message?.content ?? "");
}
