import { DailyMealPlan, RecipeVideo } from "../types";
import { mealColorClass } from "../lib/appConfig";
import { getMealBalanceSummary, getMealServingDisplay } from "../lib/foodUtils";
import AppIcon from "./AppIcon";
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
          Save your profile to generate an AI-assisted day plan with realistic serving guidance, reminders, and groceries.
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
              const servingDisplay = getMealServingDisplay(meal);
              const balanceSummary = getMealBalanceSummary(meal);

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
                        <strong>{servingDisplay.primary}</strong>
                        {servingDisplay.secondary ? <p>{servingDisplay.secondary}</p> : null}
                      </div>

                      <div className="meal-balance-row">
                        <AppIcon name="balance" className="balance-icon" />
                        <span className="meal-balance-chip">{balanceSummary.label}</span>
                        {balanceSummary.detail ? <span className="meal-balance-copy">{balanceSummary.detail}</span> : null}
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
                      {servingDisplay.detail ? <p className="portion-copy">{servingDisplay.detail}</p> : null}
                    </div>

                    <div className="video-card">
                      <span className="video-title-row">
                        <AppIcon name="spark" className="video-title-icon" />
                        <span>Top recipe video</span>
                      </span>
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
