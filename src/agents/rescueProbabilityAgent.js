import { callAIJSON } from '../ai/provider'
import { RESCUE_PROBABILITY_PROMPT } from './prompts'

export async function runRescueProbabilityAgent(tasks, remainingMinutes) {
  return callAIJSON(RESCUE_PROBABILITY_PROMPT, JSON.stringify({ tasks, remainingMinutes }))
}
