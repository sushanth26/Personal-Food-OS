import express from "express";
import path from "node:path";
import { findRecipeVideo } from "./video.mjs";
import {
  generateDailyPlan,
  generateWeeklyPlan,
  normalizeGroceriesWithAI
} from "./planner.mjs";
import { client } from "./xaiClient.mjs";

export function createApp(distDir) {
  const app = express();

  app.use((_, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    next();
  });

  app.options("*", (_, res) => {
    res.sendStatus(204);
  });

  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_, res) => {
    res.json({ ok: true });
  });

  app.post("/api/meal-plan", async (req, res) => {
    try {
      const { profile, date } = req.body ?? {};
      if (!profile || !date) {
        return res.status(400).json({ error: "Missing profile or date." });
      }

      if (!client) {
        return res.status(503).json({ error: "We cannot create a plan right now." });
      }

      const plan = await generateDailyPlan(profile, date);
      return res.json({ plan });
    } catch (error) {
      console.error("meal-plan error", error);
      return res.status(502).json({ error: "We cannot create a plan right now." });
    }
  });

  app.post("/api/weekly-meal-plan", async (req, res) => {
    try {
      const { profile, startDate } = req.body ?? {};
      if (!profile || !startDate) {
        return res.status(400).json({ error: "Missing profile or startDate." });
      }

      if (!client) {
        return res.status(503).json({ error: "We cannot create a weekly plan right now." });
      }

      const weekPlan = await generateWeeklyPlan(profile, startDate);
      return res.json({ weekPlan });
    } catch (error) {
      console.error("weekly-meal-plan error", error);
      return res.status(502).json({ error: "We cannot create a weekly plan right now." });
    }
  });

  app.get("/api/recipe-video", async (req, res) => {
    try {
      const query = String(req.query.q ?? "").trim();
      if (!query) {
        return res.status(400).json({ error: "Missing query." });
      }

      const video = await findRecipeVideo(query);
      if (!video) {
        return res.status(404).json({ error: "No recipe video found." });
      }

      return res.json({ video });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to fetch a recipe video.";
      return res.status(500).json({ error: message });
    }
  });

  app.post("/api/normalize-groceries", async (req, res) => {
    if (!client) {
      return res.status(500).json({
        error: "XAI_API_KEY is not set on the server, so grocery normalization cannot run yet."
      });
    }

    try {
      const { items, cuisinePreference } = req.body ?? {};
      if (!Array.isArray(items) || !cuisinePreference) {
        return res.status(400).json({ error: "Missing items or cuisinePreference." });
      }

      const normalizedItems = await normalizeGroceriesWithAI(items, cuisinePreference);
      return res.json({ items: normalizedItems });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to normalize groceries.";
      return res.status(500).json({ error: message });
    }
  });

  app.use(express.static(distDir));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) {
      return next();
    }

    return res.sendFile(path.join(distDir, "index.html"));
  });

  return app;
}
