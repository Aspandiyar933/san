import { Request, Response, NextFunction } from "express";
import ManimService from "./services";
import dotenv from "dotenv";

dotenv.config();

const REDIS_URI = process.env.REDIS_URI || "";
const GITHUB_API = process.env.GITHUB_API || "";
const VOYAGE_API = process.env.VOYAGE_API_KEY || "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

const repos = [
  "https://github.com/Aspandiyar933/videos",
  "https://github.com/Aspandiyar933/manim-docs",
  "https://github.com/Aspandiyar933/Manim-Animations",
  "https://github.com/Aspandiyar933/Manim-Tutorials-2021",
  "https://github.com/Aspandiyar933/animations",
  "https://github.com/Aspandiyar933/Manim-Tutorial",
  "https://github.com/Aspandiyar933/MyAnimations",
  "https://github.com/Aspandiyar933/manim-unit-circle-trigonometry",
  "https://github.com/Aspandiyar933/AnimationsWithManim",
  "https://github.com/Aspandiyar933/manim-contrib",
  "https://github.com/Aspandiyar933/manim"
];

const manimService = new ManimService(REDIS_URI, repos, GITHUB_API, VOYAGE_API, ANTHROPIC_API_KEY);

export class ManimController {
    async generateManimCode(req: Request, res: Response, next: NextFunction) {
        try {
            const { topic } = req.body;
            if (!topic) {
                return res.status(400).json({ error: "Topic is required" });
            }

            const result = await manimService.generateAndSaveManimCode(topic);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    }

    async closeService() {
        await manimService.close();
    }
}

export const controller = new ManimController();