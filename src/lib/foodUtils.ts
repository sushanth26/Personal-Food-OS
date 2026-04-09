import { DailyMealPlan, GroceryListItem, PlannedMeal, Reminder, WeeklyMealPlan } from "../types";

export function formatIngredientLabel(name: string) {
  return name
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\bplain\b/gi, "")
    .replace(/\bcooked\b/gi, "")
    .replace(/\bdry\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function getMealPortionSummary(
  ingredients: Array<{ ingredientName: string; quantity: number }>
) {
  const totalQuantity = Math.round(ingredients.reduce((sum, ingredient) => sum + ingredient.quantity, 0));
  const mainIngredients = [...ingredients]
    .filter((ingredient) => {
      const lower = ingredient.ingredientName.toLowerCase();
      return (
        ingredient.quantity >= 40 &&
        !/(oil|spice|masala|ginger|garlic|chili|coriander|lemon juice|tomato puree|tomato paste|water)/.test(lower)
      );
    })
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 2)
    .map((ingredient) => ({
      ...ingredient,
      shortName: formatIngredientLabel(ingredient.ingredientName)
    }));

  return { totalQuantity, mainIngredients };
}

function isMealBaseIngredient(name: string) {
  return /(tomato|onion|puree|paste|masala|gravy|sauce|water|oil)/.test(name.toLowerCase());
}

function formatFocusIngredient(name: string) {
  const clean = formatIngredientLabel(name).toLowerCase();

  if (/kidney bean/.test(clean)) {
    return "kidney bean curry";
  }

  if (/chickpea|chole|chana/.test(clean)) {
    return "chickpea curry";
  }

  if (/moong dal/.test(clean)) {
    return "moong dal";
  }

  if (/dal|lentil/.test(clean)) {
    return "dal";
  }

  if (/paneer/.test(clean)) {
    return "paneer";
  }

  if (/rice/.test(clean)) {
    return "rice";
  }

  if (/spinach/.test(clean)) {
    return "spinach";
  }

  return clean;
}

function inferServingPrimaryFallback(meal: PlannedMeal) {
  const lowerName = meal.name.toLowerCase();

  if (/(roti|chapati|phulka)/.test(lowerName)) {
    return "2 rotis with your main dish";
  }

  if (/(paratha|dosa|cheela|chilla|uttapam)/.test(lowerName)) {
    return `1 plate ${lowerName}`;
  }

  if (/idli/.test(lowerName)) {
    return "3 idlis";
  }

  if (/(rice|poha|upma|pulao|biryani|khichdi|oats|dal|rajma|chole|sabzi|paneer|curry|sambar)/.test(lowerName)) {
    return `1 bowl ${lowerName}`;
  }

  return meal.mealType === "snack" ? `1 serving ${lowerName}` : `1 serving ${lowerName}`;
}

export function getMealServingDisplay(meal: PlannedMeal) {
  const portionSummary = getMealPortionSummary(meal.ingredients);
  const focusIngredients = portionSummary.mainIngredients.filter((ingredient) => !isMealBaseIngredient(ingredient.shortName));
  const namedFocusIngredients = (focusIngredients.length ? focusIngredients : portionSummary.mainIngredients).map((ingredient) =>
    formatFocusIngredient(ingredient.shortName)
  );
  const primary = meal.serving?.primary?.trim() || inferServingPrimaryFallback(meal);
  const secondary = meal.serving?.secondary?.trim() || "";
  const detail =
    namedFocusIngredients.length > 1
      ? `Main ingredients: ${namedFocusIngredients.join(" and ")}`
      : "";

  return {
    primary,
    secondary,
    detail,
    totalQuantity: portionSummary.totalQuantity
  };
}

export function getMealBalanceSummary(meal: PlannedMeal) {
  const protein = meal.totalProtein;
  const carbs = meal.totalCarbs;
  const fat = meal.totalFat;

  const proteinStrong = protein >= 20;
  const carbPresent = carbs >= 18;
  const fatPresent = fat >= 6;

  let label = "Balanced meal";
  if (proteinStrong && carbPresent && fatPresent) {
    label = "Balanced meal";
  } else if (proteinStrong && carbPresent) {
    label = "Protein + carb balanced";
  } else if (proteinStrong) {
    label = "Protein-forward";
  } else if (carbPresent && !proteinStrong) {
    label = "Carb-forward";
  } else if (fatPresent && !proteinStrong && !carbPresent) {
    label = "Light meal";
  }

  const parts = [];
  if (protein >= 12) {
    parts.push("protein");
  }
  if (carbs >= 15) {
    parts.push("carbs");
  }
  if (fat >= 6) {
    parts.push("healthy fats");
  }

  return {
    label,
    detail: parts.length >= 2 ? `Covers ${parts.join(", ")}` : ""
  };
}

export function formatContext(context: string) {
  return context.replaceAll("_", " ");
}

export function formatDisplayDate(value: string) {
  if (!value) {
    return "unscheduled day";
  }

  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return "unscheduled day";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(date);
}

export function getDisplayedReminders(plan: DailyMealPlan | null, weekPlan: WeeklyMealPlan | null) {
  if (weekPlan) {
    return weekPlan.days.flatMap((day) => day.reminders);
  }

  return plan?.reminders ?? [];
}

export function groupRemindersBySoakDate(reminders: Reminder[]) {
  const today = new Date().toISOString().slice(0, 10);
  const reminderMap = new Map<string, Reminder[]>();

  reminders.forEach((reminder) => {
    const key = reminder.soakOnDate ?? reminder.targetDate ?? "unscheduled";
    if (key !== "unscheduled" && key < today) {
      return;
    }

    const group = reminderMap.get(key) ?? [];
    group.push(reminder);
    reminderMap.set(key, group);
  });

  return [...reminderMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, items]) => ({ date, items }));
}

export function getWeekStartDate() {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  today.setDate(today.getDate() + diff);
  return today.toISOString().slice(0, 10);
}

export function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getGroceryKey(name: string) {
  return formatIngredientLabel(name)
    .toLowerCase()
    .replace(/\sfresh\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCaseWords(value: string) {
  return value.replace(/\b[a-z]/g, (match) => match.toUpperCase());
}

export function groupGroceryItems(items: GroceryListItem[]) {
  const grouped = {
    fruits: [] as GroceryListItem[],
    vegetables: [] as GroceryListItem[],
    dry_items: [] as GroceryListItem[]
  };
  const seen = new Set<string>();

  items.forEach((item) => {
    const dedupedKey = getGroceryKey(item.canonicalName ?? item.ingredientName);
    if (seen.has(dedupedKey)) {
      return;
    }

    seen.add(dedupedKey);
    grouped[item.category ?? "dry_items"].push({
      ...item,
      ingredientId: dedupedKey,
      ingredientName: titleCaseWords(item.canonicalName ?? formatIngredientLabel(item.ingredientName))
    });
  });

  return grouped;
}

export function aggregateWeeklyGroceryList(days: DailyMealPlan[]): GroceryListItem[] {
  const ingredientMap = new Map<string, GroceryListItem>();

  for (const day of days) {
    for (const item of day.groceryList) {
      const itemKey = getGroceryKey(item.canonicalName ?? item.ingredientName);
      const existing = ingredientMap.get(itemKey);
      if (existing) {
        existing.totalQuantity = Math.round((existing.totalQuantity + item.totalQuantity) * 10) / 10;
      } else {
        ingredientMap.set(itemKey, {
          ...item,
          ingredientId: itemKey,
          ingredientName: titleCaseWords(item.canonicalName ?? formatIngredientLabel(item.ingredientName))
        });
      }
    }
  }

  return [...ingredientMap.values()].sort((a, b) => a.ingredientName.localeCompare(b.ingredientName));
}

export function buildWeeklyPlanFromDays(startDate: string, days: DailyMealPlan[]): WeeklyMealPlan {
  const totals = days.reduce(
    (accumulator, day) => ({
      calories: Math.round((accumulator.calories + day.totals.calories) * 10) / 10,
      protein: Math.round((accumulator.protein + day.totals.protein) * 10) / 10,
      carbs: Math.round((accumulator.carbs + day.totals.carbs) * 10) / 10,
      fat: Math.round((accumulator.fat + day.totals.fat) * 10) / 10
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return {
    startDate,
    days,
    totals,
    groceryList: aggregateWeeklyGroceryList(days),
    note: "Weekly plan with day-by-day meals and one combined grocery list."
  };
}
