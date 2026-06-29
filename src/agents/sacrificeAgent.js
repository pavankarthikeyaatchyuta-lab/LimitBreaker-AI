import { callGeminiJSON } from '../hooks/useGemini'
import { SACRIFICE_PROMPT } from './prompts'

export async function runSacrificeAgent(droppedTasks) {
  if (!droppedTasks.length) return { sacrifices: [] }
  return callGeminiJSON(SACRIFICE_PROMPT, JSON.stringify({ droppedTasks }))
}
