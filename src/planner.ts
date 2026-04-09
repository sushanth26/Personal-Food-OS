import { ActivityLevel, Goal, MacroPreset, MacroTargets, NutritionProfile } from "./types";

const CALORIES_PER_GRAM = {
  protein: 4,
  carbs: 4,
  fat: 9
};

const MACRO_PRESETS: Record<MacroPreset, { protein: number; carbs: number; fat: number }> = {
  balanced: { protein: 0.3, carbs: 0.4, fat: 0.3 },
  high_protein: { protein: 0.35, carbs: 0.35, fat: 0.3 },
  lower_carb: { protein: 0.35, carbs: 0.25, fat: 0.4 }
};

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725
};

const GOAL_ADJUSTMENTS: Record<Goal, number> = {
  lose: -350,
  maintain: 0,
  gain: 250
};

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export function calculateBmi(heightCm: number, weightKg: number): number {
  const heightM = heightCm / 100;
  if (!heightM || !weightKg) {
    return 0;
  }

  return round(weightKg / (heightM * heightM));
}

export function kgToLb(weightKg: number): number {
  return round(weightKg * 2.20462);
}

export function lbToKg(weightLb: number): number {
  return round(weightLb / 2.20462);
}

export function cmToFeetInches(heightCm: number): { feet: number; inches: number } {
  const totalInches = heightCm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = round(totalInches - feet * 12);
  return { feet, inches };
}

export function feetInchesToCm(feet: number, inches: number): number {
  return Math.round((feet * 12 + inches) * 2.54 * 10) / 10;
}

export function estimateDailyCalories(
  profile: Pick<
    NutritionProfile,
    "sex" | "age" | "heightCm" | "weightKg" | "activityLevel" | "goal"
  >
): number {
  const baseBmr =
    10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age + (profile.sex === "male" ? 5 : -161);
  const maintenanceCalories = baseBmr * ACTIVITY_MULTIPLIERS[profile.activityLevel];
  return Math.max(1200, Math.round(maintenanceCalories + GOAL_ADJUSTMENTS[profile.goal]));
}

export function deriveMacroTargets(
  calorieTarget: number,
  macroMode: "split" | "explicit",
  macroPreset: MacroPreset,
  explicitTargets?: Partial<MacroTargets>
): MacroTargets {
  if (macroMode === "explicit") {
    return {
      protein: explicitTargets?.protein ?? 0,
      carbs: explicitTargets?.carbs ?? 0,
      fat: explicitTargets?.fat ?? 0
    };
  }

  const preset = MACRO_PRESETS[macroPreset];

  return {
    protein: round((calorieTarget * preset.protein) / CALORIES_PER_GRAM.protein),
    carbs: round((calorieTarget * preset.carbs) / CALORIES_PER_GRAM.carbs),
    fat: round((calorieTarget * preset.fat) / CALORIES_PER_GRAM.fat)
  };
}
