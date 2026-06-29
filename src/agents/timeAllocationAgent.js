import { callGeminiJSON } from '../hooks/useGemini'
import { TIME_ALLOCATION_PROMPT } from './prompts'

export async function runTimeAllocationAgent(survivingTasks, remainingMinutes) {
  return callGeminiJSON(TIME_ALLOCATION_PROMPT, JSON.stringify({ survivingTasks, remainingMinutes }))
}
