# LimitBreaker AI

Emergency Deadline Triage System.

> When the clock is against you, LimitBreaker decides what survives.

## Run Locally

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal.

## Environment

Create `.env.local` from `.env.example`.

```bash
VITE_GEMINI_API_KEY=your_google_ai_studio_key
```

Firebase is optional for local testing. If the Firebase variables are blank, sessions persist in `localStorage`. When Firebase config is provided, the app also writes session state to Firestore at:

```text
limitbreakerSessions/{sessionId}
```

## Deploy to Firebase Hosting

```bash
npm run build
firebase deploy
```

`firebase.json` serves the Vite `dist` directory and rewrites all routes to `index.html`.

## 🏆 Perfect Demo Scenario (Hackathon Judging)

To effectively demonstrate LimitBreaker AI to a judge, use this precise scenario which guarantees a dramatic probability shift, critical triage decisions, and a high-stakes feel.

**Input text:**
> Hackathon ends in 4 hours. PPT is 60% done. The README is missing entirely. Demo video not recorded yet. GitHub commit history is incomplete. Deployment is currently failing.

**What to highlight during the demo:**
1. **Initial Probability**: Point out the shockingly low initial success rate to establish urgency.
2. **Triage Agent (Sacrifice Report)**: Show how it ruthlessly drops "Demo video" and visually explains the impact lost vs time saved.
3. **Rescue Command**: Highlight the transition to a minute-by-minute schedule.
4. **Probability Jump**: Show how the new plan dramatically increases the success rate (e.g., 31% → 78%).
5. **Replanning Agent**: If asked "what if I fall behind?", click the **Manual Check-in** button and select **❌ BEHIND**. Show the agent immediately cutting another task and updating the schedule without sympathy.
6. **Mission Debrief**: Conclude the demo by ending the mission and showing the one-sentence "Critical Decision".

## Notes

- This is a single-screen app: no accounts, no settings, no navigation.
- Gemini calls use `gemini-2.0-flash` with structured outputs and error boundaries.
- Browser-exposed API keys should be restricted in Google Cloud/Firebase before production use.
