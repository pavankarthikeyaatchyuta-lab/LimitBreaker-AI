import { useCallback, useEffect, useMemo, useRef } from 'react'
import StarfieldCanvas from './components/StarfieldCanvas'
import CustomCursor from './components/CustomCursor'
import Header from './components/Header'
import SituationIntake from './components/SituationIntake'
import LoadingSequence, { LOADING_LINES } from './components/LoadingSequence'
import TriageOutput from './components/TriageOutput'
import SacrificeReport from './components/SacrificeReport'
import RealityCheck from './components/RealityCheck'
import RescuePlan from './components/RescuePlan'
import CheckInOverlay from './components/CheckInOverlay'
import MissionDebrief from './components/MissionDebrief'
import { useMissionState } from './hooks/useMissionState'
import { runMissionTriageAgent } from './agents/missionTriageAgent'
import { runRealityCheckAgent } from './agents/realityCheckAgent'
import { runRescueProbabilityAgent } from './agents/rescueProbabilityAgent'
import { runReplanningAgent } from './agents/replanningAgent'

const surviving = (tasks) => tasks.filter((task) => task.classification !== 'DROP')
const taskBlocks = (schedule) => schedule.filter((block) => block.type === 'TASK')
const isRecoverableAIError = (error) => /(Gemini|Groq|AI).*?(error|unavailable|failed|invalid JSON|TIMEOUT|NETWORK|429|RESOURCE_EXHAUSTED)|Failed to fetch/i.test(String(error?.message || error))
const formatPlanTime = (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const offlineFallbackPatch = {
  fallbackMode: true,
  fallbackReason: 'AI service temporarily unavailable. Running Emergency Offline Triage.',
}

function fallbackTriage(situationText) {
  const lower = situationText.toLowerCase()
  const tasks = []
  const add = (name, classification, reasoning, estimated_minutes, specific_instruction = '') => {
    if (!tasks.some((task) => task.name === name)) {
      tasks.push({ name, classification, reasoning, estimated_minutes, specific_instruction })
    }
  }

  if (lower.includes('ppt') || lower.includes('presentation')) {
    add('Finish submission presentation', 'CRITICAL', 'Judges need a fast evaluable summary; without this, the work has no frame.', 45)
  }
  if (lower.includes('submit') || lower.includes('submission')) {
    add('Complete final submission', 'CRITICAL', 'Submission mechanics decide whether anything is evaluated.', 20)
  }
  if (lower.includes('interview')) {
    add('Prepare interview essentials', 'CRITICAL', 'Interview readiness is the deadline-critical outcome.', 45)
  }
  if (lower.includes('readme') || lower.includes('documentation') || lower.includes('docs')) {
    add('Write minimal documentation', 'SIMPLIFY', 'Documentation matters, but only the shortest evaluator-facing version survives.', 20, 'Write setup, demo link, and 3 feature bullets only. No screenshots. No architecture essay.')
  }
  if (lower.includes('demo video') || lower.includes('video')) {
    add('Demo video', 'SIMPLIFY', 'A short proof beats a polished recording; long editing is dead weight.', 25, 'Record one unedited 60-90 second walkthrough: problem, core flow, result. Stop.')
  }
  if (lower.includes('frontend')) {
    add('Patch broken frontend path', 'CRITICAL', 'Broken visible flow kills the demo even if the backend works.', 50)
  }
  if (lower.includes('backend') || lower.includes('api')) {
    add('Verify backend API', 'CRITICAL', 'The live path must work once under pressure; no deep refactor survives.', 20)
  }
  if (lower.includes('github')) {
    add('Prepare GitHub link', 'CRITICAL', 'Submission without the repo link is incomplete.', 10)
  }
  if (lower.includes('deployed') || lower.includes('deploy')) {
    add('Prepare deployed link', 'CRITICAL', 'The evaluator needs a runnable target.', 25)
  }
  if (lower.includes('google doc') || lower.includes('doc')) {
    add('Google Doc polish', 'DROP', 'This consumes time without improving the core evaluable product.', 30)
  }
  if (lower.includes('exam')) {
    add('Study highest-weight chapters', 'CRITICAL', 'High-weight material controls the score; low-yield review dies first.', 90)
    add('Review short chapters', 'SIMPLIFY', 'Only fast coverage survives.', 25, 'Skim definitions and formulas only. No full notes.')
    add('Rewrite full notes', 'DROP', 'Full note-making burns the clock for no direct exam output.', 60)
  }
  if (lower.includes('report') || lower.includes('assignment')) {
    add('Write missing required sections', 'CRITICAL', 'Required sections decide whether the submission counts.', 70)
    add('Analyze raw data', 'SIMPLIFY', 'Only one defensible result is needed now.', 30, 'Use the simplest valid analysis and report one clear finding.')
    add('Formatting polish', 'DROP', 'Formatting polish does not survive before required content exists.', 25)
  }
  if (lower.includes('resume')) {
    add('Update resume essentials', 'CRITICAL', 'The application fails if the resume is visibly stale.', 25)
  }
  if (lower.includes('cover letter')) {
    add('Cover letter', 'SIMPLIFY', 'A short targeted note is enough; custom prose dies now.', 20, 'Write 2 paragraphs: fit and proof. No storytelling.')
  }
  if (lower.includes('portfolio')) {
    add('Portfolio link', 'DROP', 'A dead portfolio cannot be fixed safely inside the closing window.', 45)
  }
  if (lower.includes('nice to have') || lower.includes('nice-to-have') || lower.includes('polish') || lower.includes('extra feature')) {
    add('Nice-to-have features', 'DROP', 'Nice-to-have work burns deadline time without protecting submission success.', 35)
  }
  if (!tasks.length) {
    add('Identify deliverable that must be submitted', 'CRITICAL', 'Submission mechanics decide survival before polish matters.', 20)
    add('Build the smallest acceptable version', 'CRITICAL', 'Only evaluable output survives the deadline.', 60)
    add('Optional polish', 'DROP', 'Polish has no right to time until required output exists.', 30)
  }

  return { tasks }
}

function normalizeScheduleTimes(schedule, startTimestamp = Date.now()) {
  let cursor = new Date(startTimestamp || Date.now())
  return schedule.map((block) => {
    if (block.type === 'CUT') {
      return { ...block, start_time: 'CUT' }
    }
    const start_time = formatPlanTime(cursor)
    cursor = new Date(cursor.getTime() + Math.max(0, Number(block.duration_minutes) || 0) * 60000)
    return { ...block, start_time }
  })
}

function fallbackSchedule(tasks, remainingMinutes, startTimestamp = Date.now()) {
  const availableMinutes = Math.max(0, Number(remainingMinutes) || 0)
  let cursor = new Date(startTimestamp || Date.now())
  let used = 0
  const schedule = []
  tasks.forEach((task, index) => {
    const duration = Math.max(10, Number(task.estimated_minutes || 20))
    if (used + duration > availableMinutes) {
      schedule.push({
        start_time: 'CUT',
        task_name: task.name,
        duration_minutes: duration,
        type: 'CUT',
        cut_reason: 'No time remaining.',
      })
      return
    }
    schedule.push({
      start_time: formatPlanTime(cursor),
      task_name: task.name,
      duration_minutes: duration,
      type: 'TASK',
      cut_reason: null,
    })
    cursor = new Date(cursor.getTime() + duration * 60000)
    used += duration
    if (index < tasks.length - 1 && used + 5 <= availableMinutes) {
      schedule.push({
        start_time: formatPlanTime(cursor),
        task_name: 'Buffer',
        duration_minutes: 5,
        type: 'BUFFER',
        cut_reason: null,
      })
      cursor = new Date(cursor.getTime() + 5 * 60000)
      used += 5
    }
  })
  return { schedule, total_tasks: tasks.length, tasks_cut_due_to_time: schedule.filter((item) => item.type === 'CUT').length }
}

function fallbackProbability(tasks, schedule, remainingMinutes) {
  const taskList = Array.isArray(tasks) ? tasks : []
  const blocks = Array.isArray(schedule) ? schedule : []
  const critical = taskList.filter((task) => task.classification === 'CRITICAL').length
  const simplify = taskList.filter((task) => task.classification === 'SIMPLIFY').length
  const dropped = taskList.filter((task) => task.classification === 'DROP').length
  const cut = blocks.filter((block) => block.type === 'CUT').length
  const neededMinutes = taskList
    .filter((task) => task.classification !== 'DROP')
    .reduce((sum, task) => sum + Math.max(10, Number(task.estimated_minutes || 20)), 0)
  const timeRatio = neededMinutes ? Math.min(1.4, Math.max(0.25, Number(remainingMinutes || 0) / neededMinutes)) : 0.8
  const complexityPenalty = critical * 5 + simplify * 2 + cut * 8
  const sacrificeBoost = Math.min(18, dropped * 7)
  const before_score = Math.max(8, Math.min(58, Math.round(50 * timeRatio - complexityPenalty + 20)))
  const after_score = Math.max(before_score + 8, Math.min(92, Math.round(before_score + 22 + sacrificeBoost - cut * 9 + Math.min(12, timeRatio * 8))))

  return {
    before_score,
    after_score,
    biggest_risk: cut ? 'Not enough time for every surviving task.' : critical > 3 ? 'Too many critical tasks remain.' : 'Execution drift.',
    most_valuable_task: taskList.find((task) => task.classification === 'CRITICAL')?.name || taskList[0]?.name || '',
    reasoning: 'Offline probability estimated from deadline pressure, task count, cuts, and sacrifices.',
  }
}

function fallbackSacrifices(dropped) {
  return dropped.map((task) => ({
    task_name: task.name,
    time_cost_minutes: task.estimated_minutes || 20,
    verdict: `This would have cost ${task.estimated_minutes || 20} minutes without protecting the deadline-critical path.`,
  }))
}

function mergeMissionTriageFallback(data, situationText) {
  const fallback = fallbackTriage(situationText)
  const tasks = Array.isArray(data?.tasks) && data.tasks.length ? data.tasks : fallback.tasks
  const sacrifices = Array.isArray(data?.sacrifices) ? data.sacrifices : fallbackSacrifices(tasks.filter((task) => task.classification === 'DROP'))
  return {
    codename: data?.codename || 'MISSION: DEADLINE RESCUE',
    tasks,
    sacrifices,
  }
}

export default function App() {
  const { state, patchState, resetMission, savedSession, resumeMission, discardSavedMission } = useMissionState()
  const expiredRef = useRef(false)

  const currentTask = useMemo(() => {
    return taskBlocks(state.schedule).find((block) => !state.completedTasks.includes(block.task_name)) || null
  }, [state.schedule, state.completedTasks])

  const totalTaskCount = useMemo(() => taskBlocks(state.schedule).length, [state.schedule])
  const timeRemainingSeconds = useMemo(() => {
    if (!state.deadlineMinutes || !state.sessionStartTime) return 0
    return Math.max(0, Math.ceil((state.sessionStartTime + state.deadlineMinutes * 60000 - Date.now()) / 1000))
  }, [state.deadlineMinutes, state.sessionStartTime, state.phase])

  const finishIfDone = useCallback((completed) => {
    const total = taskBlocks(state.schedule).length
    if (total && completed.length >= total) patchState({ phase: 'debrief' })
  }, [patchState, state.schedule])

  const buildPlan = useCallback(async (tasks, deadlineOverride = null, sessionStartOverride = null) => {
    const remainingMinutes = deadlineOverride ?? state.deadlineMinutes
    const planStart = sessionStartOverride ?? state.sessionStartTime ?? Date.now()
    const aliveTasks = surviving(tasks)
    let allocation
    let probability
    try {
      const plan = await runRescueProbabilityAgent(aliveTasks, remainingMinutes)
      allocation = plan
      probability = plan.probability
    } catch (error) {
      allocation = fallbackSchedule(aliveTasks, remainingMinutes, planStart)
      probability = fallbackProbability(tasks, allocation.schedule, remainingMinutes)
      patchState(isRecoverableAIError(error) ? offlineFallbackPatch : { error: `AGENT FAILURE: Rescue Plan - ${error.message}` })
    }
    const schedule = normalizeScheduleTimes(allocation.schedule || [], planStart)
    patchState({ schedule, totalTasksCut: allocation.tasks_cut_due_to_time || schedule.filter((item) => item.type === 'CUT').length })

    patchState({
      probabilityBefore: probability?.before_score ?? fallbackProbability(tasks, schedule, remainingMinutes).before_score,
      probabilityAfter: probability?.after_score ?? fallbackProbability(tasks, schedule, remainingMinutes).after_score,
      probabilityCurrent: probability?.after_score ?? fallbackProbability(tasks, schedule, remainingMinutes).after_score,
      biggestRisk: probability?.biggest_risk || '',
      mostValuableTask: probability?.most_valuable_task || '',
    })

    patchState({ phase: 'plan' })
    window.setTimeout(() => patchState((current) => (current.phase === 'plan' ? { phase: 'active' } : {})), 3000)
  }, [patchState, state.deadlineMinutes, state.sessionStartTime])

  const startMission = useCallback(async (situationText, deadlineMinutes) => {
    expiredRef.current = false
    const missionStart = Date.now()
    patchState({
      phase: 'loading',
      situationText,
      deadlineMinutes,
      sessionStartTime: missionStart,
      loadingLines: LOADING_LINES,
      error: '',
      fallbackMode: false,
      fallbackReason: '',
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
      totalTasksCut: 0,
      newlyEliminated: [],
    })

    try {
      let missionTriage
      try {
        missionTriage = await runMissionTriageAgent(situationText)
      } catch (error) {
        missionTriage = mergeMissionTriageFallback(null, situationText)
        patchState(isRecoverableAIError(error) ? offlineFallbackPatch : { error: `AGENT FAILURE: Mission Triage - ${error.message}` })
      }

      const { codename, tasks, sacrifices } = mergeMissionTriageFallback(missionTriage, situationText)
      patchState({ missionCodename: codename, tasks, sacrifices, phase: 'triage' })

      window.setTimeout(async () => {
        try {
          const reality = await runRealityCheckAgent(tasks, situationText)
          const questions = reality.questions || []
          patchState({ realityQuestions: questions, phase: questions.length ? 'reality_check' : 'plan' })
          if (!questions.length) await buildPlan(tasks, deadlineMinutes, missionStart)
        } catch (error) {
          patchState(isRecoverableAIError(error) ? offlineFallbackPatch : { error: `AGENT FAILURE: Reality Check - ${error.message}` })
          await buildPlan(tasks, deadlineMinutes, missionStart)
        }
      }, 900)
    } catch (error) {
      const fallback = fallbackTriage(situationText)
      patchState({ tasks: fallback.tasks, phase: 'triage', sacrifices: fallbackSacrifices(fallback.tasks.filter((task) => task.classification === 'DROP')), ...offlineFallbackPatch })
      await buildPlan(fallback.tasks, deadlineMinutes, missionStart)
    }
  }, [buildPlan, patchState])

  const completeRealityCheck = useCallback(async (answers) => {
    const adjusted = state.tasks.map((task) => {
      const yesCut = answers.some((answer) => answer.answer === 'yes' && state.realityQuestions.find((question) => question.id === answer.id)?.impact_if_yes?.toLowerCase().match(/drop|cut|free|eliminate/))
      if (yesCut && task.classification === 'SIMPLIFY') return { ...task, classification: 'DROP', reasoning: `${task.reasoning} Reality check freed time. DROP THIS.` }
      return task
    })
    patchState({ tasks: adjusted, phase: 'plan' })
    await buildPlan(adjusted, state.deadlineMinutes, state.sessionStartTime)
  }, [buildPlan, patchState, state.realityQuestions, state.tasks])

  const completeTask = useCallback((taskName) => {
    patchState((current) => {
      const completedTasks = [...new Set([...current.completedTasks, taskName])]
      return { completedTasks, probabilityCurrent: Math.min(100, (current.probabilityCurrent || current.probabilityAfter || 50) + 6) }
    })
    window.setTimeout(() => finishIfDone([...new Set([...state.completedTasks, taskName])]), 0)
  }, [finishIfDone, patchState, state.completedTasks])

  const handleBehind = useCallback(async () => {
    const remainingTasks = taskBlocks(state.schedule).filter((block) => !state.completedTasks.includes(block.task_name))
    const remainingMinutes = Math.max(1, Math.floor(timeRemainingSeconds / 60))
    patchState({ phase: 'active', error: '' })
    try {
      const replan = await runReplanningAgent(remainingTasks, remainingMinutes)
      patchState((current) => ({
        schedule: normalizeScheduleTimes(replan.schedule || current.schedule, Date.now()),
        newlyEliminated: replan.newly_eliminated || [],
        replansCount: current.replansCount + 1,
        probabilityCurrent: Math.max(5, (current.probabilityCurrent || current.probabilityAfter || 50) - 12),
      }))
    } catch (error) {
      const eliminated = remainingTasks.length > 1 ? [remainingTasks[remainingTasks.length - 1]] : []
      const keptTasks = remainingTasks.slice(0, Math.max(1, remainingTasks.length - eliminated.length))
      const allocation = fallbackSchedule(keptTasks.map((task) => ({ name: task.task_name, estimated_minutes: Math.max(10, Math.ceil((task.duration_minutes || 20) * 0.75)) })), remainingMinutes, Date.now())
      const newlyEliminated = eliminated.map((task) => ({
        task_name: task.task_name,
        reason: 'ELIMINATED DUE TO DELAY: no longer fits after falling behind.',
      }))
      patchState((current) => ({
        schedule: allocation.schedule,
        sacrifices: [
          ...current.sacrifices,
          ...newlyEliminated.map((item) => ({ task_name: item.task_name, time_cost_minutes: 20, verdict: item.reason })),
        ],
        newlyEliminated,
        totalTasksCut: allocation.tasks_cut_due_to_time + newlyEliminated.length,
        replansCount: current.replansCount + 1,
        probabilityCurrent: Math.max(5, (current.probabilityCurrent || current.probabilityAfter || 50) - 15),
        ...(isRecoverableAIError(error) ? offlineFallbackPatch : { error: `AGENT FAILURE: Replanning - ${error.message}` }),
      }))
    }
  }, [patchState, state.completedTasks, state.schedule, timeRemainingSeconds])

  useEffect(() => {
    if (state.phase !== 'active') return undefined
    const timer = window.setTimeout(() => patchState({ phase: 'checkin' }), 20 * 60 * 1000)
    return () => window.clearTimeout(timer)
  }, [patchState, state.phase, state.completedTasks.length, state.replansCount])

  const expire = useCallback(() => {
    if (expiredRef.current || !state.sessionStartTime || state.phase === 'debrief' || state.phase === 'intake') return
    expiredRef.current = true
    patchState({ phase: 'debrief' })
  }, [patchState, state.phase, state.sessionStartTime])

  useEffect(() => {
    if (/Gemini API error:|Groq API error:|AI unavailable/.test(state.error)) {
      patchState({ error: '' })
    }
  }, [patchState, state.error])

  return (
    <>
      <StarfieldCanvas />
      <CustomCursor />
      <Header
        missionCodename={state.missionCodename}
        probabilityBefore={state.probabilityBefore}
        probabilityAfter={state.probabilityAfter}
        probabilityCurrent={state.probabilityCurrent}
        deadlineMinutes={state.deadlineMinutes}
        sessionStartTime={state.sessionStartTime}
        onExpire={expire}
        onHome={resetMission}
        showHome={state.phase !== 'intake'}
      />

      {state.error ? <div className="fixed bottom-4 left-4 right-4 z-[80] rounded-lg border border-critical/40 bg-critical/15 p-3 font-mono text-xs text-critical backdrop-blur md:left-auto md:w-[420px]">{state.error}</div> : null}
      {state.fallbackMode ? (
        <div className="fixed bottom-4 left-4 right-4 z-[79] rounded-lg border border-simplify/40 bg-simplify/15 p-3 font-mono text-xs text-simplify backdrop-blur md:left-auto md:w-[520px]">
          {state.fallbackReason}
        </div>
      ) : null}

      {state.phase === 'intake' ? (
        <SituationIntake onSubmit={startMission} savedSession={savedSession} onResume={resumeMission} onDiscard={discardSavedMission} />
      ) : null}

      {state.phase === 'loading' ? <LoadingSequence lines={state.loadingLines.length ? state.loadingLines : LOADING_LINES} /> : null}

      {['triage', 'reality_check', 'plan', 'active', 'checkin'].includes(state.phase) ? (
        <main className="relative z-10 pb-14 pt-28">
          {state.newlyEliminated.length ? (
            <div className="mx-auto mb-5 max-w-5xl px-5">
              <div className="rounded-lg bg-critical px-4 py-3 font-mono text-sm font-bold text-white">PLAN UPDATED</div>
              <div className="mt-2 space-y-2">
                {state.newlyEliminated.map((item) => <div key={item.task_name} className="text-sm text-critical">{item.task_name}: {item.reason}</div>)}
              </div>
            </div>
          ) : null}
          <TriageOutput tasks={state.tasks} fallbackMode={state.fallbackMode} />
          {['plan', 'active', 'checkin'].includes(state.phase) ? <SacrificeReport sacrifices={state.sacrifices} /> : null}
          {['plan', 'active', 'checkin'].includes(state.phase) ? (
            <>
              <RescuePlan schedule={state.schedule} totalTasksCut={state.totalTasksCut} currentTaskName={currentTask?.task_name} completedTasks={state.completedTasks} onCompleteTask={['active', 'checkin'].includes(state.phase) ? completeTask : null} fallbackMode={state.fallbackMode} />
              {state.phase === 'active' && currentTask ? (
                <div className="mx-auto mt-6 flex max-w-5xl justify-end px-5">
                  <button className="btn-primary h-11 px-5" onClick={() => patchState({ phase: 'checkin' })}>CHECK IN NOW</button>
                </div>
              ) : null}
            </>
          ) : null}
        </main>
      ) : null}

      {state.phase === 'reality_check' ? <RealityCheck questions={state.realityQuestions} onComplete={completeRealityCheck} /> : null}

      {state.phase === 'checkin' ? (
        <CheckInOverlay
          currentTask={currentTask}
          onDone={() => {
            if (currentTask) completeTask(currentTask.task_name)
            patchState({ phase: 'active' })
          }}
          onPartial={() => patchState((current) => ({ phase: 'active', probabilityCurrent: Math.max(0, (current.probabilityCurrent || 50) - 3) }))}
          onBehind={handleBehind}
        />
      ) : null}

      {state.phase === 'debrief' ? (
        <MissionDebrief
          completedCount={state.completedTasks.length}
          totalCount={totalTaskCount}
          sacrificeCount={state.sacrifices.length + state.totalTasksCut}
          timeRemaining={timeRemainingSeconds}
          probabilityBefore={state.probabilityBefore}
          probabilityAfter={state.probabilityAfter}
          replansCount={state.replansCount}
          situationText={state.situationText}
          onRestart={resetMission}
        />
      ) : null}
    </>
  )
}
