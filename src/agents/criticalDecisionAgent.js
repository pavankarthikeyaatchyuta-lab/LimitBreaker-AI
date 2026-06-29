import { callAIJSON } from '../ai/provider'
import { CRITICAL_DECISION_PROMPT } from './prompts'

export async function runCriticalDecisionAgent(situationText) {
  return callAIJSON(
    CRITICAL_DECISION_PROMPT,
    `Situation: ${situationText}`,
  )
}
