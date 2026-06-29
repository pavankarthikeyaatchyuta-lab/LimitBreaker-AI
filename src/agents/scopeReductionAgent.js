import { callAIJSON } from '../ai/provider'
import { SCOPE_REDUCTION_PROMPT } from './prompts'

export async function runScopeReductionAgent(simplifyTasks) {
  if (!simplifyTasks.length) return { reductions: [] }
  return callAIJSON(SCOPE_REDUCTION_PROMPT, JSON.stringify({ tasks: simplifyTasks }))
}
