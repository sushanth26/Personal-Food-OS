# Personal Food OS

A focused MVP for planning one high-value nutrition day before expanding into weekly planning or pantry intelligence.

## What this MVP includes

- onboarding for calorie, macro, diet, exclusions, meals per day, and prep preference
- calorie target guidance based on age, sex, height, weight, activity, and goal
- AI-assisted 1-day meal plan generation
- gram-based portion recommendations that scale meals toward the target
- prep reminders and overnight soak reminders
- grocery list aggregation
- local persistence for the active profile and latest plan

## Stack

- React + TypeScript + Vite
- Express API for secure server-side Grok/xAI calls
- localStorage persistence
- Vitest for planner coverage

## Run locally

```bash
export XAI_API_KEY=your_key_here
npm install
npm run dev
```

The local dev UI runs on `http://127.0.0.1:5173/` and calls the Express API on `http://127.0.0.1:8787`.

## Railway deploy

Set this Railway environment variable:

```bash
XAI_API_KEY=your_key_here
```

Railway can build and run this repo as a single service:

```bash
npm install
npm run build
npm run start
```

The production server serves both the built frontend and the API from the same port.

If this GitHub repo is connected to Railway with auto-deploy enabled for `main`, merging a PR into `main` will trigger a fresh deploy automatically.

## Test

```bash
npm test
```
