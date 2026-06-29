import { callGeminiJSON } from '../hooks/useGemini'
import { REPLANNING_PROMPT } from './prompts'

export async function runReplanningAgent(remainingTasks, remainingMinutes) {
  return callGeminiJSON(REPLANNING_PROMPT, JSON.stringify({ remainingTasks, remainingMinutes }))
}
