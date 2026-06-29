import { callAIJSON } from '../ai/provider'
import { MISSION_CODENAME_PROMPT } from './prompts'

export async function runMissionCodenameAgent(situationText) {
  return callAIJSON(MISSION_CODENAME_PROMPT, situationText)
}
