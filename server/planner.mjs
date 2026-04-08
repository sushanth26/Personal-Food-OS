import { XAI_MAX_OUTPUT_TOKENS } from "./config.mjs";
import { MODEL, requireClient } from "./xaiClient.mjs";
import { aiGroceryNormalizationJsonSchema, aiGroceryNormalizationSchema, aiMealPlanJsonSchema, aiMealPlanSchema } from "./schemas.mjs";
import { addDays, formatDate, formatIngredientName, getIngredientKey, normalizeIngredientName, round, slugify, subtractDays } from "./utils.mjs";

function buildPrompt(profile, date, options = {}) {
  const mealCountInstruction =
    profile.mealsPerDay === 4 ? "Create exactly 4 meals: breakfast, lunch, dinner, snack." : "Create exactly 3 meals: breakfast, lunch, dinner.";
  const avoidMealsInstruction =
    options.avoidMeals?.length
      ? `- Avoid repeating these recent meal names if possible: ${options.avoidMeals.join(", ")}.`
      : "";
  const avoidSnackInstruction =
    profile.mealsPerDay === 4 && options.avoidSnacks?.length
      ? `- Do not reuse these recent snack names unless there is no practical alternative: ${options.avoidSnacks.join(", ")}.`
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
- Breakfast, lunch, and dinner should each feel balanced on their own, not just in the day total.
- Most main meals should include a clear protein anchor plus a practical carb or fiber component.
- Avoid making lunch or dinner feel like only one ingredient plus sauce.
 - ${repeatMealsInstruction}
 ${avoidMealsInstruction}
 ${avoidSnackInstruction}
- All ingredient amounts must be in grams.
- For each meal, include a serving.primary field that says how a real person should eat it using familiar household serving language.
- For Indian meals prefer words like bowl, katori, cup, roti, dosa, idli, pieces, glass, plate.
- serving.primary should be the main instruction, like "1 bowl moong dal + 2 rotis".
- serving.secondary can be a short support line like "Protein-forward lunch" or "Approx. 320g cooked total", but do not make grams the main instruction.
- Do not include explanations outside the meal fields.
- If a snack is included, rotate snacks across the week. Snacks should be the least repeated meal slot.
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

function fallbackServingPrimary(meal) {
  const name = meal.name.toLowerCase();

  if (/(roti|chapati|phulka)/.test(name)) {
    return `2 rotis with ${meal.name.toLowerCase().replace(/\b(roti|chapati|phulka)\b/g, "").replace(/\s+/g, " ").trim() || "your main dish"}`;
  }

  if (/(paratha|dosa|cheela|chilla|uttapam)/.test(name)) {
    return `1 plate ${meal.name.toLowerCase()}`;
  }

  if (/(idli)/.test(name)) {
    return `3 idlis`;
  }

  if (/(rice|poha|upma|pulao|biryani|khichdi|oats)/.test(name)) {
    return `1 bowl ${meal.name.toLowerCase()}`;
  }

  if (/(dal|rajma|chole|sabzi|paneer|curry|sambar|khichdi)/.test(name)) {
    return `1 bowl ${meal.name.toLowerCase()}`;
  }

  if (meal.mealType === "snack") {
    return `1 serving ${meal.name.toLowerCase()}`;
  }

  return `1 serving ${meal.name.toLowerCase()}`;
}

function fallbackServingSecondary(meal) {
  const totalQuantity = round(meal.ingredients.reduce((sum, ingredient) => sum + ingredient.quantity, 0));
  return `Approx. ${totalQuantity}g cooked total`;
}

export async function normalizeGroceriesWithAI(items, cuisinePreference) {
  if (!items.length) {
    return [];
  }

  let localClient;
  try {
    localClient = requireClient();
  } catch {
    return items.map((item) => ({
      ...item,
      canonicalName: formatIngredientName(item.ingredientName),
      category: "dry_items"
    }));
  }

  try {
    const response = await localClient.responses.create({
      model: MODEL,
      max_output_tokens: 350,
      input: [
        {
          role: "system",
          content:
            "Normalize grocery items for a shopping list. Return valid JSON only. Collapse prep forms, cooked variants, and dish forms into the base store item."
        },
        {
          role: "user",
          content: `
Normalize these grocery names for a ${cuisinePreference} meal plan.

Rules:
- canonicalName must be the base grocery item someone would buy in a store.
- Collapse prep/cut/state variants like chopped, cubes, crumbled, dough, cooked, roasted, boiled.
- Collapse dish forms into ingredients when practical, like roti into whole wheat flour.
- Use category as one of: fruits, vegetables, dry_items.
- Keep canonicalName concise and lowercase.
- Return one entry for each rawName.

Raw grocery names:
${items.map((item) => `- ${item.ingredientName}`).join("\n")}
`.trim()
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "grocery_normalization",
          strict: true,
          schema: aiGroceryNormalizationJsonSchema
        }
      }
    });

    const message = response.output?.find((item) => item.type === "message");
    const textContent = message?.content?.find((item) => item.type === "output_text");
    const raw = textContent?.text ?? response.output_text;
    if (!raw) {
      throw new Error("Grok did not return grocery normalization.");
    }

    const parsed = aiGroceryNormalizationSchema.parse(JSON.parse(raw));
    const normalizedByRawName = new Map(parsed.items.map((item) => [normalizeIngredientName(item.rawName), item]));
    const mergedMap = new Map();

    for (const item of items) {
      const normalized = normalizedByRawName.get(normalizeIngredientName(item.ingredientName));
      const canonicalName = formatIngredientName(normalized?.canonicalName ?? item.ingredientName);
      const category = normalized?.category ?? "dry_items";
      const ingredientKey = getIngredientKey(canonicalName);
      const existing = mergedMap.get(ingredientKey);

      if (existing) {
        existing.totalQuantity = round(existing.totalQuantity + item.totalQuantity);
        continue;
      }

      mergedMap.set(ingredientKey, {
        ingredientId: ingredientKey,
        ingredientName: canonicalName,
        canonicalName,
        category,
        totalQuantity: round(item.totalQuantity),
        unit: "g"
      });
    }

    return [...mergedMap.values()].sort((a, b) => a.ingredientName.localeCompare(b.ingredientName));
  } catch (error) {
    console.error("grocery-normalization error", error);
    return items.map((item) => ({
      ...item,
      canonicalName: formatIngredientName(item.ingredientName),
      category: "dry_items"
    }));
  }
}

async function postProcessPlan(aiPlan, cuisinePreference) {
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
    serving: {
      primary: meal.serving?.primary?.trim() || fallbackServingPrimary(meal),
      secondary: meal.serving?.secondary?.trim() || fallbackServingSecondary(meal)
    },
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

  const groceryList = await normalizeGroceriesWithAI([...ingredientMap.values()], cuisinePreference);

  return {
    date: aiPlan.date,
    meals,
    totals,
    reminders: inferReminders(aiPlan.date, meals),
    groceryList,
    note: "AI-generated day plan aligned to your calories, macros, cuisine preference, and prep style."
  };
}

export function buildWeeklyPlan(days) {
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
      const ingredientKey = getIngredientKey(item.canonicalName ?? item.ingredientName);
      const existing = ingredientMap.get(ingredientKey);
      if (existing) {
        existing.totalQuantity = round(existing.totalQuantity + item.totalQuantity);
      } else {
        ingredientMap.set(ingredientKey, {
          ...item,
          ingredientId: ingredientKey,
          ingredientName: formatIngredientName(item.canonicalName ?? item.ingredientName),
          canonicalName: formatIngredientName(item.canonicalName ?? item.ingredientName)
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

export async function generateDailyPlan(profile, date, options = {}) {
  const localClient = requireClient();
  const response = await localClient.responses.create({
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
  return postProcessPlan(aiPlan, profile.cuisinePreference);
}

export async function generateWeeklyPlan(profile, startDate) {
  const days = [];
  const recentMealNames = [];
  const recentSnackNames = [];

  for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
    const date = addDays(startDate, dayIndex);
    const dayPlan = await generateDailyPlan(profile, date, {
      avoidMeals: profile.allowRepeats ? [] : recentMealNames.slice(-6),
      repeatFromMeals: profile.allowRepeats ? recentMealNames.slice(-3) : [],
      avoidSnacks: recentSnackNames.slice(-4)
    });
    days.push(dayPlan);
    recentMealNames.push(...dayPlan.meals.map((meal) => meal.name));
    recentSnackNames.push(...dayPlan.meals.filter((meal) => meal.mealType === "snack").map((meal) => meal.name));
  }

  return buildWeeklyPlan(days);
}
