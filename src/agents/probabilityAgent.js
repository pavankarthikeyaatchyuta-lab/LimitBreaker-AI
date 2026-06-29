import { callGeminiJSON } from '../hooks/useGemini'
import { PROBABILITY_PROMPT } from './prompts'

export async function runProbabilityAgent(tasks, schedule, remainingMinutes) {
  return callGeminiJSON(PROBABILITY_PROMPT, JSON.stringify({ tasks, schedule, remainingMinutes }))
}
