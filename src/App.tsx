import { FormEvent, useEffect, useMemo, useState } from "react";
import { deriveMacroTargets, estimateDailyCalories } from "./planner";
import {
  loadPlan,
  loadProfile,
  loadWeekPlan,
  savePlan,
  saveProfile,
  saveWeekPlan
} from "./storage";
import {
  ActivityLevel,
  BiologicalSex,
  CuisinePreference,
  DailyMealPlan,
  DietaryPattern,
  Exclusion,
  Goal,
  MacroMode,
  MacroPreset,
  NutritionProfile,
  PrepPreference,
  WeeklyMealPlan
} from "./types";
import type { GroceryListItem, RecipeVideo } from "./types";

const exclusionOptions: Exclusion[] = ["dairy", "eggs", "nuts", "gluten"];
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? "http://127.0.0.1:8787" : "")
).replace(/\/$/, "");
const tabs = [
  { id: "profile", label: "Profile" },
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "reminders", label: "Reminders" },
  { id: "groceries", label: "Groceries" }
] as const;

type TabId = (typeof tabs)[number]["id"];

const mealColorClass: Record<string, string> = {
  breakfast: "meal-breakfast",
  lunch: "meal-lunch",
  dinner: "meal-dinner",
  snack: "meal-snack"
};

function formatIngredientLabel(name: string) {
  return name
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\bplain\b/gi, "")
    .replace(/\bcooked\b/gi, "")
    .replace(/\bdry\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getMealPortionSummary(
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

function formatContext(context: string) {
  return context.replaceAll("_", " ");
}

function formatDisplayDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(new Date(`${value}T12:00:00Z`));
}

function getWeekStartDate() {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  today.setDate(today.getDate() + diff);
  return today.toISOString().slice(0, 10);
}

function aggregateWeeklyGroceryList(days: DailyMealPlan[]): GroceryListItem[] {
  const ingredientMap = new Map<string, GroceryListItem>();

  for (const day of days) {
    for (const item of day.groceryList) {
      const existing = ingredientMap.get(item.ingredientId);
      if (existing) {
        existing.totalQuantity = Math.round((existing.totalQuantity + item.totalQuantity) * 10) / 10;
      } else {
        ingredientMap.set(item.ingredientId, { ...item });
      }
    }
  }

  return [...ingredientMap.values()].sort((a, b) => a.ingredientName.localeCompare(b.ingredientName));
}

function buildWeeklyPlanFromDays(startDate: string, days: DailyMealPlan[]): WeeklyMealPlan {
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

const defaultProfile: NutritionProfile = {
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

function App() {
  const [profile, setProfile] = useState<NutritionProfile>(defaultProfile);
  const [saved, setSaved] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [weekError, setWeekError] = useState<string | null>(null);
  const [plan, setPlan] = useState<DailyMealPlan | null>(() => loadPlan());
  const [weekPlan, setWeekPlan] = useState<WeeklyMealPlan | null>(() => loadWeekPlan());
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingWeek, setIsGeneratingWeek] = useState(false);
  const [mealVideos, setMealVideos] = useState<Record<string, RecipeVideo | null>>({});

  useEffect(() => {
    const storedProfile = loadProfile();
    if (!storedProfile) {
      return;
    }

    setProfile(storedProfile);
    setSaved(true);
  }, []);

  const estimatedCalories = useMemo(
    () =>
      estimateDailyCalories({
        sex: profile.sex,
        age: profile.age,
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        activityLevel: profile.activityLevel,
        goal: profile.goal
      }),
    [profile.sex, profile.age, profile.heightCm, profile.weightKg, profile.activityLevel, profile.goal]
  );

  const displayedTargets =
    profile.macroMode === "split"
      ? deriveMacroTargets(profile.calorieTarget, "split", profile.macroPreset)
      : profile.macroTargets;

  useEffect(() => {
    const mealsToLoad = [
      ...(plan?.meals ?? []),
      ...(weekPlan?.days.flatMap((day) => day.meals) ?? [])
    ];

    if (!mealsToLoad.length) {
      setMealVideos({});
      return;
    }

    const uniqueMeals = mealsToLoad.filter(
      (meal, index, collection) => collection.findIndex((entry) => entry.id === meal.id) === index
    );

    let cancelled = false;

    async function loadVideos() {
      const entries = await Promise.all(
        uniqueMeals.map(async (meal) => {
          try {
            const response = await fetch(
              `${API_BASE_URL}/api/recipe-video?q=${encodeURIComponent(`${meal.name} ${profile.cuisinePreference}`)}`
            );
            const raw = await response.text();
            const payload = raw ? (JSON.parse(raw) as { video?: RecipeVideo }) : {};
            return [meal.id, payload.video ?? null] as const;
          } catch {
            return [meal.id, null] as const;
          }
        })
      );

      if (!cancelled) {
        setMealVideos(Object.fromEntries(entries));
      }
    }

    loadVideos();

    return () => {
      cancelled = true;
    };
  }, [plan, weekPlan, profile.cuisinePreference]);

  function syncCalculatedCalories() {
    setProfile((current) => ({
      ...current,
      calorieTarget: estimatedCalories
    }));
  }

  function updateDerivedTargets(next: NutritionProfile): NutritionProfile {
    if (next.macroMode === "split") {
      return {
        ...next,
        macroTargets: deriveMacroTargets(next.calorieTarget, "split", next.macroPreset)
      };
    }

    return next;
  }

  async function requestMealPlan(nextProfile: NutritionProfile) {
    setIsGenerating(true);
    setPlanError(null);
    setActiveTab("day");

    try {
      const response = await fetch(`${API_BASE_URL}/api/meal-plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          profile: nextProfile,
          date: new Date().toISOString().slice(0, 10)
        })
      });

      const raw = await response.text();
      const payload = raw ? (JSON.parse(raw) as { plan?: DailyMealPlan; error?: string }) : {};
      if (!response.ok || !payload.plan) {
        throw new Error(payload.error ?? "Unable to generate an AI plan right now.");
      }

      setPlan(payload.plan);
      savePlan(payload.plan);
      setPlanError(null);
      setMealVideos({});
    } catch (error) {
      setPlan(null);
      setPlanError(error instanceof Error ? error.message : "Unable to generate an AI plan right now.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function requestWeekPlan(nextProfile: NutritionProfile) {
    setIsGeneratingWeek(true);
    setWeekError(null);
    setActiveTab("week");

    try {
      const startDate = getWeekStartDate();
      const response = await fetch(`${API_BASE_URL}/api/weekly-meal-plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          profile: nextProfile,
          startDate
        })
      });

      const raw = await response.text();
      const payload = raw ? (JSON.parse(raw) as { weekPlan?: WeeklyMealPlan; error?: string }) : {};
      if (!response.ok || !payload.weekPlan) {
        throw new Error(payload.error ?? "Unable to generate a weekly AI plan right now.");
      }

      setWeekPlan(payload.weekPlan);
      saveWeekPlan(payload.weekPlan);
      setWeekError(null);
    } catch (error) {
      setWeekPlan(null);
      setWeekError(error instanceof Error ? error.message : "Unable to generate a weekly AI plan right now.");
    } finally {
      setIsGeneratingWeek(false);
    }
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextProfile = updateDerivedTargets(profile);
    saveProfile(nextProfile);
    setProfile(nextProfile);
    setSaved(true);
    setEditingProfile(false);

    await requestMealPlan(nextProfile);
  }

  async function regeneratePlan() {
    await requestMealPlan(updateDerivedTargets(profile));
  }

  async function regenerateWeekPlan() {
    await requestWeekPlan(updateDerivedTargets(profile));
  }

  async function regenerateWeekDay(date: string) {
    if (!weekPlan) {
      return;
    }

    setIsGeneratingWeek(true);
    setWeekError(null);
    setActiveTab("week");

    try {
      const response = await fetch(`${API_BASE_URL}/api/meal-plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          profile: updateDerivedTargets(profile),
          date
        })
      });

      const raw = await response.text();
      const payload = raw ? (JSON.parse(raw) as { plan?: DailyMealPlan; error?: string }) : {};
      if (!response.ok || !payload.plan) {
        throw new Error(payload.error ?? "Unable to refresh this day right now.");
      }

      const updatedDays = weekPlan.days.map((day) => (day.date === date ? payload.plan! : day));
      const nextWeekPlan = buildWeeklyPlanFromDays(weekPlan.startDate, updatedDays);
      setWeekPlan(nextWeekPlan);
      saveWeekPlan(nextWeekPlan);
    } catch (error) {
      setWeekError(error instanceof Error ? error.message : "Unable to refresh this day right now.");
    } finally {
      setIsGeneratingWeek(false);
    }
  }

  return (
    <div className="app-shell">
      <main className="dashboard">
        <nav className="tabs" aria-label="Primary sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? "tab-button active" : "tab-button"}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <section className={activeTab === "profile" ? "panel panel-form active-panel" : "panel panel-form hidden-panel"}>
          <div className="panel-heading">
            <div>
              <p className="section-kicker">{saved ? "Nutrition profile" : "Onboarding"}</p>
              <h2>{saved && !editingProfile ? "Your current setup" : "Build your nutrition baseline"}</h2>
            </div>
            {saved && !editingProfile ? (
              <button className="ghost-button" onClick={() => setEditingProfile(true)}>
                Edit profile
              </button>
            ) : null}
          </div>

          {!saved || editingProfile ? (
            <form className="profile-form" onSubmit={handleProfileSubmit}>
              <div className="section-block">
                <p className="subheading">Calorie target helper</p>
                <p className="helper-copy">
                  Most people do not know their calorie number. These answers let the app estimate a better starting point.
                </p>
                <div className="macro-grid">
                  <label>
                    Sex
                    <select
                      value={profile.sex}
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          sex: event.target.value as BiologicalSex
                        }))
                      }
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </label>
                  <label>
                    Age
                    <input
                      type="number"
                      min={18}
                      max={90}
                      value={profile.age}
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          age: Number(event.target.value || current.age)
                        }))
                      }
                    />
                  </label>
                  <label>
                    Height (cm)
                    <input
                      type="number"
                      min={120}
                      max={230}
                      value={profile.heightCm}
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          heightCm: Number(event.target.value || current.heightCm)
                        }))
                      }
                    />
                  </label>
                  <label>
                    Weight (kg)
                    <input
                      type="number"
                      min={35}
                      max={250}
                      step="0.1"
                      value={profile.weightKg}
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          weightKg: Number(event.target.value || current.weightKg)
                        }))
                      }
                    />
                  </label>
                  <label>
                    Activity
                    <select
                      value={profile.activityLevel}
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          activityLevel: event.target.value as ActivityLevel
                        }))
                      }
                    >
                      <option value="sedentary">Mostly seated</option>
                      <option value="light">Lightly active</option>
                      <option value="moderate">Moderately active</option>
                      <option value="active">Very active</option>
                    </select>
                  </label>
                  <label>
                    Goal
                    <select
                      value={profile.goal}
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          goal: event.target.value as Goal
                        }))
                      }
                    >
                      <option value="lose">Lose fat</option>
                      <option value="maintain">Maintain</option>
                      <option value="gain">Gain muscle</option>
                    </select>
                  </label>
                </div>
                <div className="calculator-card">
                  <div>
                    <span>Recommended starting target</span>
                    <strong>{estimatedCalories} kcal/day</strong>
                  </div>
                  <button className="ghost-button" type="button" onClick={syncCalculatedCalories}>
                    Use this target
                  </button>
                </div>
              </div>

              <div className="section-block">
                <p className="subheading">Nutrition target</p>
                <label>
                  Daily calorie target
                  <input
                    type="number"
                    min={1200}
                    max={5000}
                    value={profile.calorieTarget}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        calorieTarget: Number(event.target.value || current.calorieTarget)
                      }))
                    }
                  />
                </label>

                <label>
                  Macro mode
                  <select
                    value={profile.macroMode}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        macroMode: event.target.value as MacroMode
                      }))
                    }
                  >
                    <option value="split">Preset split</option>
                    <option value="explicit">Explicit grams</option>
                  </select>
                </label>

                {profile.macroMode === "split" ? (
                  <label>
                    Macro style
                    <select
                      value={profile.macroPreset}
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          macroPreset: event.target.value as MacroPreset
                        }))
                      }
                    >
                      <option value="balanced">Balanced</option>
                      <option value="high_protein">High protein</option>
                      <option value="lower_carb">Lower carb</option>
                    </select>
                  </label>
                ) : (
                  <div className="macro-grid">
                    <label>
                      Protein (g)
                      <input
                        type="number"
                        min={0}
                        value={profile.macroTargets.protein}
                        onChange={(event) =>
                          setProfile((current) => ({
                            ...current,
                            macroTargets: {
                              ...current.macroTargets,
                              protein: Number(event.target.value || 0)
                            }
                          }))
                        }
                      />
                    </label>
                    <label>
                      Carbs (g)
                      <input
                        type="number"
                        min={0}
                        value={profile.macroTargets.carbs}
                        onChange={(event) =>
                          setProfile((current) => ({
                            ...current,
                            macroTargets: {
                              ...current.macroTargets,
                              carbs: Number(event.target.value || 0)
                            }
                          }))
                        }
                      />
                    </label>
                    <label>
                      Fat (g)
                      <input
                        type="number"
                        min={0}
                        value={profile.macroTargets.fat}
                        onChange={(event) =>
                          setProfile((current) => ({
                            ...current,
                            macroTargets: {
                              ...current.macroTargets,
                              fat: Number(event.target.value || 0)
                            }
                          }))
                        }
                      />
                    </label>
                  </div>
                )}
              </div>

              <div className="section-block">
                <p className="subheading">Planning preferences</p>
                <label>
                  Dietary pattern
                  <select
                    value={profile.dietaryPattern}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        dietaryPattern: event.target.value as DietaryPattern
                      }))
                    }
                  >
                    <option value="omnivore">Omnivore</option>
                    <option value="vegetarian">Vegetarian</option>
                    <option value="vegan">Vegan</option>
                  </select>
                </label>

                <div>
                  <span className="field-label">Exclusions</span>
                  <div className="checkbox-grid">
                    {exclusionOptions.map((option) => (
                      <label key={option} className="check-pill">
                        <input
                          type="checkbox"
                          checked={profile.exclusions.includes(option)}
                          onChange={(event) =>
                            setProfile((current) => ({
                              ...current,
                              exclusions: event.target.checked
                                ? [...current.exclusions, option]
                                : current.exclusions.filter((entry) => entry !== option)
                            }))
                          }
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="split-fields">
                  <label>
                    Cuisine
                    <select
                      value={profile.cuisinePreference}
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          cuisinePreference: event.target.value as CuisinePreference
                        }))
                      }
                    >
                      <option value="indian">Indian</option>
                      <option value="mediterranean">Mediterranean</option>
                      <option value="american">American</option>
                      <option value="east_asian">East Asian</option>
                    </select>
                  </label>

                  <label>
                    Meals per day
                    <select
                      value={profile.mealsPerDay}
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          mealsPerDay: Number(event.target.value) as 3 | 4
                        }))
                      }
                    >
                      <option value={3}>3 meals</option>
                      <option value={4}>3 meals + snack</option>
                    </select>
                  </label>

                  <label>
                    Prep preference
                    <select
                      value={profile.prepPreference}
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          prepPreference: event.target.value as PrepPreference
                        }))
                      }
                    >
                      <option value="low">Low effort</option>
                      <option value="medium">Medium effort</option>
                      <option value="high">High effort</option>
                    </select>
                  </label>
                </div>

                <label className="check-pill repeat-toggle">
                  <input
                    type="checkbox"
                    checked={profile.allowRepeats}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        allowRepeats: event.target.checked
                      }))
                    }
                  />
                  Repeat meals / leftovers are okay
                </label>
                <p className="helper-copy">
                  Turn this on if you batch-cook and are happy to repeat a dinner the next day or reuse breakfast items.
                </p>
              </div>

              <div className="macro-preview">
                <span>Target preview</span>
                <strong>
                  {displayedTargets.protein}g protein / {displayedTargets.carbs}g carbs / {displayedTargets.fat}g fat
                </strong>
              </div>

              <button className="primary-button" type="submit" disabled={isGenerating}>
                {isGenerating
                  ? "Generating AI plan..."
                  : saved
                    ? "Save profile and regenerate"
                    : "Save profile and build my day"}
              </button>
            </form>
          ) : (
            <div className="profile-summary">
              <div className="stat-row">
                <span>Calories</span>
                <strong>{profile.calorieTarget}</strong>
              </div>
              <div className="stat-row">
                <span>Estimated from</span>
                <strong>
                  {profile.age}y • {profile.heightCm}cm • {profile.weightKg}kg
                </strong>
              </div>
              <div className="stat-row">
                <span>Activity + goal</span>
                <strong>
                  {profile.activityLevel} • {profile.goal}
                </strong>
              </div>
              <div className="stat-row">
                <span>Macros</span>
                <strong>
                  {profile.macroTargets.protein}P / {profile.macroTargets.carbs}C / {profile.macroTargets.fat}F
                </strong>
              </div>
              <div className="stat-row">
                <span>Diet</span>
                <strong>{profile.dietaryPattern}</strong>
              </div>
              <div className="stat-row">
                <span>Cuisine</span>
                <strong>{profile.cuisinePreference.replace("_", " ")}</strong>
              </div>
              <div className="stat-row">
                <span>Meals</span>
                <strong>{profile.mealsPerDay}</strong>
              </div>
              <div className="stat-row">
                <span>Prep style</span>
                <strong>{profile.prepPreference}</strong>
              </div>
              <div className="stat-row">
                <span>Repeats</span>
                <strong>{profile.allowRepeats ? "allowed" : "prefer variety"}</strong>
              </div>
              <div className="stat-row">
                <span>Exclusions</span>
                <strong>{profile.exclusions.length ? profile.exclusions.join(", ") : "none"}</strong>
              </div>
              <div className="action-stack">
                <button className="primary-button" onClick={regeneratePlan} disabled={isGenerating}>
                  {isGenerating ? "Generating AI plan..." : "Regenerate day plan"}
                </button>
                <button className="ghost-button" onClick={regenerateWeekPlan} disabled={isGeneratingWeek}>
                  {isGeneratingWeek ? "Generating weekly plan..." : "Build 7-day plan"}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className={activeTab === "day" ? "panel panel-plan active-panel" : "panel panel-plan hidden-panel"}>
          <div className="panel-heading">
            <div>
              <p className="section-kicker">1-day plan</p>
              <h2>Your nutrition day</h2>
            </div>
            {plan ? <span className="date-chip">{plan.date}</span> : null}
          </div>

          {planError ? <div className="empty-state error-state">{planError}</div> : null}

          {isGenerating ? (
            <div className="empty-state">
              Building an AI-assisted plan that fits your calories, macros, cuisine, diet, and prep style.
            </div>
          ) : null}

          {!plan && !planError && !isGenerating ? (
            <div className="empty-state">
              Save your profile to generate an AI-assisted day plan with gram-based portions, reminders, and groceries.
            </div>
          ) : null}

          {plan && !isGenerating ? (
            <>
              <div className="totals-grid">
                <div className="metric-card">
                  <span>Calories</span>
                  <strong>{plan.totals.calories}</strong>
                </div>
                <div className="metric-card">
                  <span>Protein</span>
                  <strong>{plan.totals.protein}g</strong>
                </div>
                <div className="metric-card">
                  <span>Carbs</span>
                  <strong>{plan.totals.carbs}g</strong>
                </div>
                <div className="metric-card">
                  <span>Fat</span>
                  <strong>{plan.totals.fat}g</strong>
                </div>
              </div>

              <p className="planner-note">{plan.note}</p>

              <div className="meal-list">
                {plan.meals.map((meal) => (
                  <details key={meal.id} className={`meal-card ${mealColorClass[meal.mealType]}`} open={meal.mealType === "breakfast"}>
                    <summary className="meal-summary">
                      <div className="meal-summary-copy">
                        <p className="meal-type">{meal.mealType}</p>
                        <h3>{meal.name}</h3>
                        <p>{meal.description}</p>
                      </div>
                      <div className="macro-badge">
                        <span>{meal.totalCalories} kcal</span>
                        <strong>
                          {meal.totalProtein}P / {meal.totalCarbs}C / {meal.totalFat}F
                        </strong>
                      </div>
                    </summary>

                    <div className="meal-details">
                      {(() => {
                        const portionSummary = getMealPortionSummary(meal.ingredients);

                        return (
                          <div className="portion-box">
                            <span>How much to eat</span>
                            <strong>About {portionSummary.totalQuantity}g total</strong>
                            <p className="portion-copy">
                              {portionSummary.mainIngredients.length
                                ? portionSummary.mainIngredients
                                    .map(
                                      (ingredient) =>
                                        `${Math.round(ingredient.quantity)}g ${ingredient.shortName}`
                                    )
                                    .join(" + ")
                                : "Use the ingredient breakdown below for the full portion."}
                            </p>
                          </div>
                        );
                      })()}

                      <div className="video-card">
                        <span>Top recipe video</span>
                        {mealVideos[meal.id] ? (
                          <a
                            className="video-link"
                            href={mealVideos[meal.id]!.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {mealVideos[meal.id]!.thumbnailUrl ? (
                              <img
                                className="video-thumb"
                                src={mealVideos[meal.id]!.thumbnailUrl}
                                alt={mealVideos[meal.id]!.title}
                              />
                            ) : null}
                            <div className="video-copy">
                              <strong>{mealVideos[meal.id]!.title}</strong>
                              <p>
                                {mealVideos[meal.id]!.channelName}
                                {mealVideos[meal.id]!.duration ? ` • ${mealVideos[meal.id]!.duration}` : ""}
                              </p>
                            </div>
                          </a>
                        ) : (
                          <p className="portion-copy">Finding the best recipe video for this meal...</p>
                        )}
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </>
          ) : null}
        </section>

        <section className={activeTab === "week" ? "panel panel-week active-panel" : "panel panel-week hidden-panel"}>
          <div className="panel-heading">
            <div>
              <p className="section-kicker">7-day plan</p>
              <h2>Your weekly structure</h2>
            </div>
            <button className="ghost-button" onClick={regenerateWeekPlan} disabled={isGeneratingWeek}>
              {isGeneratingWeek ? "Building week..." : "Regenerate week"}
            </button>
          </div>

          {weekError ? <div className="empty-state error-state">{weekError}</div> : null}

          {isGeneratingWeek ? (
            <div className="empty-state">
              Building your 7-day plan. Weekly plans take longer because the app generates each day with variety in mind.
            </div>
          ) : null}

          {!weekPlan && !weekError && !isGeneratingWeek ? (
            <div className="empty-state">
              Build a weekly plan to see 7 days of meals, one combined grocery list, and lighter repetition across the week.
            </div>
          ) : null}

          {weekPlan && !isGeneratingWeek ? (
            <>
              <p className="planner-note">{weekPlan.note}</p>

              <div className="week-list">
                {weekPlan.days.map((day) => (
                  <details key={day.date} className="week-day-card" open={day.date === weekPlan.startDate}>
                    <summary className="week-day-summary">
                      <div>
                        <p className="section-kicker">Day</p>
                        <h3>{formatDisplayDate(day.date)}</h3>
                        <p className="portion-copy">
                          {day.meals.map((meal) => meal.name).join(" • ")}
                        </p>
                      </div>
                      <div className="week-day-meta">
                        <strong>{day.totals.calories} kcal</strong>
                        <span>
                          {day.totals.protein}P / {day.totals.carbs}C / {day.totals.fat}F
                        </span>
                      </div>
                    </summary>

                    <div className="week-day-actions">
                      <button className="ghost-button" onClick={() => regenerateWeekDay(day.date)} disabled={isGeneratingWeek}>
                        Refresh this day
                      </button>
                    </div>

                    <div className="week-meal-grid">
                      {day.meals.map((meal) => {
                        const portionSummary = getMealPortionSummary(meal.ingredients);
                        return (
                          <article key={meal.id} className={`mini-meal-card ${mealColorClass[meal.mealType]}`}>
                            <p className="meal-type">{meal.mealType}</p>
                            <h4>{meal.name}</h4>
                            <p className="portion-copy">About {portionSummary.totalQuantity}g total</p>
                            <p className="portion-copy">
                              {portionSummary.mainIngredients.length
                                ? portionSummary.mainIngredients
                                    .map((ingredient) => `${Math.round(ingredient.quantity)}g ${ingredient.shortName}`)
                                    .join(" + ")
                                : `${meal.totalCalories} kcal`}
                            </p>
                            <div className="video-card mini-video-card">
                              <span>Top recipe video</span>
                              {mealVideos[meal.id] ? (
                                <a
                                  className="video-link"
                                  href={mealVideos[meal.id]!.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {mealVideos[meal.id]!.thumbnailUrl ? (
                                    <img
                                      className="video-thumb"
                                      src={mealVideos[meal.id]!.thumbnailUrl}
                                      alt={mealVideos[meal.id]!.title}
                                    />
                                  ) : null}
                                  <div className="video-copy">
                                    <strong>{mealVideos[meal.id]!.title}</strong>
                                    <p>
                                      {mealVideos[meal.id]!.channelName}
                                      {mealVideos[meal.id]!.duration ? ` • ${mealVideos[meal.id]!.duration}` : ""}
                                    </p>
                                  </div>
                                </a>
                              ) : (
                                <p className="portion-copy">Finding the best recipe video for this meal...</p>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </details>
                ))}
              </div>

              <div className="section-block weekly-grocery-block">
                <p className="subheading">Weekly groceries</p>
                <ul className="grocery-list weekly-grocery-list">
                  {weekPlan.groceryList.map((item) => (
                    <li key={item.ingredientId}>
                      <span>{item.ingredientName}</span>
                      <strong>{item.totalQuantity}g</strong>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : null}
        </section>

        <section className={activeTab === "reminders" ? "panel active-panel" : "panel hidden-panel"}>
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Reminder flow</p>
              <h2>Prep and soak timing</h2>
            </div>
          </div>

          {plan?.reminders.length ? (
            <div className="reminder-list">
              {plan.reminders.map((reminder) => (
                <article key={reminder.id} className={`reminder-card ${reminder.type}`}>
                  <span className="reminder-tag">{reminder.type}</span>
                  <h3>{reminder.title}</h3>
                  <p>
                    {formatContext(reminder.context)} for {reminder.linkedMealName}
                    {reminder.linkedIngredientName ? ` • ${reminder.linkedIngredientName}` : ""}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">Reminders will appear here once a day plan is generated.</div>
          )}
        </section>

        <section className={activeTab === "groceries" ? "panel active-panel" : "panel hidden-panel"}>
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Shopping</p>
              <h2>Grocery list</h2>
            </div>
          </div>

          {plan?.groceryList.length ? (
            <ul className="grocery-list">
              {plan.groceryList.map((item) => (
                <li key={item.ingredientId}>
                  <span>{item.ingredientName}</span>
                  <strong>{item.totalQuantity}g</strong>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">Your daily grocery list will be built from the generated day.</div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
