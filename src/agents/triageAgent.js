import { callGeminiJSON } from '../hooks/useGemini'
import { TRIAGE_PROMPT } from './prompts'

export async function runTriageAgent(situationText) {
  return callGeminiJSON(TRIAGE_PROMPT, situationText)
}
