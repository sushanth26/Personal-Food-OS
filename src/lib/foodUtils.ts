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

function singularizeWord(value: string) {
  if (value.endsWith("ies")) {
    return `${value.slice(0, -3)}y`;
  }

  if (value.endsWith("oes")) {
    return value.slice(0, -2);
  }

  if (value.endsWith("s") && !value.endsWith("ss")) {
    return value.slice(0, -1);
  }

  return value;
}

export function getDedupedGroceryKey(name: string) {
  return getGroceryKey(name)
    .split(" ")
    .map((part) => singularizeWord(part))
    .join(" ")
    .replace(/\bboneless\b/g, "")
    .replace(/\bskinless\b/g, "")
    .replace(/\braw\b/g, "")
    .replace(/\bboiled\b/g, "")
    .replace(/\broasted\b/g, "")
    .replace(/\bsauteed\b/g, "")
    .replace(/\bstir fried\b/g, "")
    .replace(/\bsteamed\b/g, "")
    .replace(/\bsoaked\b/g, "")
    .replace(/\bmarinated\b/g, "")
    .replace(/\bcrumbled\b/g, "")
    .replace(/\bcube\b/g, "")
    .replace(/\bcubed\b/g, "")
    .replace(/\bcubes\b/g, "")
    .replace(/\bdiced\b/g, "")
    .replace(/\bsliced\b/g, "")
    .replace(/\bchopped\b/g, "")
    .replace(/\bminced\b/g, "")
    .replace(/\bmashed\b/g, "")
    .replace(/\bshredded\b/g, "")
    .replace(/\bgrated\b/g, "")
    .replace(/\bhalved\b/g, "")
    .replace(/\bquartered\b/g, "")
    .replace(/\bpieces\b/g, "")
    .replace(/\bpiece\b/g, "")
    .replace(/\bfillet\b/g, "")
    .replace(/\bbreast\b/g, "")
    .replace(/\bthigh\b/g, "")
    .replace(/\bdrumstick\b/g, "")
    .replace(/\brolled\b/g, "")
    .replace(/\bsteel cut\b/g, "")
    .replace(/\bquick\b/g, "")
    .replace(/\bextra virgin\b/g, "")
    .replace(/\bvirgin\b/g, "")
    .replace(/\blow fat\b/g, "")
    .replace(/\bfull fat\b/g, "")
    .replace(/\bnonfat\b/g, "")
    .replace(/\bunsweetened\b/g, "")
    .replace(/\bseedless\b/g, "")
    .replace(/\bwhole wheat roti\b/g, "whole wheat flour")
    .replace(/\bwhole wheat chapati\b/g, "whole wheat flour")
    .replace(/\bwhole wheat flour dough\b/g, "whole wheat flour")
    .replace(/\broti dough\b/g, "whole wheat flour")
    .replace(/\bchapati dough\b/g, "whole wheat flour")
    .replace(/\bparatha dough\b/g, "whole wheat flour")
    .replace(/\bdough\b/g, "")
    .replace(/\broti\b/g, "whole wheat flour")
    .replace(/\bchapati\b/g, "whole wheat flour")
    .replace(/\bparatha\b/g, "whole wheat flour")
    .replace(/\bgreen chili\b/g, "chili")
    .replace(/\bred chili\b/g, "chili")
    .replace(/\bchillies\b/g, "chili")
    .replace(/\bchilies\b/g, "chili")
    .replace(/\bcilantro\b/g, "coriander")
    .replace(/\bcurd\b/g, "yogurt")
    .replace(/\bgarbanzo bean\b/g, "chickpea")
    .replace(/\bgarbanzo\b/g, "chickpea")
    .replace(/\bchole\b/g, "chickpea")
    .replace(/\btoor dal\b/g, "dal")
    .replace(/\bmoong dal\b/g, "dal")
    .replace(/\bmasoor dal\b/g, "dal")
    .replace(/\bchana dal\b/g, "dal")
    .replace(/\bbasmati rice\b/g, "rice")
    .replace(/\bbrown rice\b/g, "rice")
    .replace(/\bwhite rice\b/g, "rice")
    .replace(/\bjasmine rice\b/g, "rice")
    .replace(/\bgreek yogurt\b/g, "yogurt")
    .replace(/\bhung curd\b/g, "yogurt")
    .replace(/\brolled oat\b/g, "oat")
    .replace(/\boatmeal\b/g, "oat")
    .replace(/\boat\b/g, "oats")
    .replace(/\bchicken breast\b/g, "chicken")
    .replace(/\bchicken thigh\b/g, "chicken")
    .replace(/\bchicken drumstick\b/g, "chicken")
    .replace(/\bground chicken\b/g, "chicken")
    .replace(/\bground turkey\b/g, "turkey")
    .replace(/\begg white\b/g, "egg")
    .replace(/\begg yolk\b/g, "egg")
    .replace(/\bscallion\b/g, "spring onion")
    .replace(/\bspring onions\b/g, "spring onion")
    .replace(/\bgreen onion\b/g, "spring onion")
    .replace(/\bgreen onions\b/g, "spring onion")
    .replace(/\bbell pepper\b/g, "capsicum")
    .replace(/\bbell peppers\b/g, "capsicum")
    .replace(/\bwhole wheat flour whole wheat flour\b/g, "whole wheat flour")
    .replace(/\s+/g, " ")
    .trim();
}

function getCanonicalGroceryName(name: string) {
  const normalized = getDedupedGroceryKey(name);
  return titleCaseWords(normalized || formatIngredientLabel(name));
}

function getGroceryCategory(name: string) {
  const normalized = getDedupedGroceryKey(name);

  if (/(apple|banana|orange|mango|papaya|berry|berries|grape|guava|melon|pineapple|pear|pomegranate)/.test(normalized)) {
    return "fruits";
  }

  if (
    /(spinach|palak|onion|tomato|cucumber|carrot|beans|capsicum|pepper|broccoli|cauliflower|cabbage|okra|bhindi|eggplant|brinjal|peas|potato|sweet potato|lettuce|mint|coriander|cilantro|ginger|garlic|chili|lemon|lime)/.test(
      normalized
    )
  ) {
    return "vegetables";
  }

  return "dry_items";
}

export function groupGroceryItems(items: GroceryListItem[]) {
  const grouped = {
    fruits: [] as GroceryListItem[],
    vegetables: [] as GroceryListItem[],
    dry_items: [] as GroceryListItem[]
  };
  const seen = new Set<string>();

  items.forEach((item) => {
    const dedupedKey = getDedupedGroceryKey(item.ingredientName);
    if (seen.has(dedupedKey)) {
      return;
    }

    seen.add(dedupedKey);
    grouped[getGroceryCategory(item.ingredientName)].push({
      ...item,
      ingredientId: dedupedKey,
      ingredientName: getCanonicalGroceryName(item.ingredientName)
    });
  });

  return grouped;
}

export function aggregateWeeklyGroceryList(days: DailyMealPlan[]): GroceryListItem[] {
  const ingredientMap = new Map<string, GroceryListItem>();

  for (const day of days) {
    for (const item of day.groceryList) {
      const itemKey = getGroceryKey(item.ingredientName);
      const existing = ingredientMap.get(itemKey);
      if (existing) {
        existing.totalQuantity = Math.round((existing.totalQuantity + item.totalQuantity) * 10) / 10;
      } else {
        ingredientMap.set(itemKey, {
          ...item,
          ingredientId: itemKey,
          ingredientName: formatIngredientLabel(item.ingredientName)
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
