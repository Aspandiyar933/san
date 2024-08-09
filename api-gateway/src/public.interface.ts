import mongoose from "mongoose";

interface IScene {
    topic: string;
    manimCode: string;
    audioUrl: string,
    videoUrl: string,
    status: string,
    createdAt: string
}

export { IScene };