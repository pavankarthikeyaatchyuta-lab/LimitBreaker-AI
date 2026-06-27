import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI } from "@google/genai";
import { initializeApp } from "firebase/app";
import { doc, getFirestore, setDoc, serverTimestamp } from "firebase/firestore";
import "./styles.css";

const GEMINI_MODEL = "gemini-2.0-flash";
const CHECK_IN_INTERVAL_MINUTES = 20;
const STORAGE_KEY = "limitbreaker-session";

const HARD_PERSONALITY = `
Apply to every response:
- Direct. Ruthless. Zero encouragement.
- Speak in verdicts, not suggestions.
- When something must be cut, say: "DROP THIS. You do not have enough time."
- Never say "consider", "maybe", "you might want to".
- Every output must contain at least one hard decision.
- The user is not a client. They are a soldier with a mission.
`;

const emptyMission = {
  phase: "intake",
  situation: "",
  codename: "",
  initialProbability: null,
  initialReasoning: "",
  probability: null,
  biggestRisk: "",
  mostValuableTask: "",
  probabilityReasoning: "",
  triage: [],
  dropped: [],
  questions: [],
  answers: [],
  plan: [],
  timeline: [],
  lockTime: null,
  deadlineMinutes: 120,
  totalSeconds: 7200,
  remainingSeconds: 7200,
  checkInDueAt: null,
  currentTaskIndex: 0,
  completedTasks: [],
  finalDebrief: null,
  probabilityDelta: null,
};

function getFirebaseDb() {
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
  if (!config.apiKey || !config.projectId || !config.appId) return null;
  return getFirestore(initializeApp(config));
}
const db = getFirebaseDb();

function getSessionId() {
  const existing = localStorage.getItem("limitbreaker-session-id");
  if (existing) return existing;
  const sessionId = crypto.randomUUID();
  localStorage.setItem("limitbreaker-session-id", sessionId);
  return sessionId;
}

function extractJson(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Gemini did not return JSON.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function extractJsonArray(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("Gemini did not return a JSON array.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function formatClock(seconds) {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function timerTone(seconds) {
  if (seconds <= 1800) return "text-kill border-kill/70 pulse-fast";
  if (seconds <= 3600) return "text-hazard border-hazard/70";
  return "text-white border-white/25";
}

function classTone(classification) {
  const value = classification?.toUpperCase();
  if (value === "CRITICAL") return "border-kill/70 bg-kill/10 text-red-100";
  if (value === "SIMPLIFY") return "border-hazard/70 bg-hazard/10 text-yellow-100";
  return "border-black bg-black text-zinc-300";
}

function minutesFromSituation(situation) {
  const hourMatch = situation.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h)\b/i);
  const minuteMatch = situation.match(/(\d+)\s*(minutes?|mins?|m)\b/i);
  const hours = hourMatch ? Number(hourMatch[1]) * 60 : 0;
  const minutes = minuteMatch ? Number(minuteMatch[1]) : 0;
  const total = Math.round(hours + minutes);
  return total > 0 ? Math.min(total, 24 * 60) : 120;
}

function parsePlanBlock(block) {
  const match = block.match(/\((\d+)\s*min/i);
  return match ? Number(match[1]) : 20;
}

async function persistMission(mission) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mission));
  if (!db) return;
  try {
    await setDoc(
      doc(db, "limitbreakerSessions", getSessionId()),
      { ...mission, updatedAt: serverTimestamp() },
      { merge: true },
    );
  } catch (e) {
    console.error("Firebase sync failed:", e);
  }
}

function useGemini() {
  return useMemo(() => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    return apiKey ? new GoogleGenAI({ apiKey }) : null;
  }, []);
}

function App() {
  const ai = useGemini();
  const [mission, setMission] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...emptyMission, ...JSON.parse(saved) } : emptyMission;
  });
  const [situation, setSituation] = useState("");
  const [isActing, setIsActing] = useState(false);
  const [activeOverlay, setActiveOverlay] = useState(null);
  const [missionError, setMissionError] = useState(null);
  const feedEndRef = useRef(null);
  const debriefRequestedRef = useRef(false);

  const writeMission = useCallback((updater) => {
    setMission((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      persistMission(next).catch(() => {});
      return next;
    });
  }, []);

  const pushTimeline = useCallback(
    (step) => {
      writeMission((current) => ({
        ...current,
        timeline: [...(current.timeline || []), step],
      }));
    },
    [writeMission],
  );

  const callGemini = useCallback(
    async (agent, prompt, parser = extractJson) => {
      if (!ai) {
        throw new Error("Missing VITE_GEMINI_API_KEY. Add it to .env.local and restart Vite.");
      }
      try {
        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: \`\${HARD_PERSONALITY}\n\${prompt}\`,
        });
        const text = response.text || "";
        return parser(text);
      } catch (error) {
        throw new Error(\`[\${agent}] \${error.message}\`);
      }
    },
    [ai],
  );

  const updateProbability = useCallback(
    async (baseMission) => {
      const result = await callGemini(
        "PROBABILITY ENGINE",
        \`Given these remaining tasks and this time remaining, output only JSON:
{
  "probability": number,
  "biggest_risk": string,
  "most_valuable_task": string,
  "reasoning": string
}
Probability is 0-100. Be realistic, not optimistic.
Remaining minutes: \${Math.ceil(baseMission.remainingSeconds / 60)}
Tasks: \${JSON.stringify(baseMission.triage.filter((task) => task.classification !== "DROP"))}\`,
      );

      return {
        ...baseMission,
        probability: result.probability,
        biggestRisk: result.biggest_risk,
        mostValuableTask: result.most_valuable_task,
        probabilityReasoning: result.reasoning,
      };
    },
    [callGemini],
  );

  const activateMission = async (event) => {
    event?.preventDefault();
    const input = situation.trim() || mission.situation;
    if (!input || isActing) return;

    setIsActing(true);
    setMissionError(null);
    try {
      const deadlineMinutes = minutesFromSituation(input);
      let currentMission = {
        ...emptyMission,
        phase: "codename",
        situation: input,
        deadlineMinutes,
        totalSeconds: deadlineMinutes * 60,
        remainingSeconds: deadlineMinutes * 60,
        timeline: [],
      };
      writeMission(currentMission);
      
      pushTimeline("MISSION ACCEPTED");
      pushTimeline("Analyzing deadline...");

      const codenameData = await callGemini(
        "MISSION CODENAME GENERATOR",
        \`Read this deadline situation and output only JSON:
{ "codename": "MISSION: CONTEXTUAL TWO-TO-FOUR WORD VERDICT" }
Situation: \${input}\`,
      );
      currentMission = { ...currentMission, codename: codenameData.codename, phase: "initial" };
      writeMission(currentMission);

      const initialData = await callGemini(
        "INITIAL ODDS ASSESSOR",
        \`Before any triage, calculate the user's chance without intervention. Output only JSON:
{ "initial_probability": number, "reasoning": string }
The number must feel alarming.
Situation: \${input}\`,
      );
      currentMission = {
        ...currentMission,
        initialProbability: initialData.initial_probability,
        initialReasoning: initialData.reasoning,
        probability: initialData.initial_probability,
        phase: "triage",
      };
      writeMission(currentMission);
      
      pushTimeline("Running TRIAGE AGENT...");

      const triage = await callGemini(
        "TRIAGE AGENT",
        \`You are a brutal deadline triage agent. The user is out of time. Classify every task mentioned as:
CRITICAL — must be done, no shortcuts
SIMPLIFY — do a shortened version
DROP — eliminate entirely
Give one-line reasoning per task. For dropped tasks, state impact lost (Low/Medium/High). No encouragement. No motivation. Just ruthless decisions.
Output only a JSON array:
[
  { "task": string, "classification": "CRITICAL" | "SIMPLIFY" | "DROP", "reasoning": string, "time_saved_minutes": number, "impact_lost": "Low" | "Medium" | "High" | null }
]
Set time_saved_minutes to 0 unless classification is DROP.
Situation: \${input}\`,
        extractJsonArray,
      );
      const dropped = triage.filter((task) => task.classification === "DROP");
      currentMission = { ...currentMission, triage, dropped, phase: "questions" };
      writeMission(currentMission);
      
      pushTimeline("✓ Triage Complete");
      pushTimeline("Running REALITY CHECK...");

      const questions = await callGemini(
        "REALITY CHECK AGENT",
        \`Ask the user maximum 2 yes/no questions. Choose only questions whose answers would change the plan significantly. Do not ask obvious questions. Do not ask more than 2.
Output only JSON:
{ "questions": [{ "id": "q1", "question": string }, { "id": "q2", "question": string }] }
Situation: \${input}
Current triage: \${JSON.stringify(triage)}\`,
      );
      currentMission = { ...currentMission, questions: questions.questions ?? [], phase: "questions" };
      writeMission(currentMission);
      pushTimeline("Waiting for reality check input...");

    } catch (error) {
      setMissionError(error.message);
    } finally {
      setIsActing(false);
    }
  };

  const answerQuestion = (question, answer) => {
    writeMission((current) => ({
      ...current,
      answers: [...current.answers, { ...question, answer }],
    }));
  };

  const lockPlan = async () => {
    if (isActing) return;
    setIsActing(true);
    setMissionError(null);
    try {
      pushTimeline("✓ Reality Check Complete");
      pushTimeline("Evaluating sacrifices & generating RESCUE COMMAND...");

      const adjusted = await callGemini(
        "REALITY CHECK AGENT",
        \`Given the yes/no answers, adjust triage only if needed, then lock the plan. Output only a JSON array:
[
  { "task": string, "classification": "CRITICAL" | "SIMPLIFY" | "DROP", "reasoning": string, "time_saved_minutes": number, "impact_lost": "Low" | "Medium" | "High" | null }
]
Situation: \${mission.situation}
Original triage: \${JSON.stringify(mission.triage)}
Answers: \${JSON.stringify(mission.answers)}\`,
        extractJsonArray,
      );

      const planData = await callGemini(
        "RESCUE COMMAND",
        \`Given the surviving tasks (CRITICAL + SIMPLIFY adjusted tasks) and remaining time in minutes, generate a minute-by-minute schedule. Assign exact time blocks. Add 5-minute transition buffers. If tasks exceed available time, cut the lowest priority surviving task and state this explicitly.
Output only JSON:
{
  "plan": ["[TIME BLOCK] → [TASK] ([duration] min)"],
  "cut_due_to_time": string,
  "updated_probability": number,
  "biggest_risk": string,
  "most_valuable_task": string,
  "reasoning": string
}
Remaining minutes: \${mission.deadlineMinutes}
Adjusted triage: \${JSON.stringify(adjusted)}\`,
      );

      const next = {
        ...mission,
        triage: adjusted,
        dropped: adjusted.filter((task) => task.classification === "DROP"),
        plan: planData.plan ?? [],
        lockTime: Date.now(),
        checkInDueAt: Date.now() + CHECK_IN_INTERVAL_MINUTES * 60 * 1000,
        phase: "locked",
        probability: planData.updated_probability,
        biggestRisk: planData.biggest_risk,
        mostValuableTask: planData.most_valuable_task,
        probabilityReasoning: planData.reasoning,
        probabilityDelta: {
          from: mission.initialProbability,
          to: planData.updated_probability,
        },
      };
      
      const newTimeline = [...(next.timeline || []), "✓ Rescue Plan Locked", "✓ Mission Active"];
      next.timeline = newTimeline;
      
      writeMission(next);
    } catch (error) {
      setMissionError(error.message);
    } finally {
      setIsActing(false);
    }
  };

  const replan = async (status) => {
    setActiveOverlay(null);
    setIsActing(true);
    setMissionError(null);
    try {
      pushTimeline("User BEHIND. Running REPLANNING AGENT...");
      const incompleteTasks = mission.triage.filter(
        (task) =>
          task.classification !== "DROP" &&
          !mission.completedTasks.includes(task.task),
      );
      const result = await callGemini(
        "REPLANNING AGENT",
        \`The user is behind. Re-run triage on ONLY remaining incomplete tasks with ONLY remaining time available. Be MORE aggressive with cuts than the original plan. Tell the user exactly what just got cut due to the delay. Output a new schedule immediately. No sympathy. No explanation of why this happened. Just the new plan.
Output only JSON:
{
  "message": "PLAN UPDATED. [Task X] has been eliminated.",
  "triage": [{ "task": string, "classification": "CRITICAL" | "SIMPLIFY" | "DROP", "reasoning": string, "time_saved_minutes": number, "impact_lost": "Low" | "Medium" | "High" | null }],
  "plan": ["[TIME BLOCK] → [TASK] ([duration] min)"]
}
Check-in status: \${status}
Remaining minutes: \${Math.ceil(mission.remainingSeconds / 60)}
Remaining incomplete tasks: \${JSON.stringify(incompleteTasks)}\`,
      );

      let nextMission = {
        ...mission,
        triage: result.triage ?? mission.triage,
        dropped: (result.triage ?? mission.triage).filter((task) => task.classification === "DROP"),
        plan: result.plan ?? mission.plan,
        checkInDueAt: Date.now() + CHECK_IN_INTERVAL_MINUTES * 60 * 1000,
      };
      
      nextMission = await updateProbability(nextMission);
      nextMission.timeline = [...(nextMission.timeline || []), \`REPLANNING AGENT: \${result.message}\`, "✓ Rescue Plan Updated"];
      writeMission(nextMission);
    } catch (error) {
      setMissionError(error.message);
    } finally {
      setIsActing(false);
    }
  };

  const handleCheckIn = async (status) => {
    const currentBlock = mission.plan[mission.currentTaskIndex] ?? "current block";
    const currentTask = currentBlock.replace(/^\[[^\]]+\]\s*→\s*/, "").replace(/\s*\(\d+\s*min\)$/i, "");
    setActiveOverlay(null);

    if (status === "BEHIND") {
      await replan(status);
      return;
    }

    let nextMission = {
      ...mission,
      checkInDueAt: Date.now() + CHECK_IN_INTERVAL_MINUTES * 60 * 1000,
    };

    if (status === "DONE") {
      nextMission = {
        ...nextMission,
        completedTasks: [...mission.completedTasks, currentTask],
        currentTaskIndex: Math.min(mission.currentTaskIndex + 1, mission.plan.length - 1),
      };
    }

    try {
      nextMission = await updateProbability(nextMission);
      nextMission.timeline = [...(nextMission.timeline || []), \`Progress Update: \${status}\`, "✓ Probabilities Updated"];
    } catch (error) {
      setMissionError(error.message);
      return; // Do not advance if probability update fails
    }
    writeMission(nextMission);
  };

  const finishMission = useCallback(async () => {
    if (mission.finalDebrief || debriefRequestedRef.current) return;
    debriefRequestedRef.current = true;
    setMissionError(null);
    try {
      pushTimeline("Generating MISSION DEBRIEF...");
      const criticalDecision = await callGemini(
        "MISSION DEBRIEF",
        \`Generate one sentence on the most impactful cut made during the session. Output only JSON:
{ "critical_decision": string }
Dropped tasks: \${JSON.stringify(mission.dropped)}
Completed tasks: \${JSON.stringify(mission.completedTasks)}
Original probability: \${mission.initialProbability}
Final probability: \${mission.probability}\`,
      );
      writeMission({
        ...mission,
        phase: "debrief",
        finalDebrief: {
          completed: mission.completedTasks.length,
          total: mission.triage.filter((task) => task.classification !== "DROP").length,
          dropped: mission.dropped.length,
          timeRemaining: Math.ceil(mission.remainingSeconds / 60),
          originalProbability: mission.initialProbability,
          finalProbability: mission.probability,
          criticalDecision: criticalDecision.critical_decision,
        },
      });
      pushTimeline("✓ Mission Concluded");
    } catch (error) {
      debriefRequestedRef.current = false;
      setMissionError(error.message);
    }
  }, [callGemini, mission, writeMission, pushTimeline]);

  useEffect(() => {
    if (mission.phase !== "locked" || !mission.lockTime) return;
    const tick = setInterval(() => {
      writeMission((current) => {
        if (current.phase !== "locked") return current;
        const elapsed = Math.floor((Date.now() - current.lockTime) / 1000);
        const remainingSeconds = Math.max(0, current.totalSeconds - elapsed);
        return { ...current, remainingSeconds };
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [mission.phase, mission.lockTime, writeMission]);

  useEffect(() => {
    if (mission.phase !== "locked" || activeOverlay) return;
    if (mission.remainingSeconds <= 0) {
      const timeout = setTimeout(() => {
        finishMission().catch(() => {});
      }, 0);
      return () => clearTimeout(timeout);
    }
    if (mission.checkInDueAt && Date.now() >= mission.checkInDueAt) {
      const timeout = setTimeout(() => setActiveOverlay("checkin"), 0);
      return () => clearTimeout(timeout);
    }
  }, [activeOverlay, finishMission, mission]);

  useEffect(() => {
    if (mission.phase !== "debrief") {
      debriefRequestedRef.current = false;
      return;
    }
    debriefRequestedRef.current = true;
  }, [mission.phase]);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mission.timeline]);

  const unanswered = mission.questions.filter(
    (question) => !mission.answers.some((answer) => answer.id === question.id),
  );
  const currentBlock = mission.plan[mission.currentTaskIndex] ?? mission.plan.at(-1);
  const currentTaskDuration = currentBlock ? parsePlanBlock(currentBlock) : 0;

  if (mission.phase === "intake") {
    return (
      <main className="min-h-screen bg-bunker text-white">
        <section className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-5 py-10 animate-fade-in">
          <p className="mb-3 font-mono text-sm uppercase tracking-[0.45em] text-signal">
            LimitBreaker AI — The Emergency Deadline Triage System
          </p>
          <h1 className="max-w-3xl text-5xl font-black uppercase tracking-tight md:text-7xl">
            When the clock is against you, LimitBreaker decides what survives.
          </h1>
          <p className="mt-5 max-w-2xl border-l-4 border-kill pl-4 font-mono text-lg text-zinc-300">
            Not a planner. A survival system for impossible deadlines.
          </p>
          
          {missionError && (
             <div className="mt-6 border border-kill/50 bg-kill/10 p-4 font-mono text-kill">
                <p>Mission analysis failed.</p>
                <p className="text-sm">Reason: {missionError}</p>
             </div>
          )}

          <form onSubmit={activateMission} className="mt-10">
            <label className="block font-mono text-sm uppercase tracking-widest text-zinc-300">
              Describe your situation. Deadline, what&apos;s done, what&apos;s not.
              Don&apos;t filter yourself.
            </label>
            <textarea
              value={situation}
              onChange={(event) => setSituation(event.target.value)}
              className="mt-4 min-h-52 w-full resize-none border border-white/15 bg-armor p-5 font-mono text-lg text-white outline-none transition focus:border-signal"
              placeholder="I have 3 hours. Final report due tonight. Outline done, data messy, slides untouched..."
            />
            <button
              type="submit"
              disabled={isActing || (!situation.trim() && !mission.situation)}
              className="mt-5 w-full border border-signal bg-signal px-6 py-4 font-mono text-lg font-black uppercase tracking-widest text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isActing ? "INITIALIZING SYSTEM..." : "ACTIVATE LIMITBREAKER"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bunker bg-[radial-gradient(circle_at_top_left,rgba(215,255,79,.14),transparent_28%),linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] bg-[size:auto,34px_34px,34px_34px] text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-bunker/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.35em] text-zinc-400">
              LimitBreaker AI
            </p>
            <h1 className="text-xl font-black uppercase text-white md:text-3xl">
              {mission.codename || "MISSION: CLASSIFIED"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden border border-white/10 bg-black/40 px-4 py-2 text-right font-mono md:block">
              <p className="text-xs uppercase text-zinc-500">Success Probability</p>
              <p className="text-2xl font-black text-signal transition-all duration-500">{mission.probability ?? "--"}%</p>
            </div>
            <div className={\`border bg-black/60 px-4 py-2 text-right font-mono transition-colors duration-500 \${timerTone(mission.remainingSeconds)}\`}>
              <p className="text-xs uppercase text-zinc-500">Clock</p>
              <p className="text-2xl font-black">{formatClock(mission.remainingSeconds)}</p>
            </div>
          </div>
        </div>
      </header>

      {missionError && (
        <div className="mx-auto max-w-7xl px-4 pt-5 animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-4 border border-kill bg-kill/10 p-4 shadow-hostile">
            <div>
              <p className="font-mono font-black text-kill">Mission analysis failed.</p>
              <p className="font-mono text-sm text-zinc-300">Reason: {missionError}</p>
            </div>
            <button 
              onClick={() => {
                if (mission.phase === "debrief") finishMission();
                else if (mission.phase === "locked" && activeOverlay === "checkin") replan("BEHIND");
                else if (mission.phase === "questions") lockPlan();
                else activateMission();
              }}
              className="action-button border-kill text-kill"
            >
              Retry Mission
            </button>
          </div>
        </div>
      )}

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-5 lg:grid-cols-[1.1fr_.9fr]">
        <div className="space-y-4">
          <Panel title="Situation">
            <p className="whitespace-pre-wrap font-mono text-sm text-zinc-300">{mission.situation}</p>
          </Panel>

          {mission.initialProbability !== null && (
            <Panel title="Initial Success Probability" danger>
              <p className="text-3xl font-black">
                Without intervention:{" "}
                <span className="text-kill">{mission.initialProbability}%</span> chance of completion
              </p>
              <p className="mt-2 font-mono text-sm text-zinc-400">{mission.initialReasoning}</p>
            </Panel>
          )}

          {mission.triage.length > 0 && (
            <Panel title="TRIAGE AGENT">
              <div className="grid gap-3">
                {mission.triage.filter(t => t.classification !== "DROP").map((task) => (
                  <article key={\`\${task.task}-\${task.classification}\`} className={\`border p-4 animate-fade-in \${classTone(task.classification)}\`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-black uppercase">{task.task}</h3>
                      <span className="font-mono text-xs font-black">{task.classification}</span>
                    </div>
                    <p className="mt-2 font-mono text-sm text-zinc-300">{task.reasoning}</p>
                  </article>
                ))}
              </div>
            </Panel>
          )}

          {mission.dropped.length > 0 && (
            <Panel title="Sacrifice Report" danger>
              <div className="space-y-3">
                {mission.dropped.map((task) => (
                  <div key={\`drop-\${task.task}\`} className="border border-kill/50 bg-kill/10 p-4 animate-fade-in">
                    <p className="font-black text-kill">❌ {task.task}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 border-l-2 border-kill/30 pl-3 font-mono text-sm text-zinc-300">
                      <p><span className="text-zinc-500">Time Saved:</span> {task.time_saved_minutes || "--"} min</p>
                      <p><span className="text-zinc-500">Impact Lost:</span> {task.impact_lost || "Unknown"}</p>
                      <p className="col-span-2 mt-1"><span className="text-zinc-500">Decision:</span> DROP - {task.reasoning}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {mission.phase === "questions" && !missionError && (
            <Panel title="REALITY CHECK">
              {unanswered.length > 0 ? (
                <div className="space-y-4">
                  {unanswered.map((question) => (
                    <div key={question.id} className="border border-white/10 bg-black/30 p-4 animate-fade-in">
                      <p className="font-mono text-lg">{question.question}</p>
                      <div className="mt-3 flex gap-3">
                        <button className="action-button" onClick={() => answerQuestion(question, "YES")}>
                          YES
                        </button>
                        <button className="action-button" onClick={() => answerQuestion(question, "NO")}>
                          NO
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <button onClick={lockPlan} disabled={isActing} className="w-full border border-signal bg-signal px-5 py-4 font-mono font-black uppercase tracking-widest text-black disabled:opacity-50">
                  Lock Rescue Plan
                </button>
              )}
            </Panel>
          )}

          {mission.plan.length > 0 && (
            <Panel title="RESCUE COMMAND">
              {mission.probabilityDelta && (
                <p className="mb-4 font-mono text-2xl font-black">
                  {mission.probabilityDelta.from}% <span className="text-signal">→</span>{" "}
                  <span className="text-signal">{mission.probabilityDelta.to}% ▲</span>
                </p>
              )}
              <div className="space-y-2">
                {mission.plan.map((block, index) => (
                  <div
                    key={\`\${block}-\${index}\`}
                    className={\`border p-3 font-mono text-sm animate-fade-in \${
                      index === mission.currentTaskIndex
                        ? "border-signal bg-signal/10 text-white"
                        : "border-white/10 bg-black/30 text-zinc-300"
                    }\`}
                  >
                    {block}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button onClick={() => setActiveOverlay("checkin")} className="action-button">
                  Manual Check-in
                </button>
                <button onClick={finishMission} disabled={isActing} className="action-button border-kill text-kill disabled:opacity-40">
                  End Mission
                </button>
              </div>
            </Panel>
          )}

          {mission.finalDebrief && (
            <Panel title="MISSION DEBRIEF" danger>
              <div className="grid gap-3 font-mono text-lg animate-fade-in">
                <h3 className="mb-2 text-2xl font-black uppercase text-white">Mission Result</h3>
                <div className="grid grid-cols-2 gap-4 border-b border-white/10 pb-4 text-sm text-zinc-300">
                  <p><span className="block text-xs uppercase text-zinc-500">Completed</span> {mission.finalDebrief.completed}/{mission.finalDebrief.total}</p>
                  <p><span className="block text-xs uppercase text-zinc-500">Dropped</span> {mission.finalDebrief.dropped}</p>
                  <p><span className="block text-xs uppercase text-zinc-500">Time Remaining</span> {mission.finalDebrief.timeRemaining} min</p>
                </div>
                <div className="grid grid-cols-2 gap-4 border-b border-white/10 pb-4 text-sm text-zinc-300">
                  <p><span className="block text-xs uppercase text-zinc-500">Original Probability</span> {mission.finalDebrief.originalProbability}%</p>
                  <p><span className="block text-xs uppercase text-zinc-500">Final Probability</span> {mission.finalDebrief.finalProbability}%</p>
                </div>
                <div className="pt-2">
                  <p className="mb-1 text-xs font-black uppercase tracking-widest text-signal">Critical Decision</p>
                  <p className="text-white">{mission.finalDebrief.criticalDecision}</p>
                </div>
              </div>
            </Panel>
          )}
        </div>

        <aside className="space-y-4">
          <Panel title="Probability Board">
            <div className="flex items-end justify-between gap-3">
              <p className="text-7xl font-black text-signal transition-all duration-500">{mission.probability ?? "--"}%</p>
              <p className="pb-2 text-right font-mono text-xs uppercase text-zinc-500">
                Updated after every major state change
              </p>
            </div>
            <div className="mt-4 space-y-3 font-mono text-sm text-zinc-300">
              <div className="border-l-2 border-kill/50 pl-3 animate-fade-in">
                <p className="text-xs font-black uppercase text-kill">Biggest Risk</p>
                <p>{mission.biggestRisk || "Awaiting verdict."}</p>
              </div>
              <div className="border-l-2 border-signal/50 pl-3 animate-fade-in">
                <p className="text-xs font-black uppercase text-signal">Highest Leverage Task</p>
                <p>{mission.mostValuableTask || "Awaiting target."}</p>
              </div>
              {mission.probabilityReasoning && (
                <div className="border-l-2 border-white/20 pl-3 animate-fade-in">
                  <p className="text-xs font-black uppercase text-white">Reasoning</p>
                  <p>{mission.probabilityReasoning}</p>
                </div>
              )}
            </div>
          </Panel>

          <Panel title="Agent Timeline">
            <div className="max-h-[72vh] space-y-3 overflow-y-auto pr-2 font-mono text-sm">
              {mission.timeline?.map((item, index) => (
                <div key={index} className="flex gap-3 animate-fade-in text-zinc-300">
                  <span className="text-signal">{item.startsWith("✓") ? item.charAt(0) : "→"}</span>
                  <span className={item.startsWith("✓") ? "text-white" : ""}>{item.startsWith("✓") ? item.substring(1).trim() : item}</span>
                </div>
              ))}
              <div ref={feedEndRef} />
              {isActing && !missionError && (
                <div className="flex gap-3 animate-pulse text-zinc-500">
                  <span className="text-signal">...</span>
                  <span>Processing...</span>
                </div>
              )}
            </div>
          </Panel>
        </aside>
      </section>

      {activeOverlay === "checkin" && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/80 p-4 backdrop-blur animate-fade-in">
          <div className="w-full max-w-xl border border-signal bg-armor p-6 shadow-hostile">
            <p className="font-mono text-xs uppercase tracking-[0.35em] text-signal">
              Progress Check-in
            </p>
            <h2 className="mt-3 text-3xl font-black uppercase">Did you finish this?</h2>
            <p className="mt-3 border-l-4 border-signal pl-4 font-mono text-zinc-300">
              {currentBlock || "Current task"}
            </p>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <button onClick={() => handleCheckIn("DONE")} disabled={isActing} className="action-button disabled:opacity-40">✅ DONE</button>
              <button onClick={() => handleCheckIn("PARTIAL")} disabled={isActing} className="action-button disabled:opacity-40">⚠️ PARTIAL</button>
              <button onClick={() => handleCheckIn("BEHIND")} disabled={isActing} className="action-button border-kill text-kill disabled:opacity-40">❌ BEHIND</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Panel({ title, danger = false, children }) {
  return (
    <section className={\`border bg-armor/90 p-4 shadow-hostile animate-fade-in \${danger ? "border-kill/50" : "border-white/10"}\`}>
      <h2 className={\`mb-4 font-mono text-sm font-black uppercase tracking-[0.25em] \${danger ? "text-kill" : "text-signal"}\`}>
        {title}
      </h2>
      {children}
    </section>
  );
}

createRoot(document.getElementById("root")).render(<App />);
