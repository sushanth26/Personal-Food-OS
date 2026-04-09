import { DailyMealPlan, RecipeVideo } from "../types";
import MealCard from "./MealCard";
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
        chips={plan ? [`${plan.meals.length} meals`, `${plan.totals.calories} kcal`, "video-guided"] : ["portion-first", "mobile-friendly", "real-life meals"]}
      />

      {planError ? <div className="empty-state error-state">{planError}</div> : null}

      {isGenerating ? (
        <div className="empty-state">
          Building a plan that fits your calories, macros, cuisine, diet, and prep style.
        </div>
      ) : null}

      {!plan && !planError && !isGenerating ? (
        <div className="empty-state">
          Save your profile to build a day plan with realistic serving guidance, reminders, and groceries.
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
              <MealCard key={meal.id} meal={meal} video={mealVideos[meal.id]} />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
