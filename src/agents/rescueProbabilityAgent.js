import { callGeminiJSON } from '../hooks/useGemini'
import { RESCUE_PROBABILITY_PROMPT } from './prompts'

export async function runRescueProbabilityAgent(tasks, remainingMinutes) {
  return callGeminiJSON(RESCUE_PROBABILITY_PROMPT, JSON.stringify({ tasks, remainingMinutes }))
}
