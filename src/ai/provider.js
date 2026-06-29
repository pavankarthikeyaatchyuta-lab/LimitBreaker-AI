import { callGemini } from "./geminiProvider";
import { callGroq } from "./groqProvider";

function setActiveProvider(provider) {
  if (import.meta.env.DEV) {
    console.info(`[LimitBreaker AI] Active provider: ${provider}`);
  }
}

function shouldFallback(error) {
  const message = String(error?.message || error);
  return (
    /Gemini API error: 429/.test(message) ||
    /RESOURCE_EXHAUSTED/.test(message) ||
    /TIMEOUT/.test(message) ||
    /NETWORK/.test(message) ||
    /Failed to fetch/.test(message) ||
    /Agent returned invalid JSON/.test(message) ||
    /invalid JSON/i.test(message) ||
    /Gemini API error: (400|401|403|5\d\d)/.test(message)
  );
}

function parseJSON(raw, provider) {
  try {
    return JSON.parse(raw);
  } catch {
    console.error(`${provider} JSON parse failed:`, raw);
    throw new Error(`${provider} returned invalid JSON`);
  }
}

async function callGeminiWithRetry(systemPrompt, userMessage) {
  try {
    setActiveProvider("gemini");
    return await callGemini(systemPrompt, userMessage);
  } catch (firstError) {
    if (!shouldFallback(firstError)) throw firstError;
    try {
      setActiveProvider("gemini");
      return await callGemini(systemPrompt, userMessage);
    } catch (secondError) {
      if (!shouldFallback(secondError)) throw secondError;
      throw secondError;
    }
  }
}

export async function callAI(systemPrompt, userMessage) {
  try {
    return await callGeminiWithRetry(systemPrompt, userMessage);
  } catch (error) {
    if (!shouldFallback(error)) throw error;
    setActiveProvider("groq");
    return callGroq(systemPrompt, userMessage);
  }
}

export async function callAIJSON(systemPrompt, userMessage) {
  try {
    return parseJSON(await callGeminiWithRetry(systemPrompt, userMessage), "Gemini");
  } catch (error) {
    if (!shouldFallback(error)) throw error;
    setActiveProvider("groq");
    return parseJSON(await callGroq(systemPrompt, userMessage), "Groq");
  }
}
