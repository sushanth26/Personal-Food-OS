import { describe, expect, it } from "vitest";
import { deriveMacroTargets, estimateDailyCalories } from "./planner";

describe("planner utilities", () => {
  it("estimates calories from user stats and goal", () => {
    const calories = estimateDailyCalories({
      sex: "female",
      age: 29,
      heightCm: 165,
      weightKg: 62,
      activityLevel: "light",
      goal: "lose"
    });

    expect(calories).toBe(1500);
  });

  it("derives consistent macro targets from a preset split", () => {
    const targets = deriveMacroTargets(2000, "split", "high_protein");
    expect(targets).toEqual({ protein: 175, carbs: 175, fat: 66.7 });
  });
});
