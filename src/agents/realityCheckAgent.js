import { callAIJSON } from '../ai/provider'
import { REALITY_CHECK_PROMPT } from './prompts'

export async function runRealityCheckAgent(tasks, situationText) {
  return callAIJSON(REALITY_CHECK_PROMPT, JSON.stringify({ situationText, tasks }))
}
