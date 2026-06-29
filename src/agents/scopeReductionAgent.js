import { callGeminiJSON } from '../hooks/useGemini'
import { SCOPE_REDUCTION_PROMPT } from './prompts'

export async function runScopeReductionAgent(simplifyTasks) {
  if (!simplifyTasks.length) return { reductions: [] }
  return callGeminiJSON(SCOPE_REDUCTION_PROMPT, JSON.stringify({ tasks: simplifyTasks }))
}
