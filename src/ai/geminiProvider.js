const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
const GEMINI_MODEL = "gemini-3.5-flash";
const GEMINI_TIMEOUT_MS = 20000;

function getGeminiKey() {
  return import.meta.env.VITE_GEMINI_API_KEY?.trim();
}

function timeoutSignal(ms) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(new DOMException("Gemini timed out", "TimeoutError")), ms);
  return { signal: controller.signal, cancel: () => window.clearTimeout(timeoutId) };
}

function stripJsonFences(text) {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

function extractInteractionText(data) {
  const output = data.output ?? data.response ?? data;
  const candidatesText = output.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof candidatesText === "string") return candidatesText;

  const directText = output.output_text ?? output.text ?? output.outputText ?? output.content?.[0]?.text;
  if (typeof directText === "string") return directText;

  const outputItems = output.output ?? output.items ?? output.steps ?? [];
  for (const item of outputItems) {
    if (typeof item?.text === "string") return item.text;
    if (typeof item?.content === "string") return item.content;
    const partText = item?.content?.find?.((part) => typeof part?.text === "string")?.text;
    if (partText) return partText;
    const partsText = item?.parts?.find?.((part) => typeof part?.text === "string")?.text;
    if (partsText) return partsText;
  }

  return "";
}

function parseGeminiError(responseText) {
  try {
    const errorJson = JSON.parse(responseText);
    const error = Array.isArray(errorJson) ? errorJson[0]?.error : errorJson.error;
    const reason = error?.details?.find?.((detailItem) => detailItem?.reason)?.reason;
    return reason || error?.status || error?.message || responseText;
  } catch {
    return responseText;
  }
}

export async function callGemini(systemPrompt, userMessage) {
  const apiKey = getGeminiKey();
  if (!apiKey) {
    throw new Error("Gemini API error: missing VITE_GEMINI_API_KEY");
  }

  const timeout = timeoutSignal(GEMINI_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      signal: timeout.signal,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model: GEMINI_MODEL,
        input: userMessage,
        system_instruction: `${systemPrompt}\n\nReturn only raw valid JSON. Do not include markdown fences, prose, comments, or explanations.`,
        generation_config: {
          temperature: 0.2,
          max_output_tokens: 2048,
          response_mime_type: "application/json",
        },
      }),
    });
  } catch (error) {
    const reason = error?.name === "AbortError" || error?.name === "TimeoutError" ? "TIMEOUT" : `NETWORK ${error.message}`;
    throw new Error(`Gemini API error: ${reason}`);
  } finally {
    timeout.cancel();
  }

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} ${parseGeminiError(responseText)}`);
  }

  const data = responseText ? JSON.parse(responseText) : {};
  return stripJsonFences(extractInteractionText(data));
}
