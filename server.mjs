import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import ytsr from "ytsr";
import { z } from "zod";

const PORT = Number(process.env.PORT ?? 8787);
const MODEL = process.env.XAI_MEAL_MODEL ?? "grok-4-1-fast-non-reasoning";
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
      timeout: 45000
    })
  : null;

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function buildPrompt(profile, date) {
  const mealCountInstruction =
    profile.mealsPerDay === 4 ? "Create exactly 4 meals: breakfast, lunch, dinner, snack." : "Create exactly 3 meals: breakfast, lunch, dinner.";

  return `
Create a single-day meal plan for ${date}.

User profile:
- Calories: ${profile.calorieTarget}
- Macros: protein ${profile.macroTargets.protein}g, carbs ${profile.macroTargets.carbs}g, fat ${profile.macroTargets.fat}g
- Cuisine preference: ${profile.cuisinePreference}
- Dietary pattern: ${profile.dietaryPattern}
- Exclusions: ${profile.exclusions.length ? profile.exclusions.join(", ") : "none"}
- Prep preference: ${profile.prepPreference}
- Goal: ${profile.goal}

Requirements:
- ${mealCountInstruction}
- Make the meals realistic and cuisine-aware, prioritizing the preferred cuisine.
- Keep meal names concise.
- All ingredient amounts must be in grams.
- Do not include explanations outside the meal fields.
- Return valid JSON only.
`.trim();
}

function inferReminders(meals) {
  const reminders = [];

  meals.forEach((meal, index) => {
    meal.ingredients.forEach((ingredient) => {
      const lower = ingredient.ingredientName.toLowerCase();
      if (/(lentil|chickpea|chana|rajma|bean)/.test(lower)) {
        reminders.push({
          id: `reminder-soak-${index + 1}-${ingredient.ingredientId}`,
          type: "soak",
          title: `Soak ${ingredient.ingredientName} ahead for ${meal.name}.`,
          context: "night_before",
          linkedMealId: meal.id,
          linkedMealName: meal.name,
          linkedIngredientId: ingredient.ingredientId,
          linkedIngredientName: ingredient.ingredientName
        });
      }
    });

    reminders.push({
      id: `reminder-prep-${index + 1}`,
      type: "prep",
      title: `Prep ingredients for ${meal.name} in advance.`,
      context: meal.mealType === "breakfast" ? "night_before" : "after_dinner",
      linkedMealId: meal.id,
      linkedMealName: meal.name
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
      ingredientId: slugify(ingredient.ingredientName),
      ingredientName: ingredient.ingredientName,
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
      const existing = ingredientMap.get(ingredient.ingredientId);
      if (existing) {
        existing.totalQuantity = round(existing.totalQuantity + ingredient.quantity);
      } else {
        ingredientMap.set(ingredient.ingredientId, {
          ingredientId: ingredient.ingredientId,
          ingredientName: ingredient.ingredientName,
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
    reminders: inferReminders(meals),
    groceryList: [...ingredientMap.values()].sort((a, b) => a.ingredientName.localeCompare(b.ingredientName)),
    note: "AI-generated day plan aligned to your calories, macros, cuisine preference, and prep style."
  };
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

    const response = await client.responses.create({
      model: MODEL,
      max_output_tokens: 1400,
      input: [
        {
          role: "system",
          content:
            "You are a nutrition planning assistant. Return compact, practical, cuisine-aware meal plans as valid JSON only."
        },
        {
          role: "user",
          content: buildPrompt(profile, date)
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
      return res.status(502).json({ error: "Grok did not return a meal plan." });
    }

    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      return res.status(502).json({ error: "Grok returned incomplete JSON. Please try again." });
    }

    const aiPlan = aiMealPlanSchema.parse(json);
    const plan = postProcessPlan(aiPlan);
    return res.json({ plan });
  } catch (error) {
    console.error("meal-plan error", error);
    const message = error instanceof Error ? error.message : "The AI planner failed to generate a valid meal plan.";
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

    if (!video || !("url" in video)) {
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
