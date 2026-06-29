import { callGeminiJSON } from '../hooks/useGemini'
import { CRITICAL_DECISION_PROMPT } from './prompts'

export async function runCriticalDecisionAgent(situationText) {
  return callGeminiJSON(
    CRITICAL_DECISION_PROMPT,
    `Situation: ${situationText}`,
  )
}
