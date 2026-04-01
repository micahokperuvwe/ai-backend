import { Request, Response } from 'express';
import { processAIRequest } from '../services/ai.service';
import { executeAgentCommand } from '../services/agent.service';
import { incrementUsage } from '../services/redis.service';

export const chat = async (req: Request, res: Response) => {
    const { message, attachments = [] } = req.body;
    const user = req.user;

    if (!user) {
        return res.status(401).json({ msg: 'Not authorized' });
    }

    try {
        const result = await processAIRequest(String(user._id), message, attachments);
        res.json(result);
    } catch (error) {
        console.error('Chat Error:', error);
        res.status(500).json({ msg: 'AI Service Error' });
    }
};

export const runAgent = async (req: Request, res: Response) => {
    const { command } = req.body;
    const user = req.user;

    if (!user) {
        return res.status(401).json({ msg: 'Not authorized' });
    }

    // Double check plan (Middleware should handle, but extra safety)
    if (user.plan !== 'premium' && user.apiKeyUses !== -1) {
        return res.status(403).json({ msg: 'Agent mode requires Premium plan' });
    }

    try {
        const output = await executeAgentCommand(String(user._id), command);
        res.json({ output });
    } catch (error) {
        res.status(400).json({ msg: (error as Error).message });
    }
};

export const generateStudyMaterial = async (req: Request, res: Response) => {
    const { topic, type } = req.body; // type: 'notes' | 'quiz' | 'flashcards'
    const user = req.user;

    if (!user) {
        return res.status(401).json({ msg: 'Not authorized' });
    }

    let prompt = '';
    if (type === 'notes') prompt = `Generate detailed study notes for: ${topic}`;
    else if (type === 'quiz') prompt = `Generate a 5-question multiple choice quiz for: ${topic}. Return JSON.`;
    else if (type === 'flashcards') prompt = `Generate 10 flashcards (front/back) for: ${topic}. Return JSON.`;
    else return res.status(400).json({ msg: 'Invalid type' });

    try {
        const result = await processAIRequest(String(user._id), prompt);
        // Note: In a real app we might parse JSON here if requested
        res.json({ content: result.response, source: result.source, matchedMemoryIds: result.matchedMemoryIds });
    } catch (error) {
        res.status(500).json({ msg: 'Generation Error' });
    }
};

export const getPublicMemories = async (req: Request, res: Response) => {
    try {
        const memories = await import('../models/AIMemory').then(m => m.default.find({ type: 'trained' }).select('prompt _id'));
        res.json(memories);
    } catch (error) {
        res.status(500).json({ msg: 'Server Error' });
    }
};
