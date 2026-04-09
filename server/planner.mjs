import { XAI_MAX_OUTPUT_TOKENS } from "./config.mjs";
import { MODEL, requireClient } from "./xaiClient.mjs";
import { aiGroceryNormalizationJsonSchema, aiGroceryNormalizationSchema, aiMealPlanJsonSchema, aiMealPlanSchema } from "./schemas.mjs";
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

function createIngredient(ingredientName, quantity, nutrition) {
  return {
    ingredientId: getIngredientKey(ingredientName),
    ingredientName: formatIngredientName(ingredientName),
    quantity,
    unit: "g",
    estimatedCalories: nutrition.calories,
    estimatedProtein: nutrition.protein,
    estimatedCarbs: nutrition.carbs,
    estimatedFat: nutrition.fat
  };
}

function createMeal({
  mealType,
  name,
  servingPrimary,
  servingSecondary,
  items,
  description
}) {
  const totals = items.reduce(
    (accumulator, item) => ({
      totalCalories: accumulator.totalCalories + item.nutrition.calories,
      totalProtein: accumulator.totalProtein + item.nutrition.protein,
      totalCarbs: accumulator.totalCarbs + item.nutrition.carbs,
      totalFat: accumulator.totalFat + item.nutrition.fat
    }),
    { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 }
  );

  return {
    id: slugify(`${mealType}-${name}`),
    name,
    mealType,
    description,
    ...normalizeMealNutrition(totals),
    scaleFactor: 1,
    serving: {
      primary: servingPrimary,
      secondary: servingSecondary
    },
    ingredients: items.map((item) => createIngredient(item.name, item.quantity, item.nutrition))
  };
}

function getDateIndex(date) {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return 0;
  }

  return parsed.getUTCDate();
}

function createFallbackDailyPlan(profile, date) {
  const eggFriendlyVegetarian = shouldRequireEggMeal(profile);
  const isVegetarian = profile.dietaryPattern === "vegetarian";
  const isVegan = profile.dietaryPattern === "vegan";
  const dayIndex = getDateIndex(date);

  const breakfastOptions = eggFriendlyVegetarian
    ? [
        createMeal({
          mealType: "breakfast",
          name: "Masala Egg Bhurji",
          servingPrimary: "1 plate egg bhurji + 2 rotis",
          servingSecondary: "Add 1 small fruit on the side",
          description: "Balanced breakfast with eggs, rotis, and fruit.",
          items: [
            { name: "eggs", quantity: 150, nutrition: { calories: 210, protein: 18, carbs: 2, fat: 15 } },
            { name: "whole wheat roti", quantity: 100, nutrition: { calories: 220, protein: 7, carbs: 42, fat: 3 } },
            { name: "banana", quantity: 100, nutrition: { calories: 89, protein: 1, carbs: 23, fat: 0 } }
          ]
        }),
        createMeal({
          mealType: "breakfast",
          name: "Egg Dosa Plate",
          servingPrimary: "2 egg dosas + curd",
          servingSecondary: "Breakfast with a simple protein side",
          description: "Balanced breakfast with dosa and eggs.",
          items: [
            { name: "egg dosa", quantity: 220, nutrition: { calories: 310, protein: 18, carbs: 28, fat: 14 } },
            { name: "curd", quantity: 120, nutrition: { calories: 90, protein: 8, carbs: 8, fat: 3 } },
            { name: "orange", quantity: 100, nutrition: { calories: 47, protein: 1, carbs: 12, fat: 0 } }
          ]
        }),
        createMeal({
          mealType: "breakfast",
          name: "Boiled Egg Poha",
          servingPrimary: "1 plate poha + 2 boiled eggs",
          servingSecondary: "Add fruit if you want a little more volume",
          description: "Balanced breakfast with poha and eggs.",
          items: [
            { name: "poha", quantity: 220, nutrition: { calories: 280, protein: 6, carbs: 46, fat: 8 } },
            { name: "eggs", quantity: 100, nutrition: { calories: 140, protein: 12, carbs: 1, fat: 10 } },
            { name: "apple", quantity: 100, nutrition: { calories: 52, protein: 0, carbs: 14, fat: 0 } }
          ]
        })
      ]
    : [
        createMeal({
          mealType: "breakfast",
          name: "Moong Chilla Plate",
          servingPrimary: isVegan ? "2 moong cheelas + 1 fruit" : "2 moong cheelas + curd + 1 fruit",
          servingSecondary: "Protein-forward breakfast with a real side",
          description: "Balanced breakfast with chilla, fruit, and a simple side.",
          items: [
            { name: "moong dal cheela", quantity: 180, nutrition: { calories: 260, protein: 16, carbs: 28, fat: 7 } },
            {
              name: isVegan ? "papaya" : "curd",
              quantity: 120,
              nutrition: isVegan ? { calories: 52, protein: 1, carbs: 13, fat: 0 } : { calories: 90, protein: 8, carbs: 8, fat: 3 }
            },
            { name: "apple", quantity: 100, nutrition: { calories: 52, protein: 0, carbs: 14, fat: 0 } }
          ]
        }),
        createMeal({
          mealType: "breakfast",
          name: "Besan Chilla Plate",
          servingPrimary: isVegan ? "2 besan cheelas + chutney + fruit" : "2 besan cheelas + curd + fruit",
          servingSecondary: "Simple breakfast with a companion side",
          description: "Balanced breakfast with besan chilla.",
          items: [
            { name: "besan cheela", quantity: 180, nutrition: { calories: 250, protein: 14, carbs: 26, fat: 9 } },
            {
              name: isVegan ? "banana" : "curd",
              quantity: 120,
              nutrition: isVegan ? { calories: 89, protein: 1, carbs: 23, fat: 0 } : { calories: 90, protein: 8, carbs: 8, fat: 3 }
            },
            { name: "orange", quantity: 100, nutrition: { calories: 47, protein: 1, carbs: 12, fat: 0 } }
          ]
        }),
        createMeal({
          mealType: "breakfast",
          name: "Oats Yogurt Bowl",
          servingPrimary: isVegan ? "1 oats bowl + fruit + roasted chana" : "1 oats bowl + greek yogurt + fruit",
          servingSecondary: "Balanced breakfast with a simple add-on",
          description: "Quick breakfast with oats and a side.",
          items: [
            { name: "oats", quantity: 180, nutrition: { calories: 250, protein: 10, carbs: 34, fat: 7 } },
            {
              name: isVegan ? "roasted chana" : "greek yogurt",
              quantity: 140,
              nutrition: isVegan ? { calories: 150, protein: 8, carbs: 20, fat: 4 } : { calories: 100, protein: 14, carbs: 5, fat: 2 }
            },
            { name: "banana", quantity: 100, nutrition: { calories: 89, protein: 1, carbs: 23, fat: 0 } }
          ]
        })
      ];

  const lunchOptions = isVegetarian
    ? [
        createMeal({
          mealType: "lunch",
          name: "Dal Rice Plate",
          servingPrimary: "1 bowl dal + 1 cup rice + salad",
          servingSecondary: eggFriendlyVegetarian ? "Add 2 boiled eggs on the side" : "Balanced lunch with a fresh side",
          description: "Comforting lunch with dal, rice, and a side.",
          items: [
            { name: "dal tadka", quantity: 250, nutrition: { calories: 280, protein: 18, carbs: 30, fat: 9 } },
            { name: "rice", quantity: 180, nutrition: { calories: 230, protein: 4, carbs: 50, fat: 1 } },
            { name: "salad", quantity: 120, nutrition: { calories: 30, protein: 1, carbs: 6, fat: 0 } },
            ...(eggFriendlyVegetarian ? [{ name: "eggs", quantity: 100, nutrition: { calories: 140, protein: 12, carbs: 1, fat: 10 } }] : [])
          ]
        }),
        createMeal({
          mealType: "lunch",
          name: "Rajma Rice Plate",
          servingPrimary: "1 bowl rajma + 1 cup rice + salad",
          servingSecondary: "Lunch with a fresh side",
          description: "Balanced rajma lunch.",
          items: [
            { name: "rajma", quantity: 250, nutrition: { calories: 300, protein: 18, carbs: 36, fat: 8 } },
            { name: "rice", quantity: 180, nutrition: { calories: 230, protein: 4, carbs: 50, fat: 1 } },
            { name: "salad", quantity: 120, nutrition: { calories: 30, protein: 1, carbs: 6, fat: 0 } }
          ]
        }),
        createMeal({
          mealType: "lunch",
          name: "Paneer Roti Lunch",
          servingPrimary: "1 bowl paneer + 2 rotis + cucumber salad",
          servingSecondary: "Lunch with a clear side",
          description: "Balanced paneer lunch.",
          items: [
            { name: "paneer curry", quantity: 220, nutrition: { calories: 360, protein: 24, carbs: 10, fat: 24 } },
            { name: "whole wheat roti", quantity: 100, nutrition: { calories: 220, protein: 7, carbs: 42, fat: 3 } },
            { name: "cucumber salad", quantity: 120, nutrition: { calories: 30, protein: 1, carbs: 6, fat: 0 } }
          ]
        })
      ]
    : [
        createMeal({
          mealType: "lunch",
          name: "Chicken Rice Plate",
          servingPrimary: "1 bowl chicken curry + 1 cup rice + salad",
          servingSecondary: "Balanced lunch with a fresh side",
          description: "Chicken lunch with rice and salad.",
          items: [
            { name: "chicken curry", quantity: 220, nutrition: { calories: 330, protein: 32, carbs: 8, fat: 18 } },
            { name: "rice", quantity: 180, nutrition: { calories: 230, protein: 4, carbs: 50, fat: 1 } },
            { name: "salad", quantity: 120, nutrition: { calories: 30, protein: 1, carbs: 6, fat: 0 } }
          ]
        }),
        createMeal({
          mealType: "lunch",
          name: "Fish Rice Plate",
          servingPrimary: "1 bowl fish curry + 1 cup rice + salad",
          servingSecondary: "Lunch with a fresh side",
          description: "Balanced fish lunch.",
          items: [
            { name: "fish curry", quantity: 220, nutrition: { calories: 320, protein: 30, carbs: 8, fat: 18 } },
            { name: "rice", quantity: 180, nutrition: { calories: 230, protein: 4, carbs: 50, fat: 1 } },
            { name: "salad", quantity: 120, nutrition: { calories: 30, protein: 1, carbs: 6, fat: 0 } }
          ]
        }),
        createMeal({
          mealType: "lunch",
          name: "Chicken Roti Plate",
          servingPrimary: "1 bowl chicken + 2 rotis + sauteed vegetables",
          servingSecondary: "Lunch with a vegetable side",
          description: "Balanced chicken lunch.",
          items: [
            { name: "chicken masala", quantity: 220, nutrition: { calories: 330, protein: 32, carbs: 8, fat: 18 } },
            { name: "whole wheat roti", quantity: 100, nutrition: { calories: 220, protein: 7, carbs: 42, fat: 3 } },
            { name: "sauteed vegetables", quantity: 140, nutrition: { calories: 70, protein: 3, carbs: 10, fat: 2 } }
          ]
        })
      ];

  const dinnerOptions = isVegetarian
    ? [
        createMeal({
          mealType: "dinner",
          name: "Paneer Roti Plate",
          servingPrimary: "1 bowl paneer + 2 rotis + sauteed vegetables",
          servingSecondary: "Dinner with a clear protein and vegetable side",
          description: "Balanced dinner with paneer, rotis, and vegetables.",
          items: [
            { name: "paneer curry", quantity: 220, nutrition: { calories: 360, protein: 24, carbs: 10, fat: 24 } },
            { name: "whole wheat roti", quantity: 100, nutrition: { calories: 220, protein: 7, carbs: 42, fat: 3 } },
            { name: "sauteed vegetables", quantity: 140, nutrition: { calories: 70, protein: 3, carbs: 10, fat: 2 } }
          ]
        }),
        createMeal({
          mealType: "dinner",
          name: "Dal Roti Plate",
          servingPrimary: "1 bowl dal + 2 rotis + cucumber salad",
          servingSecondary: eggFriendlyVegetarian ? "Add 2 boiled eggs on the side" : "Dinner with a clean side",
          description: "Balanced dal dinner.",
          items: [
            { name: "dal fry", quantity: 250, nutrition: { calories: 280, protein: 18, carbs: 30, fat: 9 } },
            { name: "whole wheat roti", quantity: 100, nutrition: { calories: 220, protein: 7, carbs: 42, fat: 3 } },
            { name: "cucumber salad", quantity: 120, nutrition: { calories: 30, protein: 1, carbs: 6, fat: 0 } },
            ...(eggFriendlyVegetarian ? [{ name: "eggs", quantity: 100, nutrition: { calories: 140, protein: 12, carbs: 1, fat: 10 } }] : [])
          ]
        }),
        createMeal({
          mealType: "dinner",
          name: "Chole Rice Plate",
          servingPrimary: "1 bowl chole + 1 cup rice + salad",
          servingSecondary: "Dinner with a real side",
          description: "Balanced chole dinner.",
          items: [
            { name: "chole", quantity: 250, nutrition: { calories: 310, protein: 16, carbs: 38, fat: 9 } },
            { name: "rice", quantity: 180, nutrition: { calories: 230, protein: 4, carbs: 50, fat: 1 } },
            { name: "salad", quantity: 120, nutrition: { calories: 30, protein: 1, carbs: 6, fat: 0 } }
          ]
        })
      ]
    : [
        createMeal({
          mealType: "dinner",
          name: "Fish Roti Plate",
          servingPrimary: "1 plate fish curry + 2 rotis + vegetables",
          servingSecondary: "Dinner with a clear side",
          description: "Balanced dinner with fish, rotis, and vegetables.",
          items: [
            { name: "fish curry", quantity: 220, nutrition: { calories: 320, protein: 30, carbs: 8, fat: 18 } },
            { name: "whole wheat roti", quantity: 100, nutrition: { calories: 220, protein: 7, carbs: 42, fat: 3 } },
            { name: "sauteed vegetables", quantity: 140, nutrition: { calories: 70, protein: 3, carbs: 10, fat: 2 } }
          ]
        }),
        createMeal({
          mealType: "dinner",
          name: "Chicken Dal Plate",
          servingPrimary: "1 bowl chicken + 1 small bowl dal + 2 rotis",
          servingSecondary: "Dinner with a complete side pairing",
          description: "Balanced chicken dinner.",
          items: [
            { name: "chicken curry", quantity: 200, nutrition: { calories: 300, protein: 30, carbs: 8, fat: 16 } },
            { name: "dal", quantity: 180, nutrition: { calories: 210, protein: 12, carbs: 22, fat: 7 } },
            { name: "whole wheat roti", quantity: 100, nutrition: { calories: 220, protein: 7, carbs: 42, fat: 3 } }
          ]
        }),
        createMeal({
          mealType: "dinner",
          name: "Fish Rice Plate",
          servingPrimary: "1 bowl fish curry + 1 cup rice + salad",
          servingSecondary: "Dinner with a fresh side",
          description: "Balanced fish dinner.",
          items: [
            { name: "fish curry", quantity: 220, nutrition: { calories: 320, protein: 30, carbs: 8, fat: 18 } },
            { name: "rice", quantity: 180, nutrition: { calories: 230, protein: 4, carbs: 50, fat: 1 } },
            { name: "salad", quantity: 120, nutrition: { calories: 30, protein: 1, carbs: 6, fat: 0 } }
          ]
        })
      ];

  const breakfast = breakfastOptions[dayIndex % breakfastOptions.length];
  const lunch = lunchOptions[(dayIndex + 1) % lunchOptions.length];
  const dinner = dinnerOptions[(dayIndex + 2) % dinnerOptions.length];

  const meals = [breakfast, lunch, dinner];

  if (profile.mealsPerDay === 4) {
    const snackOptions = eggFriendlyVegetarian
      ? [
          createMeal({
            mealType: "snack",
            name: "Egg Yogurt Snack",
            servingPrimary: "Greek yogurt + 2 boiled eggs",
            servingSecondary: "Compact snack to support your day target",
            description: "Simple snack for extra protein.",
            items: [
              { name: "greek yogurt", quantity: 170, nutrition: { calories: 120, protein: 17, carbs: 6, fat: 2 } },
              { name: "eggs", quantity: 100, nutrition: { calories: 140, protein: 12, carbs: 1, fat: 10 } }
            ]
          }),
          createMeal({
            mealType: "snack",
            name: "Egg Buttermilk Snack",
            servingPrimary: "2 boiled eggs + buttermilk",
            servingSecondary: "Simple protein snack with a side",
            description: "Protein snack with a drink side.",
            items: [
              { name: "eggs", quantity: 100, nutrition: { calories: 140, protein: 12, carbs: 1, fat: 10 } },
              { name: "buttermilk", quantity: 200, nutrition: { calories: 70, protein: 6, carbs: 8, fat: 2 } }
            ]
          }),
          createMeal({
            mealType: "snack",
            name: "Fruit Yogurt Snack",
            servingPrimary: "Greek yogurt + fruit + 1 boiled egg",
            servingSecondary: "Light snack with a companion side",
            description: "Balanced snack with fruit and protein.",
            items: [
              { name: "greek yogurt", quantity: 170, nutrition: { calories: 120, protein: 17, carbs: 6, fat: 2 } },
              { name: "apple", quantity: 100, nutrition: { calories: 52, protein: 0, carbs: 14, fat: 0 } },
              { name: "eggs", quantity: 50, nutrition: { calories: 70, protein: 6, carbs: 1, fat: 5 } }
            ]
          })
        ]
      : [
          createMeal({
            mealType: "snack",
            name: "Yogurt Fruit Snack",
            servingPrimary: isVegan ? "Roasted chana + fruit" : "Greek yogurt + fruit",
            servingSecondary: "Compact snack to support your day target",
            description: "Simple snack for extra protein.",
            items: isVegan
              ? [
                  { name: "roasted chana", quantity: 170, nutrition: { calories: 180, protein: 9, carbs: 24, fat: 5 } },
                  { name: "apple", quantity: 100, nutrition: { calories: 52, protein: 0, carbs: 14, fat: 0 } }
                ]
              : [
                  { name: "greek yogurt", quantity: 170, nutrition: { calories: 120, protein: 17, carbs: 6, fat: 2 } },
                  { name: "apple", quantity: 100, nutrition: { calories: 52, protein: 0, carbs: 14, fat: 0 } }
                ]
          }),
          createMeal({
            mealType: "snack",
            name: "Chana Fruit Snack",
            servingPrimary: "Roasted chana + orange",
            servingSecondary: "Simple snack with a fruit side",
            description: "Portable snack.",
            items: [
              { name: "roasted chana", quantity: 170, nutrition: { calories: 180, protein: 9, carbs: 24, fat: 5 } },
              { name: "orange", quantity: 100, nutrition: { calories: 47, protein: 1, carbs: 12, fat: 0 } }
            ]
          }),
          createMeal({
            mealType: "snack",
            name: "Curd Fruit Bowl",
            servingPrimary: isVegan ? "Fruit bowl + nuts" : "Curd + fruit bowl",
            servingSecondary: "Small snack with a side",
            description: "Light snack.",
            items: isVegan
              ? [
                  { name: "fruit bowl", quantity: 180, nutrition: { calories: 100, protein: 2, carbs: 24, fat: 0 } },
                  { name: "nuts", quantity: 20, nutrition: { calories: 120, protein: 4, carbs: 4, fat: 10 } }
                ]
              : [
                  { name: "curd", quantity: 170, nutrition: { calories: 120, protein: 9, carbs: 8, fat: 5 } },
                  { name: "banana", quantity: 100, nutrition: { calories: 89, protein: 1, carbs: 23, fat: 0 } }
                ]
          })
        ];
    meals.push(
      snackOptions[(dayIndex + 1) % snackOptions.length]
    );
  }

  const totals = meals.reduce(
    (accumulator, meal) => ({
      calories: round(accumulator.calories + meal.totalCalories),
      protein: round(accumulator.protein + meal.totalProtein),
      carbs: round(accumulator.carbs + meal.totalCarbs),
      fat: round(accumulator.fat + meal.totalFat)
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const groceryMap = new Map();
  meals.forEach((meal) => {
    meal.ingredients.forEach((ingredient) => {
      const key = ingredient.ingredientId;
      const existing = groceryMap.get(key);
      if (existing) {
        existing.totalQuantity = round(existing.totalQuantity + ingredient.quantity);
      } else {
        groceryMap.set(key, {
          ingredientId: key,
          ingredientName: ingredient.ingredientName,
          canonicalName: ingredient.ingredientName,
          category: getGroceryCategory(ingredient.ingredientName),
          totalQuantity: round(ingredient.quantity),
          unit: "g"
        });
      }
    });
  });

  return {
    date,
    meals,
    totals,
    reminders: inferReminders(date, meals),
    groceryList: [...groceryMap.values()],
    note: "Reliable day plan built from your preferences and nutrition target."
  };
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
    ? "- If a meal is incomplete, explicitly add a realistic side so it becomes balanced. Do not leave any main meal underbuilt."
    : "";

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
- Breakfast, lunch, and dinner should each feel balanced on their own, not just in the day total.
- Most main meals should include a clear protein anchor plus a practical carb or fiber component.
- Avoid making lunch or dinner feel like only one ingredient plus sauce.
- If a main meal is missing balance, pair it with a practical side instead of leaving it incomplete.
- Good side examples: fruit, curd, buttermilk, eggs when allowed, roti, rice, sauteed vegetables, salad, or a simple dal.
- Do not leave breakfast, lunch, or dinner as a lone dish if adding one realistic side would make it feel more complete.
- Every meal must explicitly mention a side or companion item in serving.primary, such as "1 bowl moong dal + 2 rotis" or "vegetable omelette with fruit and curd".
- Snacks should also feel complete, for example "greek yogurt + fruit" or "2 boiled eggs with buttermilk".
 - ${repeatMealsInstruction}
 ${avoidMealsInstruction}
 ${avoidSnackInstruction}
 ${eggsGuidance}
 ${forceEggMealInstruction}
 ${forceBalancedSidesInstruction}
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

function hasExplicitSide(meal) {
  const servingPrimary = `${meal.serving?.primary ?? ""}`.toLowerCase();
  return /\+/.test(servingPrimary) || /\bwith\b/.test(servingPrimary);
}

function isBalancedMainMeal(meal) {
  if (meal.mealType === "snack") {
    return true;
  }

  const proteinFloor = meal.mealType === "breakfast" ? 12 : 15;
  const carbFloor = meal.mealType === "breakfast" ? 12 : 18;

  return meal.totalProtein >= proteinFloor && meal.totalCarbs >= carbFloor && meal.ingredients.length >= 2;
}

function validateDailyPlan(profile, aiPlan) {
  const underbuiltMeals = aiPlan.meals.filter((meal) => !isBalancedMainMeal(meal));
  if (underbuiltMeals.length) {
    throw new Error(`Unbalanced meals returned: ${underbuiltMeals.map((meal) => meal.name).join(", ")}`);
  }

  const mealsMissingSides = aiPlan.meals.filter((meal) => !hasExplicitSide(meal));
  if (mealsMissingSides.length) {
    throw new Error(`Meals missing explicit sides: ${mealsMissingSides.map((meal) => meal.name).join(", ")}`);
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

export function generateFallbackDailyPlan(profile, date) {
  return createFallbackDailyPlan(profile, date);
}

export function generateFallbackWeeklyPlan(profile, startDate) {
  const days = Array.from({ length: 7 }, (_, index) => createFallbackDailyPlan(profile, addDays(startDate, index)));
  return buildWeeklyPlan(days);
}

function repairPlanMeals(profile, plan) {
  const fallbackPlan = createFallbackDailyPlan(profile, plan.date);
  const fallbackByMealType = new Map(fallbackPlan.meals.map((meal) => [meal.mealType, meal]));

  const meals = plan.meals.map((meal) => {
    if (isBalancedMainMeal(meal) && hasExplicitSide(meal)) {
      return meal;
    }

    return fallbackByMealType.get(meal.mealType) ?? meal;
  });

  if (shouldRequireEggMeal(profile) && !meals.some((meal) => hasEggContent(meal))) {
    const breakfastFallback = fallbackByMealType.get("breakfast");
    const snackFallback = fallbackByMealType.get("snack");
    const replacement =
      breakfastFallback && hasEggContent(breakfastFallback)
        ? breakfastFallback
        : snackFallback && hasEggContent(snackFallback)
          ? snackFallback
          : null;

    if (replacement) {
      const replacementIndex = meals.findIndex((meal) => meal.mealType === replacement.mealType);
      if (replacementIndex >= 0) {
        meals[replacementIndex] = replacement;
      }
    }
  }

  const totals = meals.reduce(
    (accumulator, meal) => ({
      calories: round(accumulator.calories + meal.totalCalories),
      protein: round(accumulator.protein + meal.totalProtein),
      carbs: round(accumulator.carbs + meal.totalCarbs),
      fat: round(accumulator.fat + meal.totalFat)
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const groceryMap = new Map();
  meals.forEach((meal) => {
    meal.ingredients.forEach((ingredient) => {
      const key = getIngredientKey(ingredient.ingredientName);
      const existing = groceryMap.get(key);
      if (existing) {
        existing.totalQuantity = round(existing.totalQuantity + ingredient.quantity);
      } else {
        groceryMap.set(key, {
          ingredientId: key,
          ingredientName: ingredient.ingredientName,
          canonicalName: ingredient.ingredientName,
          category: getGroceryCategory(ingredient.ingredientName),
          totalQuantity: round(ingredient.quantity),
          unit: "g"
        });
      }
    });
  });

  return {
    ...plan,
    meals,
    totals,
    reminders: inferReminders(plan.date, meals),
    groceryList: [...groceryMap.values()]
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
  validateDailyPlan(profile, aiPlan);
  const processedPlan = await postProcessPlan(aiPlan, profile.cuisinePreference);
  return repairPlanMeals(profile, processedPlan);
}

export async function generateDailyPlan(profile, date, options = {}) {
  const attempts = [
    options,
    {
      ...options,
      forceBalancedSides: true,
      forceEggMeal: shouldRequireEggMeal(profile)
    },
    {
      ...options,
      forceBalancedSides: true,
      forceEggMeal: shouldRequireEggMeal(profile),
      repeatFromMeals: [],
      avoidMeals: []
    }
  ];

  let lastError;
  for (const attempt of attempts) {
    try {
      return await generateDailyPlanAttempt(profile, date, attempt);
    } catch (error) {
      lastError = error;
    }
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
