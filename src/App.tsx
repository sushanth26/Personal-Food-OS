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
      void safeSaveCloudState({ weekPlan: nextWeekPlamΈτ¤μ((€€€€€¥€΅‘…Ρ”€τττΡ½‘…ε…Ρ”¤μ(€€€€€€€Ν•ΡA±…Έ΅Ι•™Ι•Ν΅•‘A±…Έ¤μ(€€€€€€€Ν…Ω•A±…Έ΅Ι•™Ι•Ν΅•‘A±…Έ¤μ(€€€€€€€Ω½¥Ν…™•M…Ω•±½Υ‘MΡ…Ρ”΅μΑ±…ΈθΙ•™Ι•Ν΅•‘A±…Έτ¤μ(€€€€€τ(€€€τ…Ρ €΅•ΙΙ½Θ¤μ(€€€€€Ν•Ρ]••­ΙΙ½Θ΅•ΙΙ½Θ¥ΉΝΡ…Ή•½Ι½Θ€ό•ΙΙ½ΘΉµ•ΝΝ…”€θ€‰UΉ…‰±”ΡΌΙ•™Ι•Ν Ρ΅¥Μ‘…δΙ¥΅ΠΉ½άΈ¤μ(€€€τ™¥Ή…±±δμ(€€€€€Ν•Ρ%Ν•Ή•Ι…Ρ¥Ή]••¬΅™…±Ν”¤μ(€€€τ(€τ((€…ΝεΉ™ΥΉΡ¥½Έ΅…Ή‘±•M¥Ή=ΥΠ ¤μ(€€€¥€ ……ΥΡ ¤μ(€€€€€Ι•ΡΥΙΈμ(€€€τ((€€€…έ…¥ΠΝ¥Ή=ΥΠ΅…ΥΡ ¤μ(€€€Ν•ΡΥΡ΅UΝ•Θ΅ΉΥ±°¤μ(€€€Ν•ΡΥΡ΅I•…‘δ΅ΡΙΥ”¤μ(€τ((€¥€ ……ΥΡ΅I•…‘δρπ±½Υ‘1½…‘¥Ή¤μ(€€€Ι•ΡΥΙΈ€ (€€€€€€ρ‘¥Ψ±…ΝΝ9…µ”τ‰…ΥΡ µΝ΅•±°ψ(€€€€€€€€ρΝ•Ρ¥½Έ±…ΝΝ9…µ”τ‰…ΥΡ µ…Ιψ(€€€€€€€€€€ρΐ±…ΝΝ9…µ”τ‰Ν•Ρ¥½Έµ­¥­•ΘωA•ΙΝ½Ή…°½½=Lπ½ΐψ(€€€€€€€€€€ρ Δω1½…‘¥Ήε½ΥΘ™½½ΝεΝΡ•΄π½ Δψ(€€€€€€€€€€ρΐ±…ΝΝ9…µ”τ‰΅•±Α•Θµ½ΑδωAΥ±±¥Ή¥Έε½ΥΘΝ…Ω•ΑΙ½™¥±”…Ή±…Ρ•ΝΠΑ±…ΉΜΈπ½ΐψ(€€€€€€€€π½Ν•Ρ¥½Έψ(€€€€€€π½‘¥Ψψ(€€€€¤μ(€τ((€¥€΅¥Ν¥Ι•‰…Ν•½Ή™¥ΥΙ•€€……ΥΡ΅UΝ•Θ¤μ(€€€Ι•ΡΥΙΈ€ρΥΡ΅MΙ••Έ½ΉM¥Ή•‘%ΈυνΝ•ΡΥΡ΅UΝ•Ιτ€Όψμ(€τ((€½ΉΝΠ…½ΥΉΡ1…‰•°€τ¥Ν¥Ι•‰…Ν•½Ή™¥ΥΙ•(€€€€ό…ΥΡ΅UΝ•ΘόΉ•µ…¥°€όό…ΥΡ΅UΝ•ΘόΉ‘¥ΝΑ±…ε9…µ”€όό€‰M¥Ή•¥Έ(€€€€θ€‰1½…°µ½‘”μ(€½ΉΝΠΥΝ•Ι%Ή¥Ρ¥…°€τ€΅…ΥΡ΅UΝ•ΘόΉ‘¥ΝΑ±…ε9…µ”€όό…ΥΡ΅UΝ•ΘόΉ•µ…¥°€όό€‰T¤ΉΡΙ¥΄ ¤Ή΅…ΙΠ ΐ¤ΉΡ½UΑΑ•Ι…Ν” ¤μ((€Ι•ΡΥΙΈ€ (€€€€ρ‘¥Ψ±…ΝΝ9…µ”τ‰…ΑΐµΝ΅•±°ψ(€€€€€€ρµ…¥Έ±…ΝΝ9…µ”τ‰‘…Ν΅‰½…Ιψ(€€€€€€€€ρ‘¥Ψ±…ΝΝ9…µ”τ‰…Αΐµ΅•…‘•Θψ(€€€€€€€€€€ρQ…‰Ν9…Ψ…Ρ¥Ω•Q…υν…Ρ¥Ω•Q…‰τ½Ή΅…Ή”υνΝ•ΡΡ¥Ω•Q…‰τΝ΅½έAΙ½™¥±•Q…υνΝ΅½έAΙ½™¥±•Q…€Όψ((€€€€€€€€€€ν…ΥΡ΅UΝ•Θ€ό€΅qΈ€€€€€€€€€€€€ρ‘¥Ψ±…ΝΝ9…µ”τ‰ΥΝ•Θµµ•ΉΤψ(€€€€€€€€€€€€€€ρ‰ΥΡΡ½Έ(€€€€€€€€€€€€€€€ΡεΑ”τ‰‰ΥΡΡ½Έ(€€€€€€€€€€€€€€€±…ΝΝ9…µ”τ‰ΥΝ•Θµµ•ΉΤµΡΙ¥•Θ(€€€€€€€€€€€€€€€½Ή±¥¬υμ ¤€τψΝ•ΡUΝ•Ι5•ΉΥ=Α•Έ ΅ΥΙΙ•ΉΠ¤€τψ€…ΥΙΙ•ΉΠ¥τ(€€€€€€€€€€€€€€€…Ι¥„µ•αΑ…Ή‘•υνΥΝ•Ι5•ΉΥ=Α•Ήτ(€€€€€€€€€€€€€€€…Ι¥„µ΅…ΝΑ½ΑΥΐτ‰µ•ΉΤ(€€€€€€€€€€€€€€ψ(€€€€€€€€€€€€€€€ν…ΥΡ΅UΝ•ΘΉΑ΅½Ρ½UI0€ό€ (€€€€€€€€€€€€€€€€€€ρ¥µ±…ΝΝ9…µ”τ‰ΥΝ•Θµ…Ω…Ρ…ΘΝΙυν…ΥΡ΅UΝ•ΘΉΑ΅½Ρ½UI1τ…±Πυν…½ΥΉΡ1…‰•±τ€Όψ(€€€€€€€€€€€€€€€€¤€θ€ (€€€€€€€€€€€€€€€€€€ρΝΑ…Έ±…ΝΝ9…µ”τ‰ΥΝ•Θµ…Ω…Ρ…ΘΥΝ•Θµ…Ω…Ρ…Θµ™…±±‰…¬ωνΥΝ•Ι%Ή¥Ρ¥…±τπ½ΝΑ…Έψ(€€€€€€€€€€€€€€€€¥τ(€€€€€€€€€€€€€€π½‰ΥΡΡ½Έψ((€€€€€€€€€€€€€νΥΝ•Ι5•ΉΥ=Α•Έ€ό€ (€€€€€€€€€€€€€€€€ρ‘¥Ψ±…ΝΝ9…µ”τ‰ΥΝ•Θµµ•ΉΤµΑ½Α½Ω•ΘΙ½±”τ‰µ•ΉΤψ(€€€€€€€€€€€€€€€€€€ρ‘¥Ψ±…ΝΝ9…µ”τ‰ΥΝ•Θµµ•ΉΤµΝΥµµ…Ιδψ(€€€€€€€€€€€€€€€€€€€ν…ΥΡ΅UΝ•ΘΉΑ΅½Ρ½UI0€ό€ (€€€€€€€€€€€€€€€€€€€€€€ρ¥µ±…ΝΝ9…µ”τ‰ΥΝ•Θµ…Ω…Ρ…ΘΝΙυν…ΥΡ΅UΝ•ΘΉΑ΅½Ρ½UI1τ…±Πυν…½ΥΉΡ1…‰•±τ€Όψ(€€€€€€€€€€€€€€€€€€€€¤€θ€ (€€€€€€€€€€€€€€€€€€€€€€ρΝΑ…Έ±…ΝΝ9…µ”τ‰ΥΝ•Θµ…Ω…Ρ…ΘΥΝ•Θµ…Ω…Ρ…Θµ™…±±‰…¬ωνΥΝ•Ι%Ή¥Ρ¥…±τπ½ΝΑ…Έψ(€€€€€€€€€€€€€€€€€€€€¥τ(€€€€€€€€€€€€€€€€€€€€ρ‘¥Ψψ(€€€€€€€€€€€€€€€€€€€€€€ρΝΡΙ½Ήων…ΥΡ΅UΝ•ΘΉ‘¥ΝΑ±…ε9…µ”€όό€‰e½ΥΘ…½ΥΉΠ‰τπ½ΝΡΙ½Ήψ(€€€€€€€€€€€€€€€€€€€€€€ρΐων…½ΥΉΡ1…‰•±τπ½ΐψ(€€€€€€€€€€€€€€€€€€€€π½‘¥Ψψ(€€€€€€€€€€€€€€€€€€π½‘¥Ψψ(€€€€€€€€€€€€€€€€€€ρ‰ΥΡΡ½Έ(€€€€€€€€€€€€€€€€€€€ΡεΑ”τ‰‰ΥΡΡ½Έ(€€€€€€€€€€€€€€€€€€€±…ΝΝ9…µ”τ‰ΥΝ•Θµµ•ΉΤµ¥Ρ•΄(€€€€€€€€€€€€€€€€€€€½Ή±¥¬υμ ¤€τψμ(€€€€€€€€€€€€€€€€€€€€€Ν•ΡΡ¥Ω•Q… ‰ΑΙ½™¥±”¤μ(€€€€€€€€€€€€€€€€€€€€€Ν•Ρ‘¥Ρ¥ΉAΙ½™¥±”΅ΡΙΥ”¤μ(€€€€€€€€€€€€€€€€€€€€€Ν•ΡUΝ•Ι5•ΉΥ=Α•Έ΅™…±Ν”¤μ(€€€€€€€€€€€€€€€€€€€υτ(€€€€€€€€€€€€€€€€€€ψ(€€€€€€€€€€€€€€€€€€€‘¥ΠΑΙ•™•Ι•Ή•Μ(€€€€€€€€€€€€€€€€€€π½‰ΥΡΡ½Έψ(€€€€€€€€€€€€€€€€€€ρ‰ΥΡΡ½Έ(€€€€€€€€€€€€€€€€€€€ΡεΑ”τ‰‰ΥΡΡ½Έ(€€€€€€€€€€€€€€€€€€€±…ΝΝ9…µ”τ‰ΥΝ•Θµµ•ΉΤµ¥Ρ•΄(€€€€€€€€€€€€€€€€€€€½Ή±¥¬υμ ¤€τψμ(€€€€€€€€€€€€€€€€€€€€€Ν•ΡUΝ•Ι5•ΉΥ=Α•Έ΅™…±Ν”¤μ(€€€€€€€€€€€€€€€€€€€€€Ω½¥΅…Ή‘±•M¥Ή=ΥΠ ¤μ(€€€€€€€€€€€€€€€€€€€υτ(€€€€€€€€€€€€€€€€€€ψ(€€€€€€€€€€€€€€€€€€€M¥Έ½ΥΠ(€€€€€€€€€€€€€€€€€€π½‰ΥΡΡ½Έψ(€€€€€€€€€€€€€€€€π½‘¥Ψψ(€€€€€€€€€€€€€€¤€θΉΥ±±τ(€€€€€€€€€€€€π½‘¥Ψψ(€€€€€€€€€€¤€θΉΥ±±τ(€€€€€€€€π½‘¥Ψψ((€€€€€€€ν…Ρ¥Ω•Q…€τττ€‰ΑΙ½™¥±”€ό€ (€€€€€€€€€€ρAΙ½™¥±•A…Ή•°(€€€€€€€€€€€Ν…Ω•υνΝ…Ω•‘τ(€€€€€€€€€€€•‘¥Ρ¥ΉAΙ½™¥±”υν•‘¥Ρ¥ΉAΙ½™¥±•τ(€€€€€€€€€€€ΑΙ½™¥±”υνΑΙ½™¥±•τ(€€€€€€€€€€€•α±ΥΝ¥½Ή=ΑΡ¥½ΉΜυν•α±ΥΝ¥½Ή=ΑΡ¥½ΉΝτ(€€€€€€€€€€€•ΝΡ¥µ…Ρ•‘…±½Ι¥•Μυν•ΝΡ¥µ…Ρ•‘…±½Ι¥•Ντ(€€€€€€€€€€€‘¥ΝΑ±…ε•‘Q…Ι•ΡΜυν‘¥ΝΑ±…ε•‘Q…Ι•ΡΝτ(€€€€€€€€€€€…•%ΉΑΥΠυν…•%ΉΑΥΡτ(€€€€€€€€€€€΅•¥΅Ρ%ΉΑΥΠυν΅•¥΅Ρ%ΉΑΥΡτ(€€€€€€€€€€€έ•¥΅Ρ%ΉΑΥΠυνέ•¥΅Ρ%ΉΑΥΡτ(€€€€€€€€€€€¥Ν•Ή•Ι…Ρ¥Ή]••¬υν¥Ν•Ή•Ι…Ρ¥Ή]••­τ(€€€€€€€€€€€½ΉMεΉ…±Υ±…Ρ•‘…±½Ι¥•ΜυνΝεΉ…±Υ±…Ρ•‘…±½Ι¥•Ντ(€€€€€€€€€€€½Ή•%ΉΑΥΡ΅…Ή”υμ΅Ω…±Υ”¤€τψμ(€€€€€€€€€€€€€Ν•Ρ•%ΉΑΥΠ΅Ω…±Υ”¤μ(€€€€€€€€€€€€€¥€΅Ω…±Υ”€„ττ€¤μ(€€€€€€€€€€€€€€€Ν•ΡAΙ½™¥±” ΅ΥΙΙ•ΉΠ¤€τψ€΅μ€ΈΈΉΥΙΙ•ΉΠ°…”θ9Υµ‰•Θ΅Ω…±Υ”¤τ¤¤μ(€€€€€€€€€€€€€τ(€€€€€€€€€€€υτ(€€€€€€€€€€€½Ή•%ΉΑΥΡ	±ΥΘυμ ¤€τψμ(€€€€€€€€€€€€€¥€΅…•%ΉΑΥΠ€τττ€¤μ(€€€€€€€€€€€€€€€Ν•Ρ•%ΉΑΥΠ΅MΡΙ¥Ή΅ΑΙ½™¥±”Ή…”¤¤μ(€€€€€€€€€€€€€τ(€€€€€€€€€€€υτ(€€€€€€€€€€€½Ή!•¥΅Ρ%ΉΑΥΡ΅…Ή”υμ΅Ω…±Υ”¤€τψμ(€€€€€€€€€€€€€Ν•Ρ!•¥΅Ρ%ΉΑΥΠ΅Ω…±Υ”¤μ(€€€€€€€€€€€€€¥€΅Ω…±Υ”€„ττ€¤μ(€€€€€€€€€€€€€€€Ν•ΡAΙ½™¥±” ΅ΥΙΙ•ΉΠ¤€τψ€΅μ€ΈΈΉΥΙΙ•ΉΠ°΅•¥΅Ρ΄θ9Υµ‰•Θ΅Ω…±Υ”¤τ¤¤μ(€€€€€€€€€€€€€τ(€€€€€€€€€€€υτ(€€€€€€€€€€€½Ή!•¥΅Ρ%ΉΑΥΡ	±ΥΘυμ ¤€τψμ(€€€€€€€€€€€€€¥€΅΅•¥΅Ρ%ΉΑΥΠ€τττ€¤μ(€€€€€€€€€€€€€€€Ν•Ρ!•¥΅Ρ%ΉΑΥΠ΅MΡΙ¥Ή΅ΑΙ½™¥±”Ή΅•¥΅Ρ΄¤¤μ(€€€€€€€€€€€€€τ(€€€€€€€€€€€υτ(€€€€€€€€€€€½Ή]•¥΅Ρ%ΉΑΥΡ΅…Ή”υμ΅Ω…±Υ”¤€τψμ(€€€€€€€€€€€€€Ν•Ρ]•¥΅Ρ%ΉΑΥΠ΅Ω…±Υ”¤μ(€€€€€€€€€€€€€¥€΅Ω…±Υ”€„ττ€¤μ(€€€€€€€€€€€€€€€Ν•ΡAΙ½™¥±” ΅ΥΙΙ•ΉΠ¤€τψ€΅μ€ΈΈΉΥΙΙ•ΉΠ°έ•¥΅Ρ-θ9Υµ‰•Θ΅Ω…±Υ”¤τ¤¤μ(€€€€€€€€€€€€€τ(€€€€€€€€€€€υτ(€€€€€€€€€€€½Ή]•¥΅Ρ%ΉΑΥΡ	±ΥΘυμ ¤€τψμ(€€€€€€€€€€€€€¥€΅έ•¥΅Ρ%ΉΑΥΠ€τττ€¤μ(€€€€€€€€€€€€€€€Ν•Ρ]•¥΅Ρ%ΉΑΥΠ΅MΡΙ¥Ή΅ΑΙ½™¥±”Ήέ•¥΅Ρ-¤¤μ(€€€€€€€€€€€€€τ(€€€€€€€€€€€υτ(€€€€€€€€€€€½ΉAΙ½™¥±•΅…Ή”υνΥΑ‘…Ρ•AΙ½™¥±•τ(€€€€€€€€€€€½Ή	Υ¥±‘]••¬υνΝ…Ω•€€…•‘¥Ρ¥ΉAΙ½™¥±”€όΙ••Ή•Ι…Ρ•]••­A±…Έ€θ΅…Ή‘±•	Υ¥±‘]••­=Ή±ετ(€€€€€€€€€€Όψ(€€€€€€€€¤€θΉΥ±±τ((€€€€€€€ν…Ρ¥Ω•Q…€τττ€‰‘…δ€ό€ (€€€€€€€€€€ρ…εA…Ή•°Α±…Έυν…Ρ¥Ω•…εA±…ΉτΑ±…ΉΙΙ½ΘυνΑ±…ΉΙΙ½Ιτ¥Ν•Ή•Ι…Ρ¥Ήυν¥Ν•Ή•Ι…Ρ¥Ήτµ•…±Y¥‘•½Μυνµ•…±Y¥‘•½Ντ€Όψ(€€€€€€€€¤€θΉΥ±±τ((€€€€€€€ν…Ρ¥Ω•Q…€τττ€‰έ••¬€ό€ (€€€€€€€€€€ρ]••­A…Ή•°(€€€€€€€€€€€έ••­A±…Έυνέ••­A±…Ήτ(€€€€€€€€€€€έ••­ΙΙ½Θυνέ••­ΙΙ½Ιτ(€€€€€€€€€€€¥Ν•Ή•Ι…Ρ¥Ή]••¬υν¥Ν•Ή•Ι…Ρ¥Ή]••­τ(€€€€€€€€€€€µ•…±Y¥‘•½Μυνµ•…±Y¥‘•½Ντ(€€€€€€€€€€€½ΉI••Ή•Ι…Ρ•]••¬υνΙ••Ή•Ι…Ρ•]••­A±…Ήτ(€€€€€€€€€€€½ΉI••Ή•Ι…Ρ•…δυνΙ••Ή•Ι…Ρ•]••­…ετ(€€€€€€€€€€Όψ(€€€€€€€€¤€θΉΥ±±τ((€€€€€€€ν…Ρ¥Ω•Q…€τττ€‰™…µ¥±δ€ό€ (€€€€€€€€€€ρΝ•Ρ¥½Έ±…ΝΝ9…µ”τ‰Α…Ή•°…Ρ¥Ω”µΑ…Ή•°ψ(€€€€€€€€€€€€ρ‘¥Ψ±…ΝΝ9…µ”τ‰Α…Ή•°µ΅•…‘¥Ήψ(€€€€€€€€€€€€€€ρ‘¥Ψψ(€€€€€€€€€€€€€€€€ρΐ±…ΝΝ9…µ”τ‰Ν•Ρ¥½Έµ­¥­•Θω…µ¥±δΑ±…ΉΉ¥Ήπ½ΐψ(€€€€€€€€€€€€€€€€ρ Θω½µ¥ΉΝ½½Έπ½ Θψ(€€€€€€€€€€€€€€π½‘¥Ψψ(€€€€€€€€€€€€π½‘¥Ψψ((€€€€€€€€€€€€ρ‘¥Ψ±…ΝΝ9…µ”τ‰•µΑΡδµΝΡ…Ρ”ψ(€€€€€€€€€€€€€…µ¥±δΑΙ½™¥±•Μ°Ν΅…Ι•Α±…ΉΉ¥Ή°…Ή΅½ΥΝ•΅½±µ™Ι¥•Ή‘±δµ•…°½½Ι‘¥Ή…Ρ¥½Έ…Ι”½µ¥ΉΝ½½ΈΈ(€€€€€€€€€€€€π½‘¥Ψψ(€€€€€€€€€€π½Ν•Ρ¥½Έψ(€€€€€€€€¤€θΉΥ±±τ((€€€€€€€ν…Ρ¥Ω•Q…€τττ€‰Ι•µ¥Ή‘•ΙΜ€ό€ρI•µ¥Ή‘•ΙΝA…Ή•°Ι½ΥΑ•‘I•µ¥Ή‘•ΙΜυνΙ½ΥΑ•‘I•µ¥Ή‘•ΙΝτ€Όψ€θΉΥ±±τ((€€€€€€€ν…Ρ¥Ω•Q…€τττ€‰Ι½•Ι¥•Μ€ό€ (€€€€€€€€€€ρΙ½•Ι¥•ΝA…Ή•°(€€€€€€€€€€€έ••­5½‘”υν	½½±•…Έ΅έ••­A±…Έ¥τ(€€€€€€€€€€€΅…ΝΙ½•Ι¥•Μυν‘¥ΝΑ±…ε•‘Ι½•Ι¥•ΜΉ±•ΉΡ €ψ€Ατ(€€€€€€€€€€€Ι½ΥΑ•‘Ι½•Ι¥•ΜυνΙ½ΥΑ•‘Ι½•Ι¥•Ντ(€€€€€€€€€€€΅•­•‘Ι½•Ι¥•Μυν΅•­•‘Ι½•Ι¥•Ντ(€€€€€€€€€€€½ΉQ½±•%Ρ•΄υμ΅¥Ρ•µ%¤€τψ(€€€€€€€€€€€€€Ν•Ρ΅•­•‘Ι½•Ι¥•Μ ΅ΥΙΙ•ΉΠ¤€τψ(€€€€€€€€€€€€€€€ΥΙΙ•ΉΠΉ¥Ή±Υ‘•Μ΅¥Ρ•µ%¤€όΥΙΙ•ΉΠΉ™¥±Ρ•Θ ΅•ΉΡΙδ¤€τψ•ΉΡΙδ€„ττ¥Ρ•µ%¤€θlΈΈΉΥΙΙ•ΉΠ°¥Ρ•µ%‘t(€€€€€€€€€€€€€€¤(€€€€€€€€€€€τ(€€€€€€€€€€€½ΉI•Ν•Ρ΅•­Μυμ ¤€τψΝ•Ρ΅•­•‘Ι½•Ι¥•Μ΅mt¥τ(€€€€€€€€€€Όψ(€€€€€€€€¤€θΉΥ±±τ(€€€€€€π½µ…¥Έψ(€€€€π½‘¥Ψψ(€€¤μ)τ()•αΑ½ΙΠ‘•™…Υ±ΠΑΐμ(