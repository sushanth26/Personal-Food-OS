import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import ytsr from "ytsr";
import { z } from "zod";

const PORT = Number(process.env.PORT ?? 8787);
const MODEL = process.env.XAI_MEAL_MODEL ?? "grok-4-1-fast-non-reasoning";
const XAI_TIMEOUT_MS = Number(process.env.XAI_TIMEOUT_MS ?? 18000);
const XAI_MAX_OUTPUT_TOKENS = Number(process.env.XAI_MAX_OUTPUT_TOKENS ?? 800);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, "dist");

const app = express();
app.use((_, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});
app.options("*", (_, res) => {
  res.sendStatus(204);
});
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_, res) => {
  res.json({ ok: true });
});

const aiMealPlanSchema = z.object({
  date: z.string(),
  meals: z.array(
    z.object({
      mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
      name: z.string(),
      totalCalories: z.number(),
      totalProtein: z.number(),
      totalCarbs: z.number(),
      totalFat: z.number(),
      ingredients: z.array(
        z.object({
          ingredientName: z.string(),
          quantity: z.number(),
          unit: z.literal("g")
        })
      )
    })
  )
});

const aiMealPlanJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    date: { type: "string" },
    meals: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          mealType: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] },
          name: { type: "string" },
          totalCalories: { type: "number" },
          totalProtein: { type: "number" },
          totalCarbs: { type: "number" },
          totalFat: { type: "number" },
          ingredients: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                ingredientName: { type: "string" },
                quantity: { type: "number" },
                unit: { type: "string", enum: ["g"] }
              },
              required: ["ingredientName", "quantity", "unit"]
            }
          }
        },
        required: [
          "mealType",
          "name",
          "totalCalories",
          "totalProtein",
          "totalCarbs",
          "totalFat",
          "ingredients"
        ]
      }
    }
  },
  required: ["date", "meals"]
};

const client = process.env.XAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.XAI_API_KEY,
      baseURL: "https://api.x.ai/v1",
      timeout: XAI_TIMEOUT_MS
    })
  : null;

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeIngredientName(value) {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\bplain\b/g, " ")
    .replace(/\bcooked\b/g, " ")
    .replace(/\bdry\b/g, " ")
    .replace(/\sfresh\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatIngredientName(value) {
  return value
    .replace(/\([^)]*\)/g, " ")
    .replace(/\bplain\b/gi, " ")
    .replace(/\bcooked\b/gi, " ")
    .replace(/\bdry\b/gi, " ")
    .replace(/\sfresh\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getIngredientKey(value) {
  return slugify(normalizeIngredientName(value));
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(startDate, offset) {
  const nextDate = new Date(`${startDate}T12:00:00Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + offset);
  return formatDate(nextDate);
}

function subtractDays(startDate, offset) {
  return addDays(startDate, -offset);
}

function buildPrompt(profile, date, options = {}) {
  const mealCountInstruction =
    profile.mealsPerDay === 4 ? "Create exactly 4 meals: breakfast, lunch, dinner, snack." : "Create exactly 3 meals: breakfast, lunch, dinner.";
  const avoidMealsInstruction =
    options.avoidMeals?.length
      ? `- Avoid repeating these recent meal names if possible: ${options.avoidMeals.join(", ")}.`
      : "";
  const repeatMealsInstruction =
    profile.allowRepeats && options.repeatFromMeals?.length
      ? `- Repeating or lightly adapting these recent meals is okay for batch cooking or leftovers: ${options.repeatFromMeals.join(", ")}.`
      : profile.allowRepeats
        ? "- Repeating meals across the week is okay when it helps with batch cooking or leftovers."
        : "- Prefer variety across the week rather than repeating the same meals.";

  return `
Create a single-day meal plan for ${date}.

User profile:
- Calories: ${profile.calorieTarget}
- Macros: protein ${profile.macroTargets.protein}g, carbs ${profile.macroTargets.carbs}g, fat ${profile.macroTargets.fat}g
- Cuisine preference: ${profile.cuisinePreference}
- Dietary pattern: ${profile.dietaryPattern}
- Exclusions: ${profile.exclusions.length ? profile.exclusions.join(", ") : "none"}
- Prep preference: ${profile.prepPreference}
- Repeat meals / leftovers okay: ${profile.allowRepeats ? "yes" : "no"}
- Goal: ${profile.goal}

Requirements:
- ${mealCountInstruction}
- Make the meals realistic and cuisine-aware, prioritizing the preferred cuisine.
- Keep meal names concise, under 5 words if possible.
- Keep each meal simple: 2 to 4 ingredients only.
- Prefer common dishes over creative variations.
 - ${repeatMealsInstruction}
 ${avoidMealsInstruction}
- All ingredient amounts must be in grams.
- Do not include explanations outside the meal fields.
- Return valid JSON only.
`.trim();
}

function inferReminders(targetDate, meals) {
  const reminders = [];

  meals.forEach((meal, index) => {
    meal.ingredients.forEach((ingredient) => {
      const lower = ingredient.ingredientName.toLowerCase();
      if (/(lentil|chickpea|chana|rajma|bean)/.test(lower)) {
        reminders.push({
          id: `reminder-soak-${index + 1}-${ingredient.ingredientId}`,
          type: "soak",
          title: `Soak ${ingredient.ingredientName} for ${meal.name}.`,
          context: "night_before",
          soakOnDate: subtractDays(targetDate, 1),
          targetDate,
          linkedMealId: meal.id,
          linkedMealName: meal.name,
          linkedIngredientId: ingredient.ingredientId,
          linkedIngredientName: ingredient.ingredientName
        });
      }
    });
  });

  return reminders;
}

function postProcessPlan(aiPlan) {
  const meals = aiPlan.meals.map((meal) => ({
    id: slugify(`${meal.mealType}-${meal.name}`),
    name: meal.name,
    mealType: meal.mealType,
    description: `${meal.name} tailored to your calorie and macro target.`,
    totalCalories: round(meal.totalCalories),
    totalProtein: round(meal.totalProtein),
    totalCarbs: round(meal.totalCarbs),
    totalFat: round(meal.totalFat),
    scaleFactor: 1,
    ingredients: meal.ingredients.map((ingredient) => ({
      ingredientId: getIngredientKey(ingredient.ingredientName),
      ingredientName: formatIngredientName(ingredient.ingredientName),
      quantity: round(ingredient.quantity),
      unit: "g",
      estimatedCalories: 0,
      estimatedProtein: 0,
      estimatedCarbs: 0,
      estimatedFat: 0
    }))
  }));

  const totals = meals.reduce(
    (accumulator, meal) => ({
      calories: round(accumulator.calories + meal.totalCalories),
      protein: round(accumulator.protein + meal.totalProtein),
      carbs: round(accumulator.carbs + meal.totalCarbs),
      fat: round(accumulator.fat + meal.totalFat)
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const ingredientMap = new Map();
  for (const meal of meals) {
    for (const ingredient of meal.ingredients) {
      const ingredientKey = getIngredientKey(ingredient.ingredientName);
      const existing = ingredientMap.get(ingredientKey);
      if (existing) {
        existing.totalQuantity = round(existing.totalQuantity + ingredient.quantity);
      } else {
        ingredientMap.set(ingredientKey, {
          ingredientId: ingredientKey,
          ingredientName: formatIngredientName(ingredient.ingredientName),
          totalQuantity: round(ingredient.quantity),
          unit: "g"
        });
      }
    }
  }

  return {
    date: aiPlan.date,
    meals,
    totals,
    reminders: inferReminders(aiPlan.date, meals),
    groceryList: [...ingredientMap.values()].sort((a, b) => a.ingredientName.localeCompare(b.ingredientName)),
    note: "AI-generated day plan aligned to your calories, macros, cuisine preference, and prep style."
  };
}

function buildWeeklyPlan(days) {
  const totals = days.reduce(
    (accumulator, day) => ({
      calories: round(accumulator.calories + day.totals.calories),
      protein: round(accumulator.protein + day.totals.protein),
      carbs: round(accumulator.carbs + day.totals.carbs),
      fat: round(accumulator.fat + day.totals.fat)
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const ingredientMap = new Map();
  for (const day of days) {
    for (const item of day.groceryList) {
      const ingredientKey = getIngredientKey(item.ingredientName);
      const existing = ingredientMap.get(ingredientKey);
      if (existing) {
        existing.totalQuantity = round(existing.totalQuantity + item.totalQuantity);
      } else {
        ingredientMap.set(ingredientKey, {
          ...item,
          ingredientId: ingredientKey,
          ingredientName: formatIngredientName(item.ingredientName)
        });
      }
    }
  }

  return {
    startDate: days[0]?.date ?? formatDate(new Date()),
    days,
    totals,
    groceryList: [...ingredientMap.values()].sort((a, b) => a.ingredientName.localeCompare(b.ingredientName)),
    note: "AI-generated weekly plan with daily variety, weekly groceries, and reusable prep structure."
  };
}

async function generateDailyPlan(profile, date, options = {}) {
  const response = await client.responses.create({
    model: MODEL,
    max_output_tokens: XAI_MAX_OUTPUT_TOKENS,
    input: [
      {
        role: "system",
        content:
          "You are a nutrition planning assistant. Return compact, practical, cuisine-aware meal plans as valid JSON only."
      },
      {
        role: "user",
        content: buildPrompt(profile, date, options)
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "ai_meal_plan",
        strict: true,
        schema: aiMealPlanJsonSchema
      }
    }
  });

  const message = response.output?.find((item) => item.type === "message");
  const textContent = message?.content?.find((item) => item.type === "output_text");
  const raw = textContent?.text ?? response.output_text;
  if (!raw) {
    throw new Error("Grok did not return a meal plan.");
  }

  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("Grok returned incomplete JSON. Please try again.");
  }

  const aiPlan = aiMealPlanSchema.parse(json);
  return postProcessPlan(aiPlan);
}

app.post("/api/meal-plan", async (req, res) => {
  if (!client) {
    return res.status(500).json({
      error: "XAI_API_KEY is not set on the server, so Grok meal plans cannot be generated yet."
    });
  }

  try {
    const { profile, date } = req.body ?? {};
    if (!profile || !date) {
      return res.status(400).json({ error: "Missing profile or date." });
    }
    const plan = await generateDailyPlan(profile, date);
    return res.json({ plan });
  } catch (error) {
    console.error("meal-plan error", error);
    const message =
      error instanceof Error && /timeout/i.test(error.message)
        ? "The AI planner took too long. Please try again."
        : error instanceof Error
          ? error.message
          : "The AI planner failed to generate a valid meal plan.";
    return res.status(500).json({ error: message });
  }
});

app.post("/api/weekly-meal-plan", async (req, res) => {
  if (!client) {
    return res.status(500).json({
      error: "XAI_API_KEY is not set on the server, so Grok meal plans cannot be generated yet."
    });
  }

  try {
    const { profile, startDate } = req.body ?? {};
    if (!profile || !startDate) {
      return res.status(400).json({ error: "Missing profile or startDate." });
    }

    const days = [];
    const recentMealNames = [];
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const date = addDays(startDate, dayIndex);
      const dayPlan = await generateDailyPlan(profile, date, {
        avoidMeals: profile.allowRepeats ? [] : recentMealNames.slice(-6),
        repeatFromMeals: profile.allowRepeats ? recentMealNames.slice(-3) : []
      });
      days.push(dayPlan);
      recentMealNames.push(...dayPlan.meals.map((meal) => meal.name));
    }

    return res.json({ weekPlan: buildWeeklyPlan(days) });
  } catch (error) {
    console.error("weekly-meal-plan error", error);
    const message =
      error instanceof Error && /timeout/i.test(error.message)
        ? "The weekly AI planner took too long. Please try again."
        : error instanceof Error
          ? error.message
          : "The AI planner failed to generate a valid weekly meal plan.";
    return res.status(500).json({ error: message });
  }
});

app.get("/api/recipe-video", async (req, res) => {
  try {
    const query = String(req.query.q ?? "").trim();
    if (!query) {
      return res.status(400).json({ error: "Missing query." });
    }

    const results = await ytsr(`${query} recipe`, { limit: 10 });
    const video = results.items.find((item) => item.type === "video");

    if (!video || !('url' in video)) {
      return res.status(404).json({ error: "No recipe video found." });
    }

    return res.json({
      video: {
        id: video.id,
        title: video.title,
        url: video.url,
        thumbnailUrl: video.bestThumbnail?.url ?? "",
        channelName: video.author?.name ?? "YouTube",
        duration: video.duration ?? ""
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch a recipe video.";
    return res.status(500).json({ error: message });
  }
});

app.use(express.static(distDir));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return next();
  }

  return res.sendFile(path.join(distDir, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Personal Food OS listening on http://0.0.0.0:${PORT}`);
});
