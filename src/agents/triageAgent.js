import { callAIJSON } from '../ai/provider'
import { TRIAGE_PROMPT } from './prompts'

export async function runTriageAgent(situationText) {
  return callAIJSON(TRIAGE_PROMPT, situationText)
}
