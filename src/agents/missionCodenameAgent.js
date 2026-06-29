import { callGeminiJSON } from '../hooks/useGemini'
import { MISSION_CODENAME_PROMPT } from './prompts'

export async function runMissionCodenameAgent(situationText) {
  return callGeminiJSON(MISSION_CODENAME_PROMPT, situationText)
}
