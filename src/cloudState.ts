import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { DailyMealPlan, NutritionProfile, WeeklyMealPlan } from "./types";

export interface CloudFoodState {
  profile: NutritionProfile | null;
  plan: DailyMealPlan | null;
  weekPlan: WeeklyMealPlan | null;
}

const EMPTY_STATE: CloudFoodState = {
  profile: null,
  plan: null,
  weekPlan: null
};

function getStateRef(uid: string) {
  if (!db) {
    throw new Error("Firebase is not configured.");
  }

  return doc(db, "users", uid, "appData", "foodOS");
}

export async function loadCloudFoodState(uid: string): Promise<CloudFoodState> {
  const snapshot = await getDoc(getStateRef(uid));
  if (!snapshot.exists()) {
    return EMPTY_STATE;
  }

  const data = snapshot.data() as Partial<CloudFoodState>;
  return {
    profile: data.profile ?? null,
    plan: data.plan ?? null,
    weekPlan: data.weekPlan ?? null
  };
}

export async function saveCloudFoodState(uid: string, state: Partial<CloudFoodState>) {
  await setDoc(
    getStateRef(uid),
    {
      ...state,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

