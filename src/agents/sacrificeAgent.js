import { callAIJSON } from '../ai/provider'
import { SACRIFICE_PROMPT } from './prompts'

export async function runSacrificeAgent(droppedTasks) {
  if (!droppedTasks.length) return { sacrifices: [] }
  return callAIJSON(SACRIFICE_PROMPT, JSON.stringify({ droppedTasks }))
}
