import { useCallback, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'limitbreaker_session'

const initialState = {
  phase: 'intake',
  situationText: '',
  deadlineMinutes: null,
  missionCodename: '',
  tasks: [],
  sacrifices: [],
  realityQuestions: [],
  schedule: [],
  probabilityBefore: null,
  probabilityAfter: null,
  probabilityCurrent: null,
  biggestRisk: '',
  mostValuableTask: '',
  completedTasks: [],
  replansCount: 0,
  sessionStartTime: null,
  loadingLines: [],
  totalTasksCut: 0,
  error: '',
  fallbackMode: false,
  fallbackReason: '',
  newlyEliminated: [],
}

export function useMissionState() {
  const [savedSession, setSavedSession] = useState(null)
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed?.phase && parsed.phase !== 'debrief') {
          setTimeout(() => setSavedSession(parsed), 0)
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
    return initialState
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const patchState = useCallback((patch) => {
    setState((current) => ({
      ...current,
      ...(typeof patch === 'function' ? patch(current) : patch),
    }))
  }, [])

  const resetMission = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setSavedSession(null)
    setState(initialState)
  }, [])

  const resumeMission = useCallback(() => {
    if (savedSession) {
      setState(savedSession)
      setSavedSession(null)
    }
  }, [savedSession])

  const discardSavedMission = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setSavedSession(null)
  }, [])

  return useMemo(
    () => ({
      state,
      setState,
      patchState,
      resetMission,
      savedSession,
      resumeMission,
      discardSavedMission,
    }),
    [state, patchState, resetMission, savedSession, resumeMission, discardSavedMission],
  )
}
