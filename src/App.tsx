import { useEffect, useMemo, useState } from "react";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import AuthScreen from "./AuthScreen";
import { loadCloudFoodState, saveCloudFoodState } from "./cloudState";
import AppStage from "./components/AppStage";
import DayPanel from "./components/DayPanel";
import GroceriesPanel from "./components/GroceriesPanel";
import ProfilePanel from "./components/ProfilePanel";
import RemindersPanel from "./components/RemindersPanel";
import TabsNav from "./components/TabsNav";
import WeekPanel from "./components/WeekPanel";
import { auth, isFirebaseConfigured, logAnalyticsEvent, setAnalyticsUser } from "./firebase";
import { API_BASE_URL, defaultProfile, exclusionOptions, TabId } from "./lib/appConfig";
import {
  buildWeeklyPlanFromDays,
  getDisplayedReminders,
  getTodayDate,
  getWeekStartDate,
  groupGroceryItems,
  groupRemindersBySoakDate
} from "./lib/foodUtils";
import { deriveMacroTargets, estimateDailyCalories } from "./planner";
import {
  clearStoredAppState,
  loadCheckedGroceries,
  loadPlan,
  loadWeekPlan,
  saveCheckedGroceries,
  savePlan,
  saveProfile,
  saveWeekPlan
} from "./storage";
import { DailyMealPlan, NutritionProfile, RecipeVideo, WeeklyMealPlan } from "./types";

function hasLegacyGroceryItems(items: DailyMealPlan["groceryList"]) {
  return items.some((item) => !item.category || !item.canonicalName);
}

function App() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [profile, setProfile] = useState<NutritionProfile>(defaultProfile);
  const [calorieInput, setCalorieInput] = useState(String(defaultProfile.calorieTarget));
  const [ageInput, setAgeInput] = useState(String(defaultProfile.age));
  const [heightInput, setHeightInput] = useState(String(defaultProfile.heightCm));
  const [weightInput, setWeightInput] = useState(String(defaultProfile.weightKg));
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
  const [checkedGroceries, setCheckedGroceries] = useState<string[]>(() => loadCheckedGroceries());

  useEffect(() => {
    if (!auth) {
      setAuthReady(true);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setAuthUser(nextUser);
      void setAnalyticsUser(nextUser?.uid ?? null);

      if (!nextUser) {
        setProfile(defaultProfile);
        setCalorieInput(String(defaultProfile.calorieTarget));
        setAgeInput(String(defaultProfile.age));
        setHeightInput(String(defaultProfile.heightCm));
        setWeightInput(String(defaultProfile.weightKg));
        setSaved(false);
        setEditingProfile(false);
        setPlan(null);
        setWeekPlan(null);
        setCheckedGroceries([]);
        setMealVideos({});
        setActiveTab("profile");
        setAuthReady(true);
        void logAnalyticsEvent("logged_out");
        return;
      }

      setCloudLoading(true);

      try {
        const cloudState = await loadCloudFoodState(nextUser.uid);

        const nextProfile = cloudState.profile ?? defaultProfile;
        const nextPlan = cloudState.plan;
        const nextWeekPlan = cloudState.weekPlan;

        setProfile(nextProfile);
        setCalorieInput(String(nextProfile.calorieTarget));
        setAgeInput(String(nextProfile.age));
        setHeightInput(String(nextProfile.heightCm));
        setWeightInput(String(nextProfile.weightKg));
        setPlan(nextPlan);
        setWeekPlan(nextWeekPlan);
        setCheckedGroceries([]);
        setMealVideos({});
        setSaved(Boolean(cloudState.profile));

        saveProfile(nextProfile);
        if (nextPlan) {
          savePlan(nextPlan);
        }
        if (nextWeekPlan) {
          saveWeekPlan(nextWeekPlan);
        }
        if (!nextPlan) {
          window.localStorage.removeItem("personal-food-os.plan");
        }
        if (!nextWeekPlan) {
          window.localStorage.removeItem("personal-food-os.week-plan");
        }
        void logAnalyticsEvent("login_restored", {
          has_profile: Boolean(cloudState.profile),
          has_day_plan: Boolean(nextPlan),
          has_week_plan: Boolean(nextWeekPlan)
        });
      } catch (error) {
        console.error("cloud-state load error", error);
      } finally {
        setCloudLoading(false);
        setAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    saveCheckedGroceries(checkedGroceries);
  }, [checkedGroceries]);

  useEffect(() => {
    void logAnalyticsEvent("tab_view", {
      tab_id: activeTab,
      signed_in: Boolean(authUser)
    });
  }, [activeTab, authUser]);

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

  const todayDate = getTodayDate();
  const activeDayPlan = weekPlan?.days.find((day) => day.date === todayDate) ?? plan;
  const groupedReminders = groupRemindersBySoakDate(getDisplayedReminders(plan, weekPlan));
  const displayedGroceries = weekPlan?.groceryList ?? activeDayPlan?.groceryList ?? [];
  const groupedGroceries = groupGroceryItems(displayedGroceries);

  useEffect(() => {
    if (!displayedGroceries.length || !hasLegacyGroceryItems(displayedGroceries)) {
      return;
    }

    let cancelled = false;

    async function normalizeLegacyGroceries() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/normalize-groceries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: displayedGroceries,
            cuisinePreference: profile.cuisinePreference
          })
        });

        const raw = await response.text();
        const payload = raw ? (JSON.parse(raw) as { items?: DailyMealPlan["groceryList"] }) : {};
        if (!response.ok || !payload.items || cancelled) {
          return;
        }

        if (weekPlan?.groceryList === displayedGroceries) {
          const nextWeekPlan = { ...weekPlan, groceryList: payload.items };
          setWeekPlan(nextWeekPlan);
          saveWeekPlan(nextWeekPlan);
          void safeSaveCloudState({ weekPlan: nextWeekPlan });
        } else if (activeDayPlan?.groceryList === displayedGroceries && activeDayPlan) {
          const nextPlan = { ...activeDayPlan, groceryList: payload.items };
          setPlan(nextPlan);
          savePlan(nextPlan);
          void safeSaveCloudState({ plan: nextPlan });
        }
      } catch (error) {
        console.error("legacy grocery normalization error", error);
      }
    }

    void normalizeLegacyGroceries();

    return () => {
      cancelled = true;
    };
  }, [activeDayPlan, displayedGroceries, profile.cuisinePreference, weekPlan]);

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
  }, [plan, profile.cuisinePreference, weekPlan]);

  function updateProfile(updater: (current: NutritionProfile) => NutritionProfile) {
    setProfile(updater);
  }

  function persistProfile() {
    const nextProfile =
      profile.macroMode === "split"
        ? {
            ...profile,
            macroTargets: deriveMacroTargets(profile.calorieTarget, "split", profile.macroPreset)
          }
        : profile;

    saveProfile(nextProfile);
    if (authUser) {
      saveCloudFoodState(authUser.uid, { profile: nextProfile }).catch((error) => {
        console.error("profile save error", error);
      });
    }

    setProfile(nextProfile);
    setCalorieInput(String(nextProfile.calorieTarget));
    setAgeInput(String(nextProfile.age));
    setHeightInput(String(nextProfile.heightCm));
    setWeightInput(String(nextProfile.weightKg));
    setSaved(true);
    setEditingProfile(false);
    void logAnalyticsEvent("profile_saved", {
      cuisine: nextProfile.cuisinePreference,
      dietary_pattern: nextProfile.dietaryPattern,
      meals_per_day: nextProfile.mealsPerDay,
      repeats_enabled: nextProfile.allowRepeats
    });
    return nextProfile;
  }

  function syncCalculatedCalories() {
    setCalorieInput(String(estimatedCalories));
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

  async function safeSaveCloudState(state: Parameters<typeof saveCloudFoodState>[1]) {
    if (!authUser) {
      return;
    }

    try {
      await saveCloudFoodState(authUser.uid, state);
    } catch (error) {
      console.error("cloud-state save error", error);
    }
  }

  async function requestMealPlan(nextProfile: NutritionProfile, date = todayDate) {
    setIsGenerating(true);
    setPlanError(null);
    setActiveTab("day");
    void logAnalyticsEvent("day_plan_requested", {
      date,
      meals_per_day: nextProfile.mealsPerDay,
      cuisine: nextProfile.cuisinePreference,
      prep_preference: nextProfile.prepPreference
    });

    try {
      const response = await fetch(`${API_BASE_URL}/api/meal-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: nextProfile, date })
      });

      const raw = await response.text();
      const payload = raw ? (JSON.parse(raw) as { plan?: DailyMealPlan; error?: string }) : {};
      if (!response.ok || !payload.plan) {
        throw new Error(payload.error ?? "Unable to generate an AI plan right now.");
      }

      setPlan(payload.plan);
      savePlan(payload.plan);
      void safeSaveCloudState({ plan: payload.plan });
      setPlanError(null);
      setMealVideos({});
      void logAnalyticsEvent("day_plan_generated", {
        date: payload.plan.date,
        meal_count: payload.plan.meals.length,
        reminder_count: payload.plan.reminders.length,
        grocery_count: payload.plan.groceryList.length
      });

      return payload.plan;
    } catch (error) {
      setPlan(null);
      setPlanError(error instanceof Error ? error.message : "Unable to generate an AI plan right now.");
      void logAnalyticsEvent("day_plan_failed", { date });
      return null;
    } finally {
      setIsGenerating(false);
    }
  }

  async function requestWeekPlan(nextProfile: NutritionProfile) {
    setIsGeneratingWeek(true);
    setWeekError(null);
    setActiveTab("week");
    setWeekPlan(null);
    setPlan(null);
    setMealVideos({});
    setCheckedGroceries([]);
    void logAnalyticsEvent("week_plan_requested", {
      start_date: getWeekStartDate(),
      meals_per_day: nextProfile.mealsPerDay,
      cuisine: nextProfile.cuisinePreference,
      repeats_enabled: nextProfile.allowRepeats
    });

    try {
      const response = await fetch(`${API_BASE_URL}/api/weekly-meal-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: nextProfile,
          startDate: getWeekStartDate()
        })
      });

      const raw = await response.text();
      const payload = raw ? (JSON.parse(raw) as { weekPlan?: WeeklyMealPlan; error?: string }) : {};
      if (!response.ok || !payload.weekPlan) {
        throw new Error(payload.error ?? "Unable to generate a weekly AI plan right now.");
      }

      setWeekPlan(payload.weekPlan);
      saveWeekPlan(payload.weekPlan);
      void safeSaveCloudState({ weekPlan: payload.weekPlan });
      setCheckedGroceries([]);

      const todaysPlan = payload.weekPlan.days.find((day) => day.date === todayDate) ?? null;
      if (todaysPlan) {
        setPlan(todaysPlan);
        savePlan(todaysPlan);
        void safeSaveCloudState({ plan: todaysPlan });
      }

      setWeekError(null);
      void logAnalyticsEvent("week_plan_generated", {
        day_count: payload.weekPlan.days.length,
        grocery_count: payload.weekPlan.groceryList.length
      });
    } catch (error) {
      setWeekPlan(null);
      setWeekError(error instanceof Error ? error.message : "Unable to generate a weekly AI plan right now.");
      void logAnalyticsEvent("week_plan_failed", {
        start_date: getWeekStartDate()
      });
    } finally {
      setIsGeneratingWeek(false);
    }
  }

  async function handleBuildWeekOnly() {
    const nextProfile = persistProfile();
    setPlanError(null);
    await requestWeekPlan(nextProfile);
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
      const refreshedPlan = await requestMealPlan(updateDerivedTargets(profile), date);
      if (!refreshedPlan) {
        throw new Error("Unable to refresh this day right now.");
      }

      const updatedDays = weekPlan.days.map((day) => (day.date === date ? refreshedPlan : day));
      const nextWeekPlan = buildWeeklyPlanFromDays(weekPlan.startDate, updatedDays);
      setWeekPlan(nextWeekPlan);
      saveWeekPlan(nextWeekPlan);
      void safeSaveCloudState({ weekPlan: nextWeekPlan });

      if (date === todayDate) {
        setPlan(refreshedPlan);
        savePlan(refreshedPlan);
        void safeSaveCloudState({ plan: refreshedPlan });
      }
    } catch (error) {
      setWeekError(error instanceof Error ? error.message : "Unable to refresh this day right now.");
    } finally {
      setIsGeneratingWeek(false);
    }
  }

  async function handleSignOut() {
    if (!auth) {
      return;
    }

    void logAnalyticsEvent("logout_clicked");
    await signOut(auth);
    clearStoredAppState();
    setAuthUser(null);
    setProfile(defaultProfile);
    setCalorieInput(String(defaultProfile.calorieTarget));
    setAgeInput(String(defaultProfile.age));
    setHeightInput(String(defaultProfile.heightCm));
    setWeightInput(String(defaultProfile.weightKg));
    setSaved(false);
    setEditingProfile(false);
    setPlan(null);
    setWeekPlan(null);
    setCheckedGroceries([]);
    setMealVideos({});
    setActiveTab("profile");
    setAuthReady(true);
  }

  if (!authReady || cloudLoading) {
    return (
      <div className="auth-shell">
        <section className="auth-card">
          <p className="section-kicker">Personal Food OS</p>
          <h1>Loading your food system</h1>
          <p className="helper-copy">Pulling in your saved profile and latest plans.</p>
        </section>
      </div>
    );
  }

  if (isFirebaseConfigured && !authUser) {
    return <AuthScreen onSignedIn={setAuthUser} />;
  }

  const accountLabel = isFirebaseConfigured
    ? authUser?.email ?? authUser?.displayName ?? "Signed in"
    : "Local mode";
  const cuisineLabel = profile.cuisinePreference.replace("_", " ");

  return (
    <div className="app-shell">
      <main className="dashboard">
        <div className="app-header">
          <div className="app-topbar">
            <AppStage
              activeTab={activeTab}
              calorieTarget={profile.calorieTarget}
              cuisineLabel={cuisineLabel}
              weekReady={Boolean(weekPlan)}
              remindersCount={groupedReminders.reduce((sum, group) => sum + group.items.length, 0)}
            />
          </div>

          <TabsNav
            activeTab={activeTab}
            onChange={setActiveTab}
            showProfileTab
            className="tabs-desktop"
          />
        </div>

        {activeTab === "profile" ? (
          <ProfilePanel
            saved={saved}
            editingProfile={editingProfile}
            profile={profile}
            exclusionOptions={exclusionOptions}
            estimatedCalories={estimatedCalories}
            displayedTargets={displayedTargets}
            calorieInput={calorieInput}
            ageInput={ageInput}
            heightInput={heightInput}
            weightInput={weightInput}
            isGeneratingWeek={isGeneratingWeek}
            authUser={authUser}
            accountLabel={accountLabel}
            onSyncCalculatedCalories={syncCalculatedCalories}
            onCalorieInputChange={(value) => {
              setCalorieInput(value);
              if (value !== "") {
                setProfile((current) => ({ ...current, calorieTarget: Number(value) }));
              }
            }}
            onCalorieInputBlur={() => {
              if (calorieInput === "") {
                setCalorieInput(String(profile.calorieTarget));
              }
            }}
            onAgeInputChange={(value) => {
              setAgeInput(value);
              if (value !== "") {
                setProfile((current) => ({ ...current, age: Number(value) }));
              }
            }}
            onAgeInputBlur={() => {
              if (ageInput === "") {
                setAgeInput(String(profile.age));
              }
            }}
            onHeightInputChange={(value) => {
              setHeightInput(value);
              if (value !== "") {
                setProfile((current) => ({ ...current, heightCm: Number(value) }));
              }
            }}
            onHeightInputBlur={() => {
              if (heightInput === "") {
                setHeightInput(String(profile.heightCm));
              }
            }}
            onWeightInputChange={(value) => {
              setWeightInput(value);
              if (value !== "") {
                setProfile((current) => ({ ...current, weightKg: Number(value) }));
              }
            }}
            onWeightInputBlur={() => {
              if (weightInput === "") {
                setWeightInput(String(profile.weightKg));
              }
            }}
            onProfileChange={updateProfile}
            onBuildWeek={saved && !editingProfile ? regenerateWeekPlan : handleBuildWeekOnly}
            onEditProfile={() => setEditingProfile(true)}
            onSignOut={authUser ? () => void handleSignOut() : undefined}
          />
        ) : null}

        {activeTab === "day" ? (
          <DayPanel plan={activeDayPlan} planError={planError} isGenerating={isGenerating} mealVideos={mealVideos} />
        ) : null}

        {activeTab === "week" ? (
          <WeekPanel
            weekPlan={weekPlan}
            weekError={weekError}
            isGeneratingWeek={isGeneratingWeek}
            mealVideos={mealVideos}
            onRegenerateWeek={regenerateWeekPlan}
            onRegenerateDay={regenerateWeekDay}
          />
        ) : null}

        {activeTab === "family" ? (
          <section className="panel active-panel">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">Family planning</p>
                <h2>Coming soon</h2>
              </div>
            </div>

            <div className="panel-hero panel-hero-family">
              <div className="panel-hero-copy">
                <p className="section-kicker">Next chapter</p>
                <h3>Build one food system for more than one person</h3>
                <div className="panel-hero-chip-row">
                  <span className="panel-hero-chip">shared plans</span>
                  <span className="panel-hero-chip">household groceries</span>
                  <span className="panel-hero-chip">coming soon</span>
                </div>
              </div>
              <div className="panel-hero-art" aria-hidden="true">
                <div className="panel-hero-plate" />
                <div className="panel-hero-garnish panel-hero-garnish-a" />
                <div className="panel-hero-garnish panel-hero-garnish-b" />
                <div className="panel-hero-garnish panel-hero-garnish-c" />
              </div>
            </div>

            <div className="empty-state">
              Family profiles, shared planning, and household-friendly meal coordination are coming soon.
            </div>
          </section>
        ) : null}

        {activeTab === "reminders" ? <RemindersPanel groupedReminders={groupedReminders} /> : null}

        {activeTab === "groceries" ? (
          <GroceriesPanel
            weekMode={Boolean(weekPlan)}
            hasGroceries={displayedGroceries.length > 0}
            groupedGroceries={groupedGroceries}
            checkedGroceries={checkedGroceries}
            onToggleItem={(itemId) =>
              setCheckedGroceries((current) =>
                current.includes(itemId) ? current.filter((entry) => entry !== itemId) : [...current, itemId]
              )
            }
            onResetChecks={() => setCheckedGroceries([])}
          />
        ) : null}
      </main>

      <div className="mobile-tab-dock">
        <TabsNav
          activeTab={activeTab}
          onChange={setActiveTab}
          showProfileTab
          className="tabs-mobile"
        />
      </div>
    </div>
  );
}

export default App;
