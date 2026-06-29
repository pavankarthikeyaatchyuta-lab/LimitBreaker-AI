# LimitBreaker AI - Project Description

## Problem Statement Selected

**PS1: The Last-Minute Life Saver**

LimitBreaker AI focuses on the most urgent version of the productivity problem: the user is already behind, the deadline is hours away, and passive reminders are no longer useful.

## Solution Overview

LimitBreaker AI is an emergency deadline triage system powered by Gemini. Instead of acting like a general planner, it behaves like a crisis recovery agent: it decides what must survive, what must be simplified, what must be dropped, and what the user should do minute by minute.

The app takes an unstructured situation dump, extracts the deadline, runs a reduced-call multi-agent Gemini workflow, and produces a rescue plan with live countdown, survival probability, check-ins, replanning, and mission debrief.

## Key Features

- **Emergency situation intake**: Users can describe their deadline in plain language with no required format.
- **Deadline parsing**: Detects deadlines such as `4 hours`, `90 minutes`, and `at 5:30pm`.
- **AI triage**: Classifies tasks as `CRITICAL`, `SIMPLIFY`, or `DROP`.
- **Scope reduction**: Gives exact instructions for shortening tasks.
- **Sacrifice report**: Explains why eliminated tasks do not survive the deadline.
- **Reality check questions**: Asks only high-impact yes/no questions that can change the plan.
- **Minute-by-minute rescue schedule**: Builds a timeline with buffers and cuts tasks when time is insufficient.
- **Survival probability**: Shows before-plan and after-plan completion probability.
- **Progress check-ins**: Lets users mark tasks as done, partial, or behind.
- **Crisis replanning**: Rebuilds the remaining schedule when the user falls behind.
- **Mission debrief**: Summarizes completed tasks, eliminated tasks, time remaining, replans, and the most impactful decision.
- **Offline emergency fallback**: If Gemini is unavailable or rate-limited, the app clearly labels heuristic triage and still produces a usable local emergency plan.
- **Space mission UI**: Animated starfield, nebulas, planet, black hole, and comet pointer create a high-pressure mission-control experience.

## Technologies Used

- React
- Vite
- Tailwind CSS
- JavaScript
- HTML Canvas
- localStorage
- Playwright for smoke testing

## Google Technologies Utilized

- **Google AI Studio API**
- **Gemini 2.0 Flash**
- Gemini generateContent endpoint:

```text
https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent
```

The app uses `VITE_GEMINI_API_KEY` for Google AI Studio API access.

## Agentic Depth

LimitBreaker AI uses a modular multi-agent pipeline optimized into fewer Gemini calls for demo responsiveness:

1. **Mission Triage Agent**: Generates mission identity, task triage, scope reductions, and sacrifice report in one call.
2. **Reality Check Agent**: Asks high-impact yes/no questions.
3. **Rescue Probability Agent**: Builds the rescue schedule and calculates survival probability in one call.
4. **Replanning Agent**: Rebuilds the remaining schedule if the user falls behind.
5. **Critical Decision Agent**: Generates the mission debrief insight.

## Evaluation Alignment

### Problem Solving & Impact

LimitBreaker AI solves the final-hours deadline problem where normal reminders and productivity dashboards fail. It forces prioritization and helps the user produce evaluable output before time runs out.

### Agentic Depth

The app uses multiple specialized Gemini agents that pass state forward and affect the final plan.

### Innovation & Creativity

The product reframes productivity as emergency mission recovery. The tone, visuals, countdown, triage logic, sacrifice report, and replanning create a distinctive experience.

### Usage of Google Technologies

Gemini 2.0 Flash via Google AI Studio is the core AI engine for triage, scheduling, probability, replanning, and debrief.

### Product Experience & Design

The interface is a space-themed mission control system with animated canvas background, comet cursor, glass panels, timeline schedule, and high-contrast classification cards.

### Technical Implementation

The app is a complete single-page React application with modular components, hooks, agents, local persistence, fallback handling, and production build support.

### Completeness & Usability

Users can start a mission, receive triage, follow a rescue plan, check in, replan, and finish with a debrief.

## Submission Links

Add these before final submission:

- Deployed Application Link: `PASTE_DEPLOYED_LINK_HERE`
- GitHub Repository Link: `PASTE_GITHUB_REPO_LINK_HERE`
- Google Doc Link: `PASTE_GOOGLE_DOC_LINK_HERE`
