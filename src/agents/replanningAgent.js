import { callAIJSON } from '../ai/provider'
import { REPLANNING_PROMPT } from './prompts'

export async function runReplanningAgent(remainingTasks, remainingMinutes) {
  return callAIJSON(REPLANNING_PROMPT, JSON.stringify({ remainingTasks, remainingMinutes }))
}
