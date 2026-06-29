import { callAIJSON } from '../ai/provider'
import { PROBABILITY_PROMPT } from './prompts'

export async function runProbabilityAgent(tasks, schedule, remainingMinutes) {
  return callAIJSON(PROBABILITY_PROMPT, JSON.stringify({ tasks, schedule, remainingMinutes }))
}
