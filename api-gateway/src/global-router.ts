import { Router } from "express";
import router from "./jsonSend/routes"; 

const globalRouter = Router();

globalRouter.use(router);

export default globalRouter; 