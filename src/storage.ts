import { DailyMealPlan, NutritionProfile, WeeklyMealPlan } from "./types";

const PROFILE_KEY = "personal-food-os.profile";
const PLAN_KEY = "personal-food-os.plan";
const WEEK_PLAN_KEY = "personal-food-os.week-plan";
const GROCERY_CHECKED_KEY = "personal-food-os.grocery-checked";

function safeParse<T>(raw: string | null): T | null {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadProfile(): NutritionProfile | null {
  return safeParse<NutritionProfile>(window.localStorage.getItem(PROFILE_KEY));
}

export function saveProfile(profile: NutritionProfile): void {
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function loadPlan(): DailyMealPlan | null {
  return safeParse<DailyMealPlan>(window.localStorage.getItem(PLAN_KEY));
}

export function savePlan(plan: DailyMealPlan): void {
  window.localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
}

export function loadWeekPlan(): WeeklyMealPlan | null {
  return safeParse<WeeklyMealPlan>(window.localStorage.getItem(WEEK_PLAN_KEY));
}

export function saveWeekPlan(plan: WeeklyMealPlan): void {
  window.localStorage.setItem(WEEK_PLAN_KEY, JSON.stringify(plan));
}

export function loadCheckedGroceries(): string[] {
  return safeParse<string[]>(window.localStorage.getItem(GROCERY_CHECKED_KEY)) ?? [];
}

export function saveCheckedGroceries(items: string[]): void {
  window.localStorage.setItem(GROCERY_CHECKED_KEY, JSON.stringify(items));
}
