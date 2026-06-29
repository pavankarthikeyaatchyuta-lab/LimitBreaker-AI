import { callAIJSON } from '../ai/provider'
import { MISSION_TRIAGE_PROMPT } from './prompts'

export async function runMissionTriageAgent(situationText) {
  return callAIJSON(MISSION_TRIAGE_PROMPT, situationText)
}
