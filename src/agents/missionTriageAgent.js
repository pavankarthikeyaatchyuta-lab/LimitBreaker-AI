import { callGeminiJSON } from '../hooks/useGemini'
import { MISSION_TRIAGE_PROMPT } from './prompts'

export async function runMissionTriageAgent(situationText) {
  return callGeminiJSON(MISSION_TRIAGE_PROMPT, situationText)
}
