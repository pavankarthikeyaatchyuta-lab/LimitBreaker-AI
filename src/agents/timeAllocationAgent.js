import { callAIJSON } from '../ai/provider'
import { TIME_ALLOCATION_PROMPT } from './prompts'

export async function runTimeAllocationAgent(survivingTasks, remainingMinutes) {
  return callAIJSON(TIME_ALLOCATION_PROMPT, JSON.stringify({ survivingTasks, remainingMinutes }))
}
