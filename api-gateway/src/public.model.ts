import mongoose, { Model, Schema } from "mongoose";
import { IScene } from "./public.interface";

const SceneSchema: Schema = new Schema({
  topic: { type: String, required: true },
  manimCode: { type: String, required: true },
  audioUrl: { type: String, default: "" },
  videoUrl: { type: String, default: "" },
  status: { type: String, required: true, enum: ["pending", "generated", "processing", "completed", "error"] },
  createdAt: { type: String, default: () => new Date().toISOString() }
}, {
  timestamps: true // Adds createdAt and updatedAt timestamps
});

const Scene: Model<IScene> = mongoose.model<IScene>('Scene', SceneSchema);

export default Scene;