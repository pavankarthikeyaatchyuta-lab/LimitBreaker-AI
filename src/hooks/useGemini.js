// src/hooks/useGemini.js
// Backward-compatible wrapper. New agent code should import from src/ai/provider.

import { callAI, callAIJSON } from "../ai/provider";

export async function callGemini(systemPrompt, userMessage) {
  return callAI(systemPrompt, userMessage);
}

export async function callGeminiJSON(systemPrompt, userMessage) {
  return callAIJSON(systemPrompt, userMessage);
}
