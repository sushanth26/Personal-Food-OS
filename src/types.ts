export type PrepPreference = "low" | "medium" | "high";
export type DietaryPattern = "omnivore" | "vegetarian" | "vegan";
export type MacroMode = "split" | "explicit";
export type MacroPreset = "balanced" | "high_protein" | "lower_carb";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type ReminderType = "prep" | "soak";
export type ReminderContext = "night_before" | "morning_of" | "after_dinner";
export type Exclusion = "dairy" | "eggs" | "nuts" | "gluten";
export type BiologicalSex = "female" | "male";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active";
export type Goal = "lose" | "maintain" | "gain";
export type CuisinePreference = "indian" | "mediterranean" | "american" | "east_asian";

export interface MacroTargets {
  protein: number;
  carbs: number;
  fat: number;
}

export interface NutritionProfile {
  calorieTarget: number;
  sex: BiologicalSex;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  cuisinePreference: CuisinePreference;
  macroMode: MacroMode;
  macroPreset: MacroPreset;
  macroTargets: MacroTargets;
  dietaryPattern: DietaryPattern;
  exclusions: Exclusion[];
  mealsPerDay: 3 | 4;
  prepPreference: PrepPreference;
  allowRepeats: boolean;
}

export interface IngredientDefinition {
  id: string;
  name: string;
  unit: "g";
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  dietaryFlags: Exclusion[];
  allowedPatterns: DietaryPattern[];
  soakRequired?: boolean;
}

export interface TemplateIngredient {
  ingredientId: string;
  quantity: number;
  prepNote?: string;
}

export interface ReminderTemplate {
  type: ReminderType;
  title: string;
  context: ReminderContext;
  ingredientId?: string;
}

export interface MealTemplate {
  id: string;
  name: string;
  mealType: MealType;
  description: string;
  ingredients: TemplateIngredient[];
  tags: string[];
  allowedPatterns: DietaryPattern[];
  blockedExclusions: Exclusion[];
  prepComplexity: PrepPreference;
  reminderTemplates?: ReminderTemplate[];
}

export interface MealIngredientPortion extends TemplateIngredient {
  ingredientName: string;
  unit: string;
  estimatedCalories: number;
  estimatedProtein: number;
  estimatedCarbs: number;
  estimatedFat: number;
}

export interface PlannedMeal {
  id: string;
  name: string;
  mealType: MealType;
  description: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  scaleFactor: number;
  ingredients: MealIngredientPortion[];
}

export interface Reminder {
  id: string;
  type: ReminderType;
  title: string;
  context: ReminderContext;
  linkedMealId: string;
  linkedMealName: string;
  linkedIngredientId?: string;
  linkedIngredientName?: string;
}

export interface GroceryListItem {
  ingredientId: string;
  ingredientName: string;
  totalQuantity: number;
  unit: string;
}

export interface DailyMealPlan {
  date: string;
  meals: PlannedMeal[];
  totals: MacroTargets & { calories: number };
  reminders: Reminder[];
  groceryList: GroceryListItem[];
  note?: string;
}

export interface WeeklyMealPlan {
  startDate: string;
  days: DailyMealPlan[];
  totals: MacroTargets & { calories: number };
  groceryList: GroceryListItem[];
  note?: string;
}

export interface RecipeVideo {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  channelName: string;
  duration?: string;
}

export interface PlannerResult {
  plan: DailyMealPlan | null;
  error?: string;
}
