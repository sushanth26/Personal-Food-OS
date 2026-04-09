import { XAI_MAX_OUTPUT_TOKENS } from "./config.mjs";
import { MODEL, requireClient } from "./xaiClient.mjs";
import {
  aiGroceryNormalizationJsonSchema,
  aiGroceryNormalizationSchema,
  aiMealPlanJsonSchema,
  aiMealPlanReviewJsonSchema,
  aiMealPlanReviewSchema,
  aiMealPlanSchema
} from "./schemas.mjs";
import { addDays, formatDate, formatIngredientName, getIngredientKey, normalizeIngredientName, round, slugify, subtractDays } from "./utils.mjs";

const FRUIT_NAMES = ["banana", "apple", "orange", "papaya", "berries", "mango", "guava", "pear"];
const VEGETABLE_NAMES = [
  "spinach",
  "salad",
  "cucumber",
  "tomato",
  "carrot",
  "vegetable",
  "capsicum",
  "bell pepper",
  "onion",
  "lettuce"
];

function getGroceryCategory(name) {
  const lower = name.toLowerCase();
  if (FRUIT_NAMES.some((entry) => lower.includes(entry))) {
    return "fruits";
  }
  if (VEGETABLE_NAMES.some((entry) => lower.includes(entry))) {
    return "vegetables";
  }
  return "dry_items";
}
function getEggsGuidance(profile) {
  if (profile.dietaryPattern !== "vegetarian") {
    return "";
  }

  if (profile.exclusions.includes("eggs")) {
    return "- Eggs are excluded. Do not use eggs anywhere in the plan.";
  }

  return "- Vegetarian meals may include eggs if they help create a more balanced, practical meal.";
}

function shouldRequireEggMeal(profile) {
  return profile.dietaryPattern === "vegetarian" && !profile.exclusions.includes("eggs");
}

function getProteinAnchorGuidance(profile) {
  if (profile.dietaryPattern === "vegan") {
    return "- Prefer strong protein anchors like tofu, soy chunks, tempeh, sprouts, lentils, beans, and protein-rich soy yogurt.";
  }

  if (profile.dietaryPattern === "vegetarian") {
    if (profile.exclusions.includes("eggs")) {
      return "- Prefer strong vegetarian protein anchors like paneer, greek yogurt, hung curd, tofu, sprouts, lentils, beans, and soy chunks.";
    }

    return "- Prefer strong vegetarian protein anchors like eggs, paneer, greek yogurt, hung curd, tofu, sprouts, lentils, beans, and soy chunks.";
  }

  return "- Prefer strong protein anchors like eggs, chicken, fish, paneer, greek yogurt, lentils, and beans.";
}

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
  const eggsGuidance = getEggsGuidance(profile);
  const forceEggMealInstruction = options.forceEggMeal
    ? "- Include at least one egg-based meal or side in the day, preferably at breakfast or snack."
    : "";
  const forceBalancedSidesInstruction = options.forceBalancedSides
    ? "- If a meal feels incomplete, explicitly add a realistic accompaniment so it becomes a full balanced meal. Do not leave any main meal underbuilt."
    : "";
  const strictPlateInstruction = options.strictPlateBalance
    ? "- Every meal must read like a complete plate. Each meal needs a main plus a meaningful accompaniment that improves balance, such as curd, raita, buttermilk, fruit, salad, sauteed vegetables, sprouts, eggs when allowed, or dal. Breads or rice can be part of the meal, but they should not be the only accompaniment."
    : "";
  const macroRecoveryInstruction = options.correctiveInstruction ? `- ${options.correctiveInstruction}` : "";
  const proteinAnchorGuidance = getProteinAnchorGuidance(profile);

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
- Use realistic macro numbers. Avoid vague or inflated nutrition estimates.
- Make every meal's calories internally consistent with macros using the 4/4/9 rule.
- Keep totalProtein, totalCarbs, and totalFat as practical whole-number estimates.
- The full day should land close to the requested protein, carbs, and fat targets, not just vaguely near them.
- Breakfast, lunch, and dinner should each feel balanced on their own, not just in the day total.
- Most main meals should include a clear protein anchor plus a practical carb or fiber component.
- Avoid making lunch or dinner feel like only one ingredient plus sauce.
- Distribute protein across the day so the user is not relying on one meal to reach the target.
- Make sure the snack contributes meaningfully to the day's macro targets when a snack is included.
- If a main meal is missing balance, pair it with a practical side instead of leaving it incomplete.
- ${proteinAnchorGuidance}
- Good accompaniment examples: fruit, curd, buttermilk, eggs when allowed, raita, kachumber salad, cucumber salad, sauteed vegetables, vegetable salad, sprouts, or a simple dal.
- Do not leave breakfast, lunch, or dinner as a lone dish if adding one realistic side would make it feel more complete.
- Every meal must explicitly mention a companion item in serving.primary, such as "1 bowl moong dal with cucumber salad and curd" or "vegetable omelette with fruit and curd".
- Snacks should also feel complete, for example "greek yogurt + fruit" or "2 boiled eggs with buttermilk".
- Avoid plain single-item instructions like "1 bowl moong dal" or "1 bowl oats" unless a balancing side is also named in the same serving instruction.
 - ${repeatMealsInstruction}
 ${avoidMealsInstruction}
 ${avoidSnackInstruction}
 ${eggsGuidance}
 ${forceEggMealInstruction}
 ${forceBalancedSidesInstruction}
 ${strictPlateInstruction}
 ${macroRecoveryInstruction}
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

function hasEggContent(meal) {
  const haystack = `${meal.name} ${meal.ingredients.map((ingredient) => ingredient.ingredientName).join(" ")}`.toLowerCase();
  return /\begg\b|\beggs\b|\bomelette\b|\bomelet\b|\bbhurji\b/.test(haystack);
}

async function reviewBalancedMeals(profile, aiPlan) {
  const localClient = requireClient();
  const response = await localClient.responses.create({
    model: MODEL,
    max_output_tokens: 600,
    input: [
      {
        role: "system",
        content:
          "You are reviewing meal plans for practical nutrition quality. Return valid JSON only. Judge whether each meal reads like a balanced real-life meal with a meaningful accompaniment. Bread or rice may be present but should not be treated as the only balancing accompaniment."
      },
      {
        role: "user",
        content: `
Review this meal plan for a ${profile.cuisinePreference} ${profile.dietaryPattern} eater.

Profile context:
- Goal: ${profile.goal}
- Calories: ${profile.calorieTarget}
- Protein target: ${profile.macroTargets.protein}g
- Carb target: ${profile.macroTargets.carbs}g
- Fat target: ${profile.macroTargets.fat}g
- Eggs allowed: ${shouldRequireEggMeal(profile) ? "yes" : "no"}

For each meal, decide:
- isBalanced: true only if it reads like a complete, practical meal
- hasRealAccompaniment: true only if it includes a meaningful accompaniment like curd, raita, buttermilk, fruit, salad, vegetables, sprouts, eggs when allowed, or dal

Do not count roti, chapati, phulka, naan, bread, rice, poha, or oats as the only accompaniment.

Meal plan:
${JSON.stringify(
  aiPlan.meals.map((meal) => ({
    mealType: meal.mealType,
    name: meal.name,
    serving: meal.serving,
    ingredients: meal.ingredients
  }))
)}
`.trim()
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "ai_meal_plan_review",
        strict: true,
        schema: aiMealPlanReviewJsonSchema
      }
    }
  });

  const message = response.output?.find((item) => item.type === "message");
  const textContent = message?.content?.find((item) => item.type === "output_text");
  const raw = textContent?.text ?? response.output_text;
  if (!raw) {
    throw new Error("Could not review meal balance.");
  }

  return aiMealPlanReviewSchema.parse(JSON.parse(raw));
}

function isBalancedMainMeal(meal) {
  if (meal.mealType === "snack") {
    return true;
  }

  const proteinFloor = meal.mealType === "breakfast" ? 12 : 15;
  const carbFloor = meal.mealType === "breakfast" ? 12 : 18;

  return meal.totalProtein >= proteinFloor && meal.totalCarbs >= carbFloor && meal.ingredients.length >= 2;
}

async function validateDailyPlan(profile, aiPlan) {
  const underbuiltMeals = aiPlan.meals.filter((meal) => !isBalancedMainMeal(meal));
  if (underbuiltMeals.length) {
    throw new Error(`Unbalanced meals returned: ${underbuiltMeals.map((meal) => meal.name).join(", ")}`);
  }

  const review = await reviewBalancedMeals(profile, aiPlan);
  const rejectedMeals = review.meals.filter((meal) => !meal.isBalanced || !meal.hasRealAccompaniment);
  if (rejectedMeals.length) {
    throw new Error(`Meals failed balanced plate review: ${rejectedMeals.map((meal) => `${meal.name} (${meal.notes})`).join(", ")}`);
  }

  if (shouldRequireEggMeal(profile) && !aiPlan.meals.some((meal) => hasEggContent(meal))) {
    throw new Error("Expected at least one egg-based meal for this vegetarian profile.");
  }

  const totals = aiPlan.meals.reduce(
    (accumulator, meal) => ({
      protein: accumulator.protein + meal.totalProtein,
      carbs: accumulator.carbs + meal.totalCarbs,
      fat: accumulator.fat + meal.totalFat
    }),
    { protein: 0, carbs: 0, fat: 0 }
  );

  const proteinToleranceFloor =
    profile.dietaryPattern === "vegetarian"
      ? shouldRequireEggMeal(profile)
        ? 0.75
        : 0.72
      : profile.dietaryPattern === "vegan"
        ? 0.7
        : 0.85;

  const macroBounds = {
    protein: { min: profile.macroTargets.protein * proteinToleranceFloor, max: profile.macroTargets.protein * 1.2 },
    carbs: { min: profile.macroTargets.carbs * 0.75, max: profile.macroTargets.carbs * 1.25 },
    fat: { min: profile.macroTargets.fat * 0.75, max: profile.macroTargets.fat * 1.25 }
  };

  if (totals.protein < macroBounds.protein.min || totals.protein > macroBounds.protein.max) {
    throw new Error("Protein target was missed by too much.");
  }

  if (totals.carbs < macroBounds.carbs.min || totals.carbs > macroBounds.carbs.max) {
    throw new Error("Carb target was missed by too much.");
  }

  if (totals.fat < macroBounds.fat.min || totals.fat > macroBounds.fat.max) {
    throw new Error("Fat target was missed by too much.");
  }
}

function normalizeMealNutrition(meal) {
  const totalProtein = Math.max(0, Math.round(meal.totalProtein));
  const totalCarbs = Math.max(0, Math.round(meal.totalCarbs));
  const totalFat = Math.max(0, Math.round(meal.totalFat));
  const totalCalories = Math.round(totalProtein * 4 + totalCarbs * 4 + totalFat * 9);

  return {
    totalProtein,
    totalCarbs,
    totalFat,
    totalCalories
  };
}

function sanitizeAiMealPlanJson(json) {
  if (!json || typeof json !== "object" || !Array.isArray(json.meals)) {
    return json;
  }

  return {
    ...json,
    meals: json.meals.map((meal) => {
      if (!meal || typeof meal !== "object") {
        return meal;
      }

      const sanitizeNumber = (value) => {
        if (typeof value !== "number" || Number.isNaN(value)) {
          return value;
        }

        return value < 0 ? 0 : value;
      };

      return {
        ...meal,
        totalCalories: sanitizeNumber(meal.totalCalories),
        totalProtein: sanitizeNumber(meal.totalProtein),
        totalCarbs: sanitizeNumber(meal.totalCarbs),
        totalFat: sanitizeNumber(meal.totalFat),
        ingredients: Array.isArray(meal.ingredients)
          ? meal.ingredients.map((ingredient) => ({
              ...ingredient,
              quantity: sanitizeNumber(ingredient?.quantity)
            }))
          : meal.ingredients
      };
    })
  };
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
    ...normalizeMealNutrition(meal),
    id: slugify(`${meal.mealType}-${meal.name}`),
    name: meal.name,
    mealType: meal.mealType,
    description: `${meal.name} tailored to your calorie and macro target.`,
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
    note: "Day plan aligned to your calories, macros, cuisine preference, and prep style."
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
    note: "Weekly plan with daily variety, weekly groceries, and reusable prep structure."
  };
}

async function generateDailyPlanAttempt(profile, date, options = {}) {
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

  const aiPlan = aiMealPlanSchema.parse(sanitizeAiMealPlanJson(json));
  await validateDailyPlan(profile, aiPlan);
  return await postProcessPlan(aiPlan, profile.cuisinePreference);
}

export async function generateDailyPlan(profile, date, options = {}) {
  let lastError;
  const baseAttempts = [
    options,
    {
      ...options,
      forceBalancedSides: true,
      forceEggMeal: shouldRequireEggMeal(profile),
      strictPlateBalance: true
    },
    {
      ...options,
      forceBalancedSides: true,
      forceEggMeal: shouldRequireEggMeal(profile),
      strictPlateBalance: true,
      repeatFromMeals: [],
      avoidMeals: []
    },
    {
      ...options,
      forceBalancedSides: true,
      forceEggMeal: shouldRequireEggMeal(profile),
      strictPlateBalance: true,
      repeatFromMeals: [],
      avoidMeals: [],
      avoidSnacks: []
    }
  ];

  for (const attempt of baseAttempts) {
    try {
      return await generateDailyPlanAttempt(profile, date, attempt);
    } catch (error) {
      lastError = error;
    }
  }

  const errorMessage = `${lastError?.message ?? ""}`;
  if (/(Protein|Carb|Fat) target was missed by too much\./.test(errorMessage)) {
    const nutrient = errorMessage.split(" target")[0].toLowerCase();
    return await generateDailyPlanAttempt(profile, date, {
      ...options,
      forceBalancedSides: true,
      forceEggMeal: shouldRequireEggMeal(profile),
      strictPlateBalance: true,
      repeatFromMeals: [],
      avoidMeals: [],
      avoidSnacks: [],
      correctiveInstruction: `The previous attempt missed the ${nutrient} target too much. Regenerate the full day so the meals collectively land much closer to the requested macros, with practical portions and stronger ${nutrient === "protein" ? "protein anchors" : nutrient === "carb" ? "carb-supporting sides and portions" : "healthy fat sources"} across the day.`
    });
  }

  throw lastError;
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
