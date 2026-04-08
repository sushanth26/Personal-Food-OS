import { DailyMealPlan, RecipeVideo } from "../types";
import { mealColorClass } from "../lib/appConfig";
import { getMealPortionSummary } from "../lib/foodUtils";
import PanelHero from "./PanelHero";

type DayPanelProps = {
  plan: DailyMealPlan | null;
  planError: string | null;
  isGenerating: boolean;
  mealVideos: Record<string, RecipeVideo | null>;
};

export default function DayPanel({ plan, planError, isGenerating, mealVideos }: DayPanelProps) {
  return (
    <section className="panel panel-plan active-panel">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">1-day plan</p>
          <h2>Your nutrition day</h2>
        </div>
        {plan ? <span className="date-chip">{plan.date}</span> : null}
      </div>

      <PanelHero
        tone="day"
        kicker="Daily lens"
        title="One focused day, portioned for real life"
        chips={plan ? [`${plan.meals.length} meals`, `${plan.totals.calories} kcal`, "video-guided"] : ["AI-assisted", "portion-first", "mobile-friendly"]}
      />

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
            {plan.meals.map((meal) => {
              const portionSummary = getMealPortionSummary(meal.ingredients);

              return (
                <details key={meal.id} className={`meal-card ${mealColorClass[meal.mealType]}`} open={meal.mealType === "breakfast"}>
                  <summary className="meal-summary">
                    <div className="meal-summary-copy">
                      <div className="meal-headline-row">
                        <p className="meal-type">{meal.mealType}</p>
                        <span className="meal-suggestion-chip">Suggested</span>
                      </div>
                      <h3>{meal.name}</h3>
                      <p>{meal.description}</p>

                      <div className="meal-hero-amount">
                        <span>Eat this</span>
                        <strong>About {portionSummary.totalQuantity}g</strong>
                        <p>
                          {portionSummary.mainIngredients.length
                            ? portionSummary.mainIngredients
                                .map((ingredient) => `${Math.round(ingredient.quantity)}g ${ingredient.shortName}`)
                                .join(" + ")
                            : `${meal.totalCalories} kcal planned`}
                        </p>
                      </div>
                    </div>

                    <div className="macro-badge">
                      <span>{meal.totalCalories} kcal</span>
                      <strong>
                        {meal.totalProtein}P / {meal.totalCarbs}C / {meal.totalFat}F
                      </strong>
                    </div>
                  </summary>

                  <div className="meal-details">
                    <div className="portion-box">
                      <span>Main components</span>
                      <strong>{portionSummary.mainIngredients.length ? "What your plate should center on" : "One simple serving"}</strong>
                      <p className="portion-copy">
                        {portionSummary.mainIngredients.length
                          ? portionSummary.mainIngredients
                              .map((ingredient) => `${Math.round(ingredient.quantity)}g ${ingredient.shortName}`)
                              .join(" + ")
                          : "Follow the recipe video for the simplest serving flow."}
                      </p>
                    </div>

                    <div className="video-card">
                      <span>Top recipe video</span>
                      {mealVideos[meal.id] ? (
                        <a className="video-link" href={mealVideos[meal.id]!.url} target="_blank" rel="noreferrer">
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
              );
            })}
          </div>
        </>
      ) : null}
    </section>
  );
}
