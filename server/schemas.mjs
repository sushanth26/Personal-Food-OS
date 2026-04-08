import { z } from "zod";

export const aiMealPlanSchema = z.object({
  date: z.string(),
  meals: z.array(
    z.object({
      mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
      name: z.string(),
      totalCalories: z.number(),
      totalProtein: z.number(),
      totalCarbs: z.number(),
      totalFat: z.number(),
      ingredients: z.array(
        z.object({
          ingredientName: z.string(),
          quantity: z.number(),
          unit: z.literal("g")
        })
      )
    })
  )
});

export const aiMealPlanJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    date: { type: "string" },
    meals: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          mealType: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] },
          name: { type: "string" },
          totalCalories: { type: "number" },
          totalProtein: { type: "number" },
          totalCarbs: { type: "number" },
          totalFat: { type: "number" },
          ingredients: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                ingredientName: { type: "string" },
                quantity: { type: "number" },
                unit: { type: "string", enum: ["g"] }
              },
              required: ["ingredientName", "quantity", "unit"]
            }
          }
        },
        required: [
          "mealType",
          "name",
          "totalCalories",
          "totalProtein",
          "totalCarbs",
          "totalFat",
          "ingredients"
        ]
      }
    }
  },
  required: ["date", "meals"]
};

export const aiGroceryNormalizationSchema = z.object({
  items: z.array(
    z.object({
      rawName: z.string(),
      canonicalName: z.string(),
      category: z.enum(["fruits", "vegetables", "dry_items"])
    })
  )
});

export const aiGroceryNormalizationJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          rawName: { type: "string" },
          canonicalName: { type: "string" },
          category: { type: "string", enum: ["fruits", "vegetables", "dry_items"] }
        },
        required: ["rawName", "canonicalName", "category"]
      }
    }
  },
  required: ["items"]
};
