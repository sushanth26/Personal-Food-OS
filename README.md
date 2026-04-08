# Personal Food OS

Personal Food OS is a mobile-first food planning app built around AI-assisted daily and weekly meal planning. The current product supports profile-driven planning, a 1-day and 7-day meal flow, soak reminders, grocery grouping, Google sign-in via Firebase, and cloud-saved user planning state.

This README focuses especially on the backend, database, and AI techniques used in the project.

## Product Scope

The current app supports:

- first-time onboarding with calorie and macro preferences
- calorie estimation from sex, age, height, weight, activity, and goal
- AI-generated day plans
- AI-generated weekly plans
- weekly grocery rollups
- soak reminders
- recipe video lookup per meal
- Firebase-backed sign-in
- Firestore-backed cloud persistence of profile and plans

## Tech Stack

- frontend: React + TypeScript + Vite
- backend: Express in [server.mjs](/Users/sushanth/Documents/Personal-Food-OS/server.mjs)
- AI provider: xAI Grok via the OpenAI-compatible SDK
- auth: Firebase Authentication
- database: Firestore
- validation: Zod
- testing: Vitest

## Architecture Overview

There are two main runtime surfaces:

1. Frontend SPA
- profile collection
- plan rendering
- grocery and reminder UX
- Firebase Authentication UI and session handling
- local fallback persistence

2. Backend API
- AI plan generation
- AI output validation
- weekly aggregation
- reminder inference
- grocery aggregation
- YouTube recipe lookup
- production serving of the built frontend

At a high level, the frontend sends a user profile plus a target date or week start date to the backend. The backend asks Grok for a compact structured meal plan, validates the response, post-processes it into app-friendly objects, and returns a normalized payload that the frontend renders and optionally syncs to Firestore.

## Backend Work Done

The backend lives in [server.mjs](/Users/sushanth/Documents/Personal-Food-OS/server.mjs).

### API Endpoints

Implemented endpoints:

- `GET /api/health`
  - lightweight health check used for runtime verification and deployment sanity checks

- `POST /api/meal-plan`
  - accepts:
    - `profile`
    - `date`
  - returns:
    - `{ plan }`
  - responsibility:
    - generate one AI meal plan day
    - validate and normalize it
    - infer reminders
    - aggregate groceries

- `POST /api/weekly-meal-plan`
  - accepts:
    - `profile`
    - `startDate`
  - returns:
    - `{ weekPlan }`
  - responsibility:
    - generate 7 daily plans
    - pass forward variety hints between days
    - reduce days into a weekly object
    - aggregate weekly groceries

- `GET /api/recipe-video?q=...`
  - returns:
    - `{ video }`
  - responsibility:
    - searches YouTube using `ytsr`
    - returns the top matching video for the meal

### Backend Responsibilities

The backend does more than just proxy AI output. It is responsible for:

- calling the AI provider securely from the server
- enforcing a strict output schema
- converting raw AI output into stable app data structures
- inferring soak reminders from ingredient names
- generating grocery rollups
- collapsing daily plans into weekly plans
- serving the built frontend in production

### Express Setup

The Express server:

- enables JSON request parsing
- enables permissive CORS for local development
- exposes `/api/*` endpoints
- serves `dist/` statically in production
- returns `index.html` for non-API routes

This lets the app run:

- as split frontend/backend in local development
- as a single Railway service in production

## AI Integration

AI plan generation is the core backend feature.

### Provider

The app uses xAI via the OpenAI-compatible SDK:

- SDK: `openai`
- base URL: `https://api.x.ai/v1`
- model env var: `XAI_MEAL_MODEL`
- API key env var: `XAI_API_KEY`

Defaults in [server.mjs](/Users/sushanth/Documents/Personal-Food-OS/server.mjs):

- `grok-4-1-fast-non-reasoning`
- timeout: `18000ms`
- max output tokens: `800`

This was intentionally tuned for lower latency and tighter JSON responses rather than long reasoning traces.

### AI Techniques Used

The current implementation uses a hybrid AI + deterministic post-processing approach.

#### 1. Structured Outputs via JSON Schema

The backend does not ask Grok for freeform prose. It requests JSON-only output using:

- `text.format.type = "json_schema"`
- a strict JSON schema

This reduces parsing ambiguity and makes the returned data easier to validate and render.

#### 2. Zod Validation After Model Output

Even after structured output, the backend still validates the model response with Zod:

- schema: `aiMealPlanSchema`

This gives a second validation layer after the model call. If the payload is malformed or incomplete, the API rejects it instead of passing unstable data to the UI.

#### 3. Prompt Grounding With User Constraints

The prompt is assembled from the active nutrition profile:

- calorie target
- macro targets
- cuisine preference
- dietary pattern
- exclusions
- prep preference
- repeat preference
- goal
- meals per day

This keeps generation anchored to explicit user constraints instead of generic meal generation.

#### 4. Weekly Sequential Planning

Weekly planning is not one giant 7-day prompt. Instead, the backend generates 7 days sequentially and passes planning context forward.

Current week-generation controls:

- `avoidMeals`
  - discourages repeating recent meal names
- `repeatFromMeals`
  - allows practical reuse when leftovers are acceptable
- `avoidSnacks`
  - discourages reusing recent snack names

This is a lightweight planning-memory technique that improves weekly diversity without creating an overly large or brittle single-shot prompt.

#### 5. Controlled Simplicity

The prompt deliberately asks for:

- concise meal names
- 2 to 4 ingredients per meal
- common dishes
- gram-based quantities

This reduces latency, reduces schema failure risk, and makes the output more actionable for an MVP.

#### 6. Deterministic Post-Processing

The model returns only the core meal content. The server then computes or infers the rest:

- meal ids
- rounded totals
- normalized ingredient names
- grocery lists
- soak reminders

This is important: the AI is not trusted to do all app logic. The server uses AI for meal generation, then deterministic code for application structure.

## AI Prompting Strategy

The prompt builder is implemented in `buildPrompt()` in [server.mjs](/Users/sushanth/Documents/Personal-Food-OS/server.mjs).

It enforces:

- exact meal count based on `mealsPerDay`
- cuisine-aware meal selection
- low-complexity meal composition
- practical names
- grams only
- no extra explanatory text
- weekly variety pressure
- snack rotation pressure

This prompt is intentionally concise. The goal is not long-form reasoning, but reliable structured meal generation.

## Post-Processing Pipeline

After AI returns a valid JSON plan, the backend applies a normalization pipeline.

### Daily Post-Processing

Implemented in `postProcessPlan()`:

- generate deterministic `id`s from meal type + name
- add descriptions
- round calories and macros
- normalize ingredient names
- assign ingredient ids
- create grocery items from meal ingredients
- infer reminders from soaking ingredients

### Reminder Inference

Implemented in `inferReminders()`:

- ingredients matching terms like:
  - lentil
  - chickpea
  - chana
  - rajma
  - bean
- produce soak reminders for the prior day

The app currently shows only soak reminders, not generic prep reminders.

### Weekly Aggregation

Implemented in `buildWeeklyPlan()`:

- sum calories/macros across 7 days
- merge grocery items across the week
- normalize grocery ids and names
- attach a weekly note

## Database Design

The app uses Firestore for cloud persistence and localStorage for local fallback state.

### Firestore

Cloud state is managed in [cloudState.ts](/Users/sushanth/Documents/Personal-Food-OS/src/cloudState.ts).

Current Firestore path:

- `users/{uid}/appData/foodOS`

Current document fields:

- `profile`
- `plan`
- `weekPlan`
- `updatedAt`

### What Is Saved

#### `profile`

Stored from the `NutritionProfile` type in [types.ts](/Users/sushanth/Documents/Personal-Food-OS/src/types.ts).

Includes:

- `calorieTarget`
- `sex`
- `age`
- `heightCm`
- `weightKg`
- `activityLevel`
- `goal`
- `cuisinePreference`
- `macroMode`
- `macroPreset`
- `macroTargets`
- `dietaryPattern`
- `exclusions`
- `mealsPerDay`
- `prepPreference`
- `allowRepeats`

#### `plan`

Stored from `DailyMealPlan`.

Includes:

- `date`
- `meals`
- `totals`
- `reminders`
- `groceryList`
- `note`

#### `weekPlan`

Stored from `WeeklyMealPlan`.

Includes:

- `startDate`
- `days`
- `totals`
- `groceryList`
- `note`

### What Is Not Saved In Firestore

Not currently synced:

- grocery checkbox completion state
- fetched YouTube video lookup results
- current active tab
- transient loading/error UI state

### Firebase Auth vs Firestore

Important separation:

- Firebase Authentication stores account identity
  - email
  - display name
  - Google profile photo
  - UID
- Firestore stores app-owned nutrition/planning state

## Local Persistence

Local persistence is implemented in [storage.ts](/Users/sushanth/Documents/Personal-Food-OS/src/storage.ts).

Keys currently used:

- `personal-food-os.profile`
- `personal-food-os.plan`
- `personal-food-os.week-plan`
- `personal-food-os.grocery-checked`

The app uses local storage for:

- offline-ish continuity
- non-auth local mode
- fallback before cloud state loads
- seeding cloud state when a signed-in user already has local data

## Frontend/Backend Data Contracts

Shared domain types live in [types.ts](/Users/sushanth/Documents/Personal-Food-OS/src/types.ts).

Important types:

- `NutritionProfile`
- `DailyMealPlan`
- `WeeklyMealPlan`
- `Reminder`
- `GroceryListItem`
- `RecipeVideo`

This keeps the backend response shape aligned with the frontend rendering model.

## Auth Implementation

The app currently uses Firebase Authentication with Google sign-in first.

Relevant files:

- [firebase.ts](/Users/sushanth/Documents/Personal-Food-OS/src/firebase.ts)
- [AuthScreen.tsx](/Users/sushanth/Documents/Personal-Food-OS/src/AuthScreen.tsx)
- [App.tsx](/Users/sushanth/Documents/Personal-Food-OS/src/App.tsx)

Notable details:

- the app supports local mode when Firebase is not configured
- once Firebase is configured, signed-in users get cloud persistence
- the auth UI currently uses Google popup sign-in via the Firebase SDK
- Firebase Analytics can be enabled with the web measurement id for product event tracking

## Current Backend Limitations

Known limitations in the current backend:

- weekly generation is sequential, so it is slower than daily generation
- reminder inference is heuristic and based on ingredient-name matching
- YouTube recipe search depends on `ytsr`, which can break when YouTube markup changes
- bundle size is currently large because auth and app code are still shipped together
- Firestore sync is shallow document merge, not field-level versioned state

## Environment Variables

### Backend

Required for AI planning:

```bash
XAI_API_KEY=your_key_here
```

Optional tuning:

```bash
XAI_MEAL_MODEL=grok-4-1-fast-non-reasoning
XAI_TIMEOUT_MS=18000
XAI_MAX_OUTPUT_TOKENS=800
```

### Frontend / Firebase

Required for authenticated cloud mode:

```bash
VITE_FIREBASE_API_KEY=your_key_here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

## Run Locally

```bash
export XAI_API_KEY=your_key_here
export VITE_FIREBASE_API_KEY=your_key_here
export VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
export VITE_FIREBASE_PROJECT_ID=your-project-id
export VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
export VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
export VITE_FIREBASE_APP_ID=your_app_id
export VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
npm install
npm run dev
```

Local URLs:

- frontend: `http://127.0.0.1:5173/`
- backend: `http://127.0.0.1:8787`

## Railway Deploy

Railway can run the app as a single service:

```bash
npm install
npm run build
npm run start
```

Set these Railway variables:

```bash
XAI_API_KEY=your_key_here
VITE_FIREBASE_API_KEY=your_key_here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

If Railway is connected to GitHub with auto-deploy on `main`, merging to `main` will trigger a deployment.

## Firebase Setup

In Firebase Console:

1. Create a Web app and copy the config into the `VITE_FIREBASE_*` variables.
2. Enable Google sign-in in `Authentication`.
3. Create Firestore.
4. Allow the app to read/write:
   - `users/{uid}/appData/foodOS`
5. Add authorized domains such as:
   - `localhost`
   - your Railway domain

## Tests

```bash
npm test
```

Build check:

```bash
npm run build
```

## Backend Summary

In short, the backend architecture is:

- AI for constrained meal generation
- schema validation for safety
- deterministic post-processing for app structure
- Firestore for user planning state
- localStorage for fast local continuity
- Express as the integration layer between all of the above

That hybrid design is what makes the current app practical: the model generates the food ideas, but the application still owns the data model, reminders, grocery logic, and persistence model.
