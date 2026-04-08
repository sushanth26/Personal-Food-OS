import { deriveMacroTargets } from "../planner";
import { Exclusion, NutritionProfile } from "../types";

export const exclusionOptions: Exclusion[] = ["dairy", "eggs", "nuts", "gluten"];

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? "http://127.0.0.1:8787" : "")
).replace(/\/$/, "");

export const tabs = [
  { id: "profile", label: "Profile" },
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "family", label: "Family" },
  { id: "reminders", label: "Reminders" },
  { id: "groceries", label: "Groceries" }
] as const;

export type TabId = (typeof tabs)[number]["id"];

export const mealColorClass: Record<string, string> = {
  breakfast: "meal-breakfast",
  lunch: "meal-lunch",
  dinner: "meal-dinner",
  snack: "meal-snack"
};

export const defaultProfile: NutritionProfile = {
  calorieTarget: 2100,
  sex: "male",
  age: 30,
  heightCm: 175,
  weightKg: 75,
  activityLevel: "moderate",
  goal: "maintain",
  cuisinePreference: "indian",
  macroMode: "split",
  macroPreset: "balanced",
  macroTargets: deriveMacroTargets(2100, "split", "balanced"),
  dietaryPattern: "omnivore",
  exclusions: [],
  mealsPerDay: 3,
  prepPreference: "low",
  allowRepeats: true
};
