import { DailyMealPlan, GroceryListItem, Reminder, WeeklyMealPlan } from "../types";

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
        !/(oil|spice|masala|ginger|garlic|chili|coriander|lemon juice)/.test(lower)
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
    note: "AI-generated weekly plan with day-by-day meals and one combined grocery list."
  };
}
