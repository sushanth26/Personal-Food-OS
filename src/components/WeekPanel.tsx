import { RecipeVideo, WeeklyMealPlan } from "../types";
import { formatDisplayDate } from "../lib/foodUtils";
import MealCard from "./MealCard";
import PanelHero from "./PanelHero";

type WeekPanelProps = {
  weekPlan: WeeklyMealPlan | null;
  weekError: string | null;
  isGeneratingWeek: boolean;
  mealVideos: Record<string, RecipeVideo | null>;
  onRegenerateWeek: () => void;
  onRegenerateDay: (date: string) => void;
};

export default function WeekPanel({
  weekPlan,
  weekError,
  isGeneratingWeek,
  mealVideos,
  onRegenerateWeek,
  onRegenerateDay
}: WeekPanelProps) {
  return (
    <section className="panel panel-week active-panel">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">7-day plan</p>
          <h2>Your weekly structure</h2>
        </div>
        <button className="ghost-button" onClick={onRegenerateWeek} disabled={isGeneratingWeek}>
          {isGeneratingWeek ? "Building week..." : "Regenerate week"}
        </button>
      </div>

      <PanelHero
        tone="week"
        kicker="Weekly arc"
        title="See the whole rhythm before the week begins"
        chips={
          weekPlan
            ? [
                `${weekPlan.days.length} days`,
                `${Math.round(weekPlan.totals.calories / weekPlan.days.length)} kcal / day`,
                `${Math.round(weekPlan.totals.protein / weekPlan.days.length)}P / ${Math.round(weekPlan.totals.carbs / weekPlan.days.length)}C / ${Math.round(weekPlan.totals.fat / weekPlan.days.length)}F`
              ]
            : ["week builder", "variety-aware", "leftover-friendly"]
        }
      />

      {weekError ? <div className="empty-state error-state">{weekError}</div> : null}

      {isGeneratingWeek ? (
        <div className="empty-state">
          Building your 7-day plan. Weekly plans take longer because the app generates each day with variety in mind.
        </div>
      ) : null}

      {!weekPlan && !weekError && !isGeneratingWeek ? (
        <div className="empty-state">
          Build a weekly plan to see 7 days of meals, one combined grocery list, and lighter repetition across the
          week.
        </div>
      ) : null}

      {weekPlan && !isGeneratingWeek ? (
        <>
          <p className="planner-note">{weekPlan.note}</p>

          <div className="week-list">
            {weekPlan.days.map((day) => {
              const breakfast = day.meals.find((meal) => meal.mealType === "breakfast");
              const lunch = day.meals.find((meal) => meal.mealType === "lunch");
              const dinner = day.meals.find((meal) => meal.mealType === "dinner");
              const snack = day.meals.find((meal) => meal.mealType === "snack");

              return (
                <details key={day.date} className="week-day-card">
                  <summary className="week-day-summary">
                    <div className="week-day-summary-copy">
                      <h3>{formatDisplayDate(day.date)}</h3>
                      <div className="week-meal-outline">
                        {breakfast ? (
                          <div className="week-meal-outline-row">
                            <span>Breakfast</span>
                            <strong>{breakfast.name}</strong>
                          </div>
                        ) : null}
                        {lunch ? (
                          <div className="week-meal-outline-row">
                            <span>Lunch</span>
                            <strong>{lunch.name}</strong>
                          </div>
                        ) : null}
                        {dinner ? (
                          <div className="week-meal-outline-row">
                            <span>Dinner</span>
                            <strong>{dinner.name}</strong>
                          </div>
                        ) : null}
                        {snack ? (
                          <div className="week-meal-outline-row">
                            <span>Snack</span>
                            <strong>{snack.name}</strong>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </summary>

                  <div className="week-day-actions">
                    <button className="ghost-button" onClick={() => onRegenerateDay(day.date)} disabled={isGeneratingWeek}>
                      Refresh this day
                    </button>
                  </div>

                  <div className="week-meal-grid">
                    {day.meals.map((meal) => (
                      <MealCard key={meal.id} meal={meal} video={mealVideos[meal.id]} />
                    ))}
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
