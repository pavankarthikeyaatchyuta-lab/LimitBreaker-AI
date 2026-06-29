import { callGeminiJSON } from '../hooks/useGemini'
import { REALITY_CHECK_PROMPT } from './prompts'

export async function runRealityCheckAgent(tasks, situationText) {
  return callGeminiJSON(REALITY_CHECK_PROMPT, JSON.stringify({ situationText, tasks }))
}
