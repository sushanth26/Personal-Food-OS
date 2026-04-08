import {
  ActivityLevel,
  BiologicalSex,
  CuisinePreference,
  DietaryPattern,
  Exclusion,
  Goal,
  MacroMode,
  MacroPreset,
  NutritionProfile,
  PrepPreference
} from "../types";
import PanelHero from "./PanelHero";

type ProfilePanelProps = {
  saved: boolean;
  editingProfile: boolean;
  profile: NutritionProfile;
  exclusionOptions: Exclusion[];
  estimatedCalories: number;
  displayedTargets: NutritionProfile["macroTargets"];
  ageInput: string;
  heightInput: string;
  weightInput: string;
  isGeneratingWeek: boolean;
  onSyncCalculatedCalories: () => void;
  onAgeInputChange: (value: string) => void;
  onAgeInputBlur: () => void;
  onHeightInputChange: (value: string) => void;
  onHeightInputBlur: () => void;
  onWeightInputChange: (value: string) => void;
  onWeightInputBlur: () => void;
  onProfileChange: (updater: (current: NutritionProfile) => NutritionProfile) => void;
  onBuildWeek: () => void;
};

export default function ProfilePanel({
  saved,
  editingProfile,
  profile,
  exclusionOptions,
  estimatedCalories,
  displayedTargets,
  ageInput,
  heightInput,
  weightInput,
  isGeneratingWeek,
  onSyncCalculatedCalories,
  onAgeInputChange,
  onAgeInputBlur,
  onHeightInputChange,
  onHeightInputBlur,
  onWeightInputChange,
  onWeightInputBlur,
  onProfileChange,
  onBuildWeek
}: ProfilePanelProps) {
  return (
    <section className="panel panel-form active-panel">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">{saved ? "Nutrition profile" : "Onboarding"}</p>
          <h2>{saved && !editingProfile ? "Your current setup" : "Build your nutrition baseline"}</h2>
        </div>
      </div>

      <PanelHero
        tone="profile"
        kicker="Food identity"
        title="Set the rails once, then let the planner do the heavier lifting"
        chips={[`${profile.cuisinePreference.replace("_", " ")}`, `${profile.mealsPerDay} meals`, profile.allowRepeats ? "repeats on" : "variety first"]}
      />

      {!saved || editingProfile ? (
        <form
          className="profile-form"
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
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
                    onProfileChange((current) => ({
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
                  value={ageInput}
                  onChange={(event) => onAgeInputChange(event.target.value)}
                  onBlur={onAgeInputBlur}
                />
              </label>
              <label>
                Height (cm)
                <input
                  type="number"
                  min={120}
                  max={230}
                  value={heightInput}
                  onChange={(event) => onHeightInputChange(event.target.value)}
                  onBlur={onHeightInputBlur}
                />
              </label>
              <label>
                Weight (kg)
                <input
                  type="number"
                  min={35}
                  max={250}
                  step="0.1"
                  value={weightInput}
                  onChange={(event) => onWeightInputChange(event.target.value)}
                  onBlur={onWeightInputBlur}
                />
              </label>
              <label>
                Activity
                <select
                  value={profile.activityLevel}
                  onChange={(event) =>
                    onProfileChange((current) => ({
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
                    onProfileChange((current) => ({
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
              <button className="ghost-button" type="button" onClick={onSyncCalculatedCalories}>
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
                  onProfileChange((current) => ({
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
                  onProfileChange((current) => ({
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
                    onProfileChange((current) => ({
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
                      onProfileChange((current) => ({
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
                      onProfileChange((current) => ({
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
                      onProfileChange((current) => ({
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
                  onProfileChange((current) => ({
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
                        onProfileChange((current) => ({
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
                    onProfileChange((current) => ({
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
                    onProfileChange((current) => ({
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
                    onProfileChange((current) => ({
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
                  onProfileChange((current) => ({
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

          <div className="action-stack">
            <button className="primary-button" type="button" onClick={onBuildWeek} disabled={isGeneratingWeek}>
              {isGeneratingWeek ? "Generating weekly plan..." : "Save profile and build 7-day plan"}
            </button>
          </div>
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
            <button className="ghost-button" onClick={onBuildWeek} disabled={isGeneratingWeek}>
              {isGeneratingWeek ? "Generating weekly plan..." : "Build 7-day plan"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
