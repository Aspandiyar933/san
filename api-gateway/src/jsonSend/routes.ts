import express from 'express';
import { controller } from './controller';  // Adjust the import path as necessary

const router = express.Router();

// Routes
router.post('/generate', controller.generateManimCode.bind(controller));

export default router;