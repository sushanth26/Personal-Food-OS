import { DailyMealPlan, NutritionProfile } from "./types";

const PROFILE_KEY = "personal-food-os.profile";
const PLAN_KEY = "personal-food-os.plan";

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
