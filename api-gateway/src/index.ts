import express, { Request, Response } from "express";
import Database from "./db";
import globalRouter from "./global-router";
import { logger } from "./logger";
import cors from "cors";

const app = express();

const PORT: number = 3001;

app.use(
  cors({
    origin: ["http://yourapp.com", "http://localhost:5173"],
  })
);

const conn = new Database();

conn
  .connect()
  .then(() => {
    console.log("Database connection check completed");
  })
  .catch((error: any) => {
    console.error("Error during database connection check:", error);
  });

app.use(logger);
app.use(express.json());
app.use("/api/v1/", globalRouter);

app
  .listen(PORT, () => {
    console.log(`It is alive on http://localhost:${PORT}`);
  })
  .on("error", (err: Error) => {
    console.error("Error starting server:", err);
  });
