import { PlannedMeal, RecipeVideo } from "../types";
import { mealColorClass } from "../lib/appConfig";
import { getMealBalanceSummary, getMealServingDisplay } from "../lib/foodUtils";
import AppIcon from "./AppIcon";

type MealCardProps = {
  meal: PlannedMeal;
  video: RecipeVideo | null | undefined;
};

export default function MealCard({ meal, video }: MealCardProps) {
  const servingDisplay = getMealServingDisplay(meal);
  const balanceSummary = getMealBalanceSummary(meal);

  return (
    <article className={`meal-card shared-meal-card ${mealColorClass[meal.mealType]}`}>
      <div className="meal-card-topline">
        <p className="meal-type">{meal.mealType}</p>
        <div className="meal-card-meta">
          <span className="meal-balance-chip">{balanceSummary.label}</span>
          <span className="meal-kcal-chip">{meal.totalCalories} kcal</span>
        </div>
      </div>

      <div className="meal-card-copy">
        <h3>{meal.name}</h3>
        <div className="meal-serving-block">
          <span>Eat</span>
          <strong>{servingDisplay.primary}</strong>
          {servingDisplay.secondary ? <p>{servingDisplay.secondary}</p> : null}
        </div>
        {balanceSummary.detail ? (
          <div className="meal-support-row">
            <AppIcon name="balance" className="balance-icon" />
            <span>{balanceSummary.detail}</span>
          </div>
        ) : null}
        {servingDisplay.detail ? <p className="meal-detail-copy">{servingDisplay.detail}</p> : null}
      </div>

      <div className="video-card meal-video-card">
        <span className="video-title-row">
          <AppIcon name="spark" className="video-title-icon" />
          <span>Top recipe video</span>
        </span>
        {video ? (
          <a className="video-link" href={video.url} target="_blank" rel="noreferrer">
            {video.thumbnailUrl ? <img className="video-thumb" src={video.thumbnailUrl} alt={video.title} /> : null}
            <div className="video-copy">
              <strong>{video.title}</strong>
              <p>
                {video.channelName}
                {video.duration ? ` • ${video.duration}` : ""}
              </p>
            </div>
          </a>
        ) : (
          <p className="portion-copy">Finding the best recipe video for this meal...</p>
        )}
      </div>
    </article>
  );
}
