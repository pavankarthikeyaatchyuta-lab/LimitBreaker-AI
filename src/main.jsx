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

function timerClass(seconds) {
  if (seconds <= 1800) return "threat";
  if (seconds <= 3600) return "amber";
  return "";
}

function probClass(prob) {
  if (prob === null || prob === undefined) return "";
  if (prob < 40) return "danger";
  if (prob < 65) return "warning";
  return "safe";
}

function taskCardClass(classification) {
  const v = classification?.toUpperCase();
  if (v === "CRITICAL") return "task-critical";
  if (v === "SIMPLIFY") return "task-simplify";
  return "task-drop";
}

function badgeClass(classification) {
  const v = classification?.toUpperCase();
  if (v === "CRITICAL") return "badge badge-critical";
  if (v === "SIMPLIFY") return "badge badge-simplify";
  return "badge badge-drop";
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

// ─── INTAKE SCREEN ───────────────────────────────────────────────────────────
function IntakeScreen({ situation, setSituation, onActivate, isActing, error }) {
  return (
    <main className="min-h-screen" style={{ background: "#080a0c" }}>
      {/* Top bar */}
      <div style={{
        borderBottom: "1px solid #1e2a36",
        padding: "1rem 1.5rem",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem"
      }}>
        <div style={{
          width: "8px", height: "8px",
          background: "#ff2d4b",
          borderRadius: "50%",
          boxShadow: "0 0 8px rgba(255,45,75,0.8)"
        }} />
        <span className="label-xs" style={{ color: "#4a5a6a" }}>LIMITBREAKER AI — EMERGENCY DEADLINE TRIAGE SYSTEM</span>
      </div>

      <div style={{
        maxWidth: "720px",
        margin: "0 auto",
        padding: "4rem 1.5rem 2rem",
        minHeight: "calc(100vh - 60px)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}>
        {/* Hero */}
        <div className="animate-in">
          <div style={{ marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ height: "1px", width: "24px", background: "#ff2d4b" }} />
            <span className="label-threat">SYSTEM READY</span>
          </div>

          <h1 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: "clamp(2.2rem, 5vw, 3.6rem)",
            lineHeight: 1.1,
            letterSpacing: "-0.025em",
            color: "#fff",
            margin: "0 0 1.25rem",
          }}>
            When the clock is against you,<br />
            <span style={{ color: "#ff2d4b" }}>LimitBreaker</span> decides<br />
            what survives.
          </h1>

          <p style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "0.85rem",
            color: "#4a5a6a",
            lineHeight: 1.6,
            marginBottom: "2.5rem",
            borderLeft: "2px solid #1e2a36",
            paddingLeft: "1rem",
          }}>
            Not a planner. Not a scheduler. A 6-agent triage system that makes hard
            trade-offs under time pressure — so you don't have to.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="error-block animate-in" style={{ marginBottom: "1rem" }}>
            <p className="label-threat" style={{ marginBottom: "0.25rem" }}>Mission initialization failed</p>
            <p style={{ fontFamily: "mono", fontSize: "0.8rem", color: "#8b9ab0" }}>{error}</p>
          </div>
        )}

        {/* Input */}
        <div className="animate-in" style={{ animationDelay: "80ms" }}>
          <label className="label-xs" style={{ display: "block", marginBottom: "0.75rem" }}>
            Describe your situation — deadline, what's done, what's not. Don't filter.
          </label>
          <textarea
            className="intake-textarea"
            style={{ minHeight: "160px" }}
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            placeholder="I have 4 hours. Hackathon submission due. PPT 60% done, README missing, demo not recorded, deployment failing..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) onActivate(e);
            }}
          />
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "0.5rem",
            marginBottom: "1rem"
          }}>
            <span className="label-xs">⌘↵ to activate</span>
            <span className="label-xs">{situation.length} chars</span>
          </div>

          <button
            className="btn-primary"
            style={{ width: "100%", fontSize: "0.85rem" }}
            onClick={onActivate}
            disabled={isActing || !situation.trim()}
          >
            {isActing ? "INITIALIZING TRIAGE SYSTEM..." : "ACTIVATE LIMITBREAKER →"}
          </button>
        </div>

        {/* Feature pills */}
        <div className="animate-in" style={{
          marginTop: "2rem",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          animationDelay: "160ms"
        }}>
          {["6-Agent Pipeline", "Sacrifice Report", "Live Replanning", "Success Probability", "Mission Debrief"].map(f => (
            <span key={f} style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.65rem",
              letterSpacing: "0.08em",
              color: "#4a5a6a",
              border: "1px solid #1e2a36",
              padding: "0.3rem 0.6rem",
              background: "rgba(255,255,255,0.02)",
            }}>
              {f}
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}

// ─── MISSION HEADER ───────────────────────────────────────────────────────────
function MissionHeader({ mission, onCheckin, onEndMission, isActing }) {
  const tc = timerClass(mission.remainingSeconds);
  const pc = probClass(mission.probability);
  const progress = mission.plan.length > 0
    ? (mission.completedTasks.length / Math.max(1, mission.plan.length)) * 100
    : 0;

  return (
    <header style={{
      position: "sticky",
      top: 0,
      zIndex: 20,
      background: "rgba(8,10,12,0.95)",
      borderBottom: "1px solid #1e2a36",
      backdropFilter: "blur(12px)",
    }}>
      <div className="mission-progress">
        <div className="mission-progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "0.75rem 1.25rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
      }}>
        {/* Left: Codename */}
        <div>
          <div className="label-xs" style={{ marginBottom: "0.2rem" }}>LIMITBREAKER AI</div>
          <div style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: "clamp(0.9rem, 2vw, 1.3rem)",
            color: "#fff",
            letterSpacing: "-0.01em",
          }}>
            {mission.codename || "MISSION: CLASSIFIED"}
          </div>
        </div>

        {/* Right: Probability + Timer + Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {/* Probability */}
          <div style={{
            background: "#0d1117",
            border: "1px solid #1e2a36",
            padding: "0.4rem 0.9rem",
            textAlign: "right",
            display: "none",
          }} className="prob-header-block">
            <div className="label-xs" style={{ marginBottom: "0.15rem" }}>SUCCESS ODDS</div>
            <div style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: "1.5rem",
              color: pc === "danger" ? "#ff2d4b" : pc === "warning" ? "#f59e0b" : "#00d4ff",
              lineHeight: 1,
              transition: "color 600ms ease",
            }}>
              {mission.probability ?? "--"}%
            </div>
          </div>

          {/* Timer */}
          <div style={{
            background: "#0d1117",
            border: `1px solid ${tc === "threat" ? "rgba(255,45,75,0.4)" : tc === "amber" ? "rgba(245,158,11,0.3)" : "#1e2a36"}`,
            padding: "0.4rem 0.9rem",
            textAlign: "right",
            minWidth: "120px",
          }}>
            <div className="label-xs" style={{ marginBottom: "0.15rem" }}>TIME LEFT</div>
            <div className={`timer-display ${tc}`}>
              {formatClock(mission.remainingSeconds)}
            </div>
          </div>

          {/* Quick actions - only in locked phase */}
          {mission.phase === "locked" && (
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="btn-operative" onClick={onCheckin}>
                Check-in
              </button>
              <button className="btn-threat" onClick={onEndMission} disabled={isActing}>
                End
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Inline style for responsive prob block */}
      <style>{`
        @media(min-width: 640px) { .prob-header-block { display: block !important; } }
      `}</style>
    </header>
  );
}

// ─── PANEL COMPONENT ──────────────────────────────────────────────────────────
function Panel({ title, variant = "default", tag, children, style = {} }) {
  const borderMap = {
    default: "1px solid #1e2a36",
    threat: "1px solid rgba(255,45,75,0.25)",
    operative: "1px solid rgba(0,212,255,0.2)",
  };
  const labelColorMap = {
    default: "#4a5a6a",
    threat: "#ff2d4b",
    operative: "#00d4ff",
  };

  return (
    <section className="animate-in" style={{
      background: "#0d1117",
      border: borderMap[variant],
      padding: "1.25rem",
      boxShadow: "0 1px 0 rgba(255,255,255,0.03), 0 4px 24px rgba(0,0,0,0.35)",
      ...style
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "1rem",
        paddingBottom: "0.75rem",
        borderBottom: "1px solid #131920",
      }}>
        <span className="label-xs" style={{ color: labelColorMap[variant] }}>{title}</span>
        {tag && <span className="badge badge-critical">{tag}</span>}
      </div>
      {children}
    </section>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
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

  const pushTimeline = useCallback((step) => {
    writeMission((current) => ({
      ...current,
      timeline: [...(current.timeline || []), step],
    }));
  }, [writeMission]);

  const callGemini = useCallback(async (agent, prompt, parser = extractJson) => {
    if (!ai) throw new Error("Missing VITE_GEMINI_API_KEY. Add it to .env.local and restart Vite.");
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `${HARD_PERSONALITY}\n${prompt}`,
      });
      const text = response.text || "";
      return parser(text);
    } catch (error) {
      throw new Error(`[${agent}] ${error.message}`);
    }
  }, [ai]);

  const updateProbability = useCallback(async (baseMission) => {
    const result = await callGemini(
      "PROBABILITY ENGINE",
      `Given these remaining tasks and this time remaining, output only JSON:
{
  "probability": number,
  "biggest_risk": string,
  "most_valuable_task": string,
  "reasoning": string
}
Probability is 0-100. Be realistic, not optimistic.
Remaining minutes: ${Math.ceil(baseMission.remainingSeconds / 60)}
Tasks: ${JSON.stringify(baseMission.triage.filter((t) => t.classification !== "DROP"))}`,
    );
    return {
      ...baseMission,
      probability: result.probability,
      biggestRisk: result.biggest_risk,
      mostValuableTask: result.most_valuable_task,
      probabilityReasoning: result.reasoning,
    };
  }, [callGemini]);

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
        `Read this deadline situation and output only JSON:
{ "codename": "MISSION: CONTEXTUAL TWO-TO-FOUR WORD VERDICT" }
Situation: ${input}`,
      );
      currentMission = { ...currentMission, codename: codenameData.codename, phase: "initial" };
      writeMission(currentMission);

      const initialData = await callGemini(
        "INITIAL ODDS ASSESSOR",
        `Before any triage, calculate the user's chance without intervention. Output only JSON:
{ "initial_probability": number, "reasoning": string }
The number must feel alarming.
Situation: ${input}`,
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
        `You are a brutal deadline triage agent. The user is out of time. Classify every task mentioned as:
CRITICAL — must be done, no shortcuts
SIMPLIFY — do a shortened version
DROP — eliminate entirely
Give one-line reasoning per task. For dropped tasks, state impact lost (Low/Medium/High). No encouragement. No motivation. Just ruthless decisions.
Output only a JSON array:
[
  { "task": string, "classification": "CRITICAL" | "SIMPLIFY" | "DROP", "reasoning": string, "time_saved_minutes": number, "impact_lost": "Low" | "Medium" | "High" | null }
]
Set time_saved_minutes to 0 unless classification is DROP.
Situation: ${input}`,
        extractJsonArray,
      );
      const dropped = triage.filter((t) => t.classification === "DROP");
      currentMission = { ...currentMission, triage, dropped, phase: "questions" };
      writeMission(currentMission);
      pushTimeline("✓ Triage Complete");
      pushTimeline("Running REALITY CHECK...");

      const questions = await callGemini(
        "REALITY CHECK AGENT",
        `Ask the user maximum 2 yes/no questions. Choose only questions whose answers would change the plan significantly. Do not ask obvious questions. Do not ask more than 2.
Output only JSON:
{ "questions": [{ "id": "q1", "question": string }, { "id": "q2", "question": string }] }
Situation: ${input}
Current triage: ${JSON.stringify(triage)}`,
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
        `Given the yes/no answers, adjust triage only if needed, then lock the plan. Output only a JSON array:
[
  { "task": string, "classification": "CRITICAL" | "SIMPLIFY" | "DROP", "reasoning": string, "time_saved_minutes": number, "impact_lost": "Low" | "Medium" | "High" | null }
]
Situation: ${mission.situation}
Original triage: ${JSON.stringify(mission.triage)}
Answers: ${JSON.stringify(mission.answers)}`,
        extractJsonArray,
      );

      const planData = await callGemini(
        "RESCUE COMMAND",
        `Given the surviving tasks (CRITICAL + SIMPLIFY adjusted tasks) and remaining time in minutes, generate a minute-by-minute schedule. Assign exact time blocks. Add 5-minute transition buffers. If tasks exceed available time, cut the lowest priority surviving task and state this explicitly.
Output only JSON:
{
  "plan": ["[TIME BLOCK] → [TASK] ([duration] min)"],
  "cut_due_to_time": string,
  "updated_probability": number,
  "biggest_risk": string,
  "most_valuable_task": string,
  "reasoning": string
}
Remaining minutes: ${mission.deadlineMinutes}
Adjusted triage: ${JSON.stringify(adjusted)}`,
      );

      const next = {
        ...mission,
        triage: adjusted,
        dropped: adjusted.filter((t) => t.classification === "DROP"),
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
        timeline: [...(mission.timeline || []), "✓ Rescue Plan Locked", "✓ Mission Active"],
      };
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
        (t) => t.classification !== "DROP" && !mission.completedTasks.includes(t.task),
      );
      const result = await callGemini(
        "REPLANNING AGENT",
        `The user is behind. Re-run triage on ONLY remaining incomplete tasks with ONLY remaining time available. Be MORE aggressive with cuts than the original plan. Tell the user exactly what just got cut due to the delay. Output a new schedule immediately. No sympathy. No explanation of why this happened. Just the new plan.
Output only JSON:
{
  "message": "PLAN UPDATED. [Task X] has been eliminated.",
  "triage": [{ "task": string, "classification": "CRITICAL" | "SIMPLIFY" | "DROP", "reasoning": string, "time_saved_minutes": number, "impact_lost": "Low" | "Medium" | "High" | null }],
  "plan": ["[TIME BLOCK] → [TASK] ([duration] min)"]
}
Check-in status: ${status}
Remaining minutes: ${Math.ceil(mission.remainingSeconds / 60)}
Remaining incomplete tasks: ${JSON.stringify(incompleteTasks)}`,
      );

      let nextMission = {
        ...mission,
        triage: result.triage ?? mission.triage,
        dropped: (result.triage ?? mission.triage).filter((t) => t.classification === "DROP"),
        plan: result.plan ?? mission.plan,
        checkInDueAt: Date.now() + CHECK_IN_INTERVAL_MINUTES * 60 * 1000,
      };
      nextMission = await updateProbability(nextMission);
      nextMission.timeline = [
        ...(nextMission.timeline || []),
        `REPLANNING AGENT: ${result.message}`,
        "✓ Rescue Plan Updated",
      ];
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
      nextMission.timeline = [
        ...(nextMission.timeline || []),
        `Progress Update: ${status}`,
        "✓ Probabilities Updated",
      ];
    } catch (error) {
      setMissionError(error.message);
      return;
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
        `Generate one sentence on the most impactful cut made during the session. Output only JSON:
{ "critical_decision": string }
Dropped tasks: ${JSON.stringify(mission.dropped)}
Completed tasks: ${JSON.stringify(mission.completedTasks)}
Original probability: ${mission.initialProbability}
Final probability: ${mission.probability}`,
      );
      writeMission({
        ...mission,
        phase: "debrief",
        finalDebrief: {
          completed: mission.completedTasks.length,
          total: mission.triage.filter((t) => t.classification !== "DROP").length,
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

  // Timer tick
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

  // Check-in / finish triggers
  useEffect(() => {
    if (mission.phase !== "locked" || activeOverlay) return;
    if (mission.remainingSeconds <= 0) {
      const t = setTimeout(() => finishMission().catch(() => {}), 0);
      return () => clearTimeout(t);
    }
    if (mission.checkInDueAt && Date.now() >= mission.checkInDueAt) {
      const t = setTimeout(() => setActiveOverlay("checkin"), 0);
      return () => clearTimeout(t);
    }
  }, [activeOverlay, finishMission, mission]);

  // Reset debrief ref
  useEffect(() => {
    if (mission.phase !== "debrief") { debriefRequestedRef.current = false; return; }
    debriefRequestedRef.current = true;
  }, [mission.phase]);

  // Auto-scroll timeline
  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mission.timeline]);

  const unanswered = mission.questions.filter(
    (q) => !mission.answers.some((a) => a.id === q.id),
  );
  const currentBlock = mission.plan[mission.currentTaskIndex] ?? mission.plan.at(-1);

  // ── INTAKE SCREEN ──
  if (mission.phase === "intake") {
    return (
      <IntakeScreen
        situation={situation}
        setSituation={setSituation}
        onActivate={activateMission}
        isActing={isActing}
        error={missionError}
      />
    );
  }

  // ── MISSION SCREEN ──
  return (
    <div style={{ minHeight: "100vh", background: "#080a0c", color: "#fff" }}>
      <MissionHeader
        mission={mission}
        onCheckin={() => setActiveOverlay("checkin")}
        onEndMission={finishMission}
        isActing={isActing}
      />

      {/* Error bar */}
      {missionError && (
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "1rem 1.25rem" }}>
          <div className="error-block animate-in" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
            <div>
              <p className="label-threat" style={{ marginBottom: "0.2rem" }}>Agent error</p>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.78rem", color: "#8b9ab0" }}>{missionError}</p>
            </div>
            <button className="btn-ghost" onClick={() => {
              if (mission.phase === "debrief") finishMission();
              else if (mission.phase === "questions") lockPlan();
              else activateMission();
            }}>
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Main grid */}
      <div style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "1.25rem",
        display: "grid",
        gridTemplateColumns: "1fr 320px",
        gap: "1rem",
      }}>
        {/* LEFT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

          {/* Situation */}
          <Panel title="SITUATION BRIEF">
            <p style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.82rem",
              color: "#8b9ab0",
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
            }}>{mission.situation}</p>
          </Panel>

          {/* Initial probability */}
          {mission.initialProbability !== null && (
            <Panel title="INITIAL THREAT ASSESSMENT" variant="threat">
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <span style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: "3rem",
                  color: "#ff2d4b",
                  lineHeight: 1,
                }}>
                  {mission.initialProbability}%
                </span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.75rem", color: "#4a5a6a" }}>
                  chance without intervention
                </span>
              </div>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.78rem", color: "#4a5a6a", lineHeight: 1.6 }}>
                {mission.initialReasoning}
              </p>
            </Panel>
          )}

          {/* Triage */}
          {mission.triage.length > 0 && (
            <Panel title="TRIAGE AGENT — VERDICT">
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {mission.triage.filter(t => t.classification !== "DROP").map((task) => (
                  <div key={`${task.task}-${task.classification}`}
                    className={`${taskCardClass(task.classification)} animate-in`}
                    style={{ padding: "0.875rem 1rem" }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.4rem" }}>
                      <span style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontWeight: 600,
                        fontSize: "0.9rem",
                        color: "#fff",
                        lineHeight: 1.3,
                      }}>{task.task}</span>
                      <span className={badgeClass(task.classification)} style={{ flexShrink: 0 }}>
                        {task.classification}
                      </span>
                    </div>
                    <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.75rem", color: "#8b9ab0", lineHeight: 1.5, margin: 0 }}>
                      {task.reasoning}
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* Sacrifice Report */}
          {mission.dropped.length > 0 && (
            <Panel title="SACRIFICE REPORT — ELIMINATED" variant="threat">
              <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                {mission.dropped.map((task) => (
                  <div key={`drop-${task.task}`} className="animate-in" style={{
                    background: "rgba(255,45,75,0.04)",
                    border: "1px solid rgba(255,45,75,0.15)",
                    padding: "0.875rem 1rem",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                      <span style={{ color: "#ff2d4b", fontSize: "0.9rem" }}>✕</span>
                      <span style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontWeight: 600,
                        fontSize: "0.88rem",
                        color: "#ff2d4b",
                      }}>{task.task}</span>
                    </div>
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "0.375rem 1rem",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "0.72rem",
                      color: "#4a5a6a",
                    }}>
                      <div><span style={{ color: "#2a3a4a" }}>TIME SAVED </span>{task.time_saved_minutes || "--"} min</div>
                      <div><span style={{ color: "#2a3a4a" }}>IMPACT LOST </span>{task.impact_lost || "Unknown"}</div>
                      <div style={{ gridColumn: "1/-1", color: "#8b9ab0" }}>DROP — {task.reasoning}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* Reality Check */}
          {mission.phase === "questions" && !missionError && (
            <Panel title="REALITY CHECK AGENT" variant="operative">
              {unanswered.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {unanswered.map((q) => (
                    <div key={q.id} className="animate-in" style={{
                      background: "rgba(0,212,255,0.03)",
                      border: "1px solid rgba(0,212,255,0.12)",
                      padding: "1rem",
                    }}>
                      <p style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontWeight: 500,
                        fontSize: "0.95rem",
                        color: "#fff",
                        marginBottom: "0.875rem",
                        lineHeight: 1.4,
                      }}>{q.question}</p>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button className="btn-operative" onClick={() => answerQuestion(q, "YES")}>YES</button>
                        <button className="btn-ghost" onClick={() => answerQuestion(q, "NO")}>NO</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <button
                  className="btn-primary"
                  style={{ width: "100%" }}
                  onClick={lockPlan}
                  disabled={isActing}
                >
                  {isActing ? "GENERATING RESCUE PLAN..." : "LOCK RESCUE PLAN →"}
                </button>
              )}
            </Panel>
          )}

          {/* Rescue Plan */}
          {mission.plan.length > 0 && (
            <Panel title="RESCUE COMMAND — LOCKED PLAN" variant="operative">
              {/* Probability delta */}
              {mission.probabilityDelta && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  marginBottom: "1rem",
                  padding: "0.875rem 1rem",
                  background: "rgba(0,212,255,0.04)",
                  border: "1px solid rgba(0,212,255,0.12)",
                }}>
                  <div>
                    <div className="label-xs" style={{ marginBottom: "0.2rem" }}>WITHOUT PLAN</div>
                    <div style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontWeight: 700,
                      fontSize: "1.5rem",
                      color: "#ff2d4b",
                    }}>{mission.probabilityDelta.from}%</div>
                  </div>
                  <div style={{ color: "#2a3a4a", fontSize: "1.25rem" }}>→</div>
                  <div>
                    <div className="label-xs" style={{ marginBottom: "0.2rem" }}>WITH THIS PLAN</div>
                    <div style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontWeight: 700,
                      fontSize: "1.5rem",
                      color: "#00d4ff",
                    }}>{mission.probabilityDelta.to}% ↑</div>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                {mission.plan.map((block, i) => {
                  const isDone = i < mission.currentTaskIndex;
                  const isActive = i === mission.currentTaskIndex;
                  return (
                    <div key={`${block}-${i}`} className={`plan-block animate-in ${isActive ? "active" : isDone ? "done" : ""}`}>
                      {block}
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}

          {/* Mission Debrief */}
          {mission.finalDebrief && (
            <Panel title="MISSION DEBRIEF" variant="threat">
              <div className="animate-in">
                <div style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: "1.4rem",
                  marginBottom: "1.25rem",
                  color: "#fff",
                }}>
                  MISSION RESULT
                </div>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "1rem",
                  marginBottom: "1rem",
                  paddingBottom: "1rem",
                  borderBottom: "1px solid #131920",
                }}>
                  {[
                    { label: "COMPLETED", val: `${mission.finalDebrief.completed}/${mission.finalDebrief.total}` },
                    { label: "DROPPED", val: mission.finalDebrief.dropped },
                    { label: "TIME LEFT", val: `${mission.finalDebrief.timeRemaining}m` },
                  ].map(({ label, val }) => (
                    <div key={label}>
                      <div className="label-xs" style={{ marginBottom: "0.3rem" }}>{label}</div>
                      <div style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontWeight: 700,
                        fontSize: "1.5rem",
                        color: "#fff",
                      }}>{val}</div>
                    </div>
                  ))}
                </div>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1rem",
                  marginBottom: "1rem",
                  paddingBottom: "1rem",
                  borderBottom: "1px solid #131920",
                }}>
                  <div>
                    <div className="label-xs" style={{ marginBottom: "0.3rem" }}>ORIGINAL ODDS</div>
                    <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "1.4rem", color: "#ff2d4b" }}>
                      {mission.finalDebrief.originalProbability}%
                    </div>
                  </div>
                  <div>
                    <div className="label-xs" style={{ marginBottom: "0.3rem" }}>FINAL ODDS</div>
                    <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "1.4rem", color: "#00d4ff" }}>
                      {mission.finalDebrief.finalProbability}%
                    </div>
                  </div>
                </div>

                <div>
                  <div className="label-threat" style={{ marginBottom: "0.5rem" }}>CRITICAL DECISION</div>
                  <p style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "0.85rem",
                    color: "#fff",
                    lineHeight: 1.6,
                  }}>{mission.finalDebrief.criticalDecision}</p>
                </div>
              </div>
            </Panel>
          )}
        </div>

        {/* RIGHT SIDEBAR */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

          {/* Probability Board */}
          <Panel title="LIVE PROBABILITY" variant="default">
            <div style={{ marginBottom: "1rem" }}>
              <div className={`prob-number ${probClass(mission.probability)}`}>
                {mission.probability ?? "--"}
                <span style={{ fontSize: "2rem", color: "#2a3a4a" }}>%</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div style={{ borderLeft: "2px solid rgba(255,45,75,0.4)", paddingLeft: "0.75rem" }}>
                <div className="label-xs" style={{ color: "#ff2d4b", marginBottom: "0.25rem" }}>BIGGEST RISK</div>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.75rem", color: "#8b9ab0", lineHeight: 1.5, margin: 0 }}>
                  {mission.biggestRisk || "Awaiting analysis"}
                </p>
              </div>
              <div style={{ borderLeft: "2px solid rgba(0,212,255,0.4)", paddingLeft: "0.75rem" }}>
                <div className="label-xs" style={{ color: "#00d4ff", marginBottom: "0.25rem" }}>HIGHEST LEVERAGE</div>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.75rem", color: "#8b9ab0", lineHeight: 1.5, margin: 0 }}>
                  {mission.mostValuableTask || "Awaiting target"}
                </p>
              </div>
            </div>
          </Panel>

          {/* Agent Timeline */}
          <Panel title="AGENT TIMELINE" style={{ flex: 1 }}>
            <div style={{ maxHeight: "360px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {(mission.timeline || []).map((item, i) => {
                const isDone = item.startsWith("✓");
                const isActive = item.includes("Running") || item.includes("Generating");
                return (
                  <div key={i} className={`timeline-item animate-in ${isDone ? "done" : isActive ? "active" : ""}`}>
                    <span style={{ flexShrink: 0, marginTop: "1px" }}>
                      {isDone ? "✓" : "→"}
                    </span>
                    <span>{isDone ? item.substring(1).trim() : item}</span>
                  </div>
                );
              })}
              <div ref={feedEndRef} />
              {isActing && !missionError && (
                <div className="timeline-item active" style={{ animation: "none", opacity: 0.6 }}>
                  <span>···</span>
                  <span>Processing...</span>
                </div>
              )}
            </div>
          </Panel>

          {/* Reset */}
          <button
            className="btn-ghost"
            style={{ width: "100%" }}
            onClick={() => {
              localStorage.removeItem(STORAGE_KEY);
              localStorage.removeItem("limitbreaker-session-id");
              setMission(emptyMission);
              setSituation("");
              setMissionError(null);
            }}
          >
            ← New Mission
          </button>
        </div>
      </div>

      {/* Check-in overlay */}
      {activeOverlay === "checkin" && (
        <div className="overlay-backdrop animate-in">
          <div style={{
            background: "#0d1117",
            border: "1px solid rgba(0,212,255,0.25)",
            padding: "2rem",
            maxWidth: "480px",
            width: "100%",
            boxShadow: "0 0 0 1px rgba(0,212,255,0.08), 0 32px 80px rgba(0,0,0,0.6)",
          }}>
            <div className="label-operative" style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.65rem",
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#00d4ff",
              marginBottom: "0.75rem",
            }}>PROGRESS CHECK-IN</div>

            <h2 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: "1.4rem",
              marginBottom: "1rem",
              color: "#fff",
            }}>Did you finish this task?</h2>

            <div style={{
              background: "rgba(0,212,255,0.04)",
              border: "1px solid rgba(0,212,255,0.12)",
              borderLeft: "3px solid #00d4ff",
              padding: "0.875rem 1rem",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.8rem",
              color: "#8b9ab0",
              marginBottom: "1.5rem",
              lineHeight: 1.5,
            }}>
              {currentBlock || "Current task"}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.625rem" }}>
              <button className="btn-operative" disabled={isActing} onClick={() => handleCheckIn("DONE")}>
                ✓ DONE
              </button>
              <button className="btn-ghost" disabled={isActing} onClick={() => handleCheckIn("PARTIAL")}>
                ⚡ PARTIAL
              </button>
              <button className="btn-threat" disabled={isActing} onClick={() => handleCheckIn("BEHIND")}>
                ✕ BEHIND
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media(max-width: 768px) {
          .mission-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
