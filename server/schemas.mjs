import { z } from "zod";

export const aiMealPlanSchema = z.object({
  date: z.string(),
  meals: z.array(
    z.object({
      mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
      name: z.string(),
      serving: z.object({
        primary: z.string(),
        secondary: z.string().optional()
      }),
      totalCalories: z.number().nonnegative(),
      totalProtein: z.number().nonnegative(),
      totalCarbs: z.number().nonnegative(),
      totalFat: z.number().nonnegative(),
      ingredients: z.array(
        z.object({
          ingredientName: z.string(),
          quantity: z.number().positive(),
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
          serving: {
            type: "object",
            additionalProperties: false,
            properties: {
              primary: { type: "string" },
              secondary: { type: "string" }
            },
            required: ["primary"]
          },
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
          "serving",
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

export const aiMealPlanReviewSchema = z.object({
  meals: z.array(
    z.object({
      mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
      name: z.string(),
      isBalanced: z.boolean(),
      hasRealAccompaniment: z.boolean(),
      notes: z.string()
    })
  )
});

export const aiMealPlanReviewJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    meals: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          mealType: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] },
          name: { type: "string" },
          isBalanced: { type: "boolean" },
          hasRealAccompaniment: { type: "boolean" },
          notes: { type: "string" }
        },
        required: ["mealType", "name", "isBalanced", "hasRealAccompaniment", "notes"]
      }
    }
  },
  required: ["meals"]
};
