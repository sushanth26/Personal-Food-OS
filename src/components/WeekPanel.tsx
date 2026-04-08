import { RecipeVideo, WeeklyMealPlan } from "../types";
import { mealColorClass } from "../lib/appConfig";
import { formatDisplayDate, getMealPortionSummary } from "../lib/foodUtils";

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
            {weekPlan.days.map((day) => (
              <details key={day.date} className="week-day-card" open={day.date === weekPlan.startDate}>
                <summary className="week-day-summary">
                  <div>
                    <p className="section-kicker">Day</p>
                    <h3>{formatDisplayDate(day.date)}</h3>
                    <p className="portion-copy">{day.meals.map((meal) => meal.name).join(" • ")}</p>
                  </div>
                  <div className="week-day-meta">
                    <strong>{day.totals.calories} kcal</strong>
                    <span>
                      {day.totals.protein}P / {day.totals.carbs}C / {day.totals.fat}F
                    </span>
                  </div>
                </summary>

                <div className="week-day-actions">
                  <button className="ghost-button" onClick={() => onRegenerateDay(day.date)} disabled={isGeneratingWeek}>
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
                      </article>
                    );
                  })}
                </div>
              </details>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
