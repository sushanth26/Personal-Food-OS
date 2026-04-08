import { useEffect, useMemo, useState } from "react";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import AuthScreen from "./AuthScreen";
import { loadCloudFoodState, saveCloudFoodState } from "./cloudState";
import DayPanel from "./components/DayPanel";
import GroceriesPanel from "./components/GroceriesPanel";
import ProfilePanel from "./components/ProfilePanel";
import RemindersPanel from "./components/RemindersPanel";
import TabsNav from "./components/TabsNav";
import WeekPanel from "./components/WeekPanel";
import { auth, isFirebaseConfigured } from "./firebase";
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
  loadCheckedGroceries,
  loadPlan,
  loadProfile,
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
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    if (!auth) {
      setAuthReady(true);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setAuthUser(nextUser);

      if (!nextUser) {
        setAuthReady(true);
        return;
      }

      setCloudLoading(true);

      try {
        const localProfile = loadProfile();
        const localPlan = loadPlan();
        const localWeekPlan = loadWeekPlan();
        const cloudState = await loadCloudFoodState(nextUser.uid);

        const nextProfile = cloudState.profile ?? localProfile ?? defaultProfile;
        const nextPlan = cloudState.plan ?? localPlan;
        const nextWeekPlan = cloudState.weekPlan ?? localWeekPlan;

        setProfile(nextProfile);
        setAgeInput(String(nextProfile.age));
        setHeightInput(String(nextProfile.heightCm));
        setWeightInput(String(nextProfile.weightKg));
        setPlan(nextPlan);
        setWeekPlan(nextWeekPlan);
        setSaved(Boolean(cloudState.profile ?? localProfile));

        saveProfile(nextProfile);
        if (nextPlan) {
          savePlan(nextPlan);
        }
        if (nextWeekPlan) {
          saveWeekPlan(nextWeekPlan);
        }

        if (!cloudState.profile && (localProfile || localPlan || localWeekPlan)) {
          await saveCloudFoodState(nextUser.uid, {
            profile: localProfile ?? nextProfile,
            plan: localPlan ?? null,
            weekPlan: localWeekPlan ?? null
          });
        }
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
  const showProfileTab = !saved || editingProfile;

  useEffect(() => {
    if (!showProfileTab && activeTab === "profile") {
      setActiveTab("day");
    }
  }, [activeTab, showProfileTab]);

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
    setAgeInput(String(nextProfile.age));
    setHeightInput(String(nextProfile.heightCm));
    setWeightInput(String(nextProfile.weightKg));
    setSaved(true);
    setEditingProfile(false);
    return nextProfile;
  }

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

      return payload.plan;
    } catch (error) {
      setPlan(null);
      setPlanError(error instanceof Error ? error.message : "Unable to generate an AI plan right now.");
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
    } catch (error) {
      setWeekPlan(null);
      setWeekError(error instanceof Error ? error.message : "Unable to generate a weekly AI plan right now.");
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

    await signOut(auth);
    setAuthUser(null);
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
  const userInitial = (authUser?.displayName ?? authUser?.email ?? "U").trim().charAt(0).toUpperCase();

  return (
    <div className="app-shell">
      <main className="dashboard">
        <div className="app-header">
          <TabsNav activeTab={activeTab} onChange={setActiveTab} showProfileTab={showProfileTab} />

          {authUser ? (
            <div className="user-menu">
              <button
                type="button"
                className="user-menu-trigger"
                onClick={() => setUserMenuOpen((current) => !current)}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
              >
                {authUser.photoURL ? (
                  <img className="user-avatar" src={authUser.photoURL} alt={accountLabel} />
                ) : (
                  <span className="user-avatar user-avatar-fallback">{userInitial}</span>
                )}
              </button>

              {userMenuOpen ? (
                <div className="user-menu-popover" role="menu">
                  <div className="user-menu-summary">
                    {authUser.photoURL ? (
                      <img className="user-avatar" src={authUser.photoURL} alt={accountLabel} />
                    ) : (
                      <span className="user-avatar user-avatar-fallback">{userInitial}</span>
                    )}
                    <div>
                      <strong>{authUser.displayName ?? "Your account"}</strong>
                      <p>{accountLabel}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="user-menu-item"
                    onClick={() => {
                      setActiveTab("profile");
                      setEditingProfile(true);
                      setUserMenuOpen(false);
                    }}
                  >
                    Edit preferences
                  </button>
                  <button
                    type="button"
                    className="user-menu-item"
                    onClick={() => {
                      setUserMenuOpen(false);
                      void handleSignOut();
                    }}
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {activeTab === "profile" ? (
          <ProfilePanel
            saved={saved}
            editingProfile={editingProfile}
            profile={profile}
            exclusionOptions={exclusionOptions}
            estimatedCalories={estimatedCalories}
            displayedTargets={displayedTargets}
            ageInput={ageInput}
            heightInput={heightInput}
            weightInput={weightInput}
            isGeneratingWeek={isGeneratingWeek}
            onSyncCalculatedCalories={syncCalculatedCalories}
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
    </div>
  );
}

export default App;
