# LimitBreaker AI

Emergency deadline triage for when the clock is already against you.

LimitBreaker AI is a single-page React app that turns a last-minute deadline dump into a ruthless survival plan: what stays, what gets simplified, what gets eliminated, and what to do next.

## Tech Stack

- React + Vite
- Tailwind CSS
- Gemini 2.0 Flash via Google AI Studio API
- localStorage session persistence
- Animated canvas starfield and custom reticle cursor

## Setup

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env.local
```

Set your Gemini API key:

```env
VITE_GEMINI_API_KEY=your_google_ai_studio_key_here
```

Run the app:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

## Scripts

```bash
npm run dev
```

Starts the Vite dev server.

```bash
npm run build
```

Builds the production bundle into `dist/`.

```bash
npm run preview
```

Serves the production build locally.

## How It Works

1. User describes the emergency deadline.
2. The app parses deadline text such as `4 hours`, `90 minutes`, or `at 5:30pm`.
3. Gemini agents generate the mission plan using a reduced-call pipeline:
   - Call 1: mission codename, triage classifications, scope reductions, and sacrifice report
   - Call 2: reality-check questions
   - Call 3: rescue schedule and survival probability
   - Call 4: replanning, only if the user falls behind
4. The active mission screen shows the current rescue plan, check-ins, completion tracking, and debrief.

## Gemini Integration

All AI calls go through:

```text
src/hooks/useGemini.js
```

The app uses only:

```env
VITE_GEMINI_API_KEY
```

No OpenAI, Anthropic, or other AI provider SDKs are used.

## Rate-Limit Fallback

If Gemini returns `400`, `401`, `403`, or `429` during a demo or judging session, LimitBreaker AI switches to offline emergency mode:

- Triage still appears and is labeled `Offline heuristic fallback`.
- Rescue plan still appears and is labeled `Offline schedule`.
- Probability falls back to a realistic default.
- Recoverable Gemini failures are not shown as fatal errors.

The fallback is clearly marked as heuristic output, not Gemini output. This keeps the app usable even when API quota is temporarily exhausted.

## Project Structure

```text
src/
  agents/
    criticalDecisionAgent.js
    missionCodenameAgent.js
    probabilityAgent.js
    realityCheckAgent.js
    replanningAgent.js
    sacrificeAgent.js
    scopeReductionAgent.js
    timeAllocationAgent.js
    triageAgent.js
  components/
    CheckInOverlay.jsx
    CustomCursor.jsx
    Header.jsx
    LoadingSequence.jsx
    MissionDebrief.jsx
    RealityCheck.jsx
    RescuePlan.jsx
    SacrificeReport.jsx
    SituationIntake.jsx
    StarfieldCanvas.jsx
    TriageOutput.jsx
  hooks/
    useCountdown.js
    useGemini.js
    useMissionState.js
  App.jsx
  index.css
  main.jsx
```

## Notes

Because this is a Vite frontend app, `VITE_GEMINI_API_KEY` is exposed to browser code. For production, proxy Gemini requests through a backend or serverless function if the key must remain private.

## Hackathon Submission

This project is aligned with:

```text
PS1: The Last-Minute Life Saver
```

For the required Google Doc content, use:

```text
PROJECT_DESCRIPTION.md
```

For final platform checks, use:

```text
SUBMISSION_CHECKLIST.md
```
