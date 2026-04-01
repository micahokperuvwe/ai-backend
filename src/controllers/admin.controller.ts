import { Request, Response } from 'express';
import User from '../models/User';
import AIMemory from '../models/AIMemory';
import AgentLog from '../models/AgentLog';

export const getUsers = async (req: Request, res: Response) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ msg: 'Server Error' });
    }
};

export const getStats = async (req: Request, res: Response) => {
    try {
        const userCount = await User.countDocuments();
        const memoryCount = await AIMemory.countDocuments();
        const agentLogCount = await AgentLog.countDocuments();

        res.json({
            users: userCount,
            memories: memoryCount,
            agentLogs: agentLogCount
        });
    } catch (error) {
        res.status(500).json({ msg: 'Server Error' });
    }
};

export const addMemory = async (req: Request, res: Response) => {
    const { prompt, response } = req.body;
    try {
        const { generateEmbedding } = await import('../services/llm.service');
        const embedding = await generateEmbedding(prompt);
        const newMemory = await AIMemory.create({
            prompt,
            response,
            embedding,
            type: 'trained'
        });
        res.status(201).json(newMemory);
    } catch (error) {
        res.status(500).json({ msg: 'Server Error' });
    }
};

export const getMemories = async (req: Request, res: Response) => {
    try {
        const memories = await AIMemory.find().sort({ createdAt: -1 }).limit(100);
        res.json(memories);
    } catch (error) {
        res.status(500).json({ msg: 'Server Error' });
    }
};

export const deleteMemory = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        await AIMemory.findByIdAndDelete(id);
        res.json({ msg: 'Memory deleted' });
    } catch (error) {
        res.status(500).json({ msg: 'Server Error' });
    }
};

export const getAgentLogs = async (req: Request, res: Response) => {
    try {
        const logs = await AgentLog.find().populate('userId', 'email').sort({ timestamp: -1 }).limit(100);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ msg: 'Server Error' });
    }
};

export const autoAddMemory = async (req: Request, res: Response) => {
    const { content, count } = req.body;
    try {
        if (!content) return res.status(400).json({ msg: 'Content text required' });

        const targetCount = count || 10;
        const { generateCompletion, generateEmbedding } = await import('../services/llm.service');
        const prompt = `Analyze the following text and generate ${targetCount} detailed question and answer pairs suitable for an educational AI memory database. 
        Format the output STRICKLY as a JSON Array of objects with keys "prompt" and "response". 
        Example: [{"prompt": "What is ...?", "response": "..."}]
        Text: ${content}`;

        const aiResponse = await generateCompletion(prompt);
        let validJson = [];

        try {
            // Attempt to clean markdown code blocks if present
            const cleanJson = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            validJson = JSON.parse(cleanJson);
        } catch (e) {
            // Fallback: try raw response or fail softly
            console.warn('Failed to parse AI JSON', aiResponse);
            return res.status(500).json({ msg: 'AI failed to generate valid JSON structure' });
        }

        if (!Array.isArray(validJson)) {
            return res.status(500).json({ msg: 'AI output format invalid' });
        }

        const createdMemories = [];
        for (const item of validJson) {
            if (item.prompt && item.response) {
                const embedding = await generateEmbedding(item.prompt);
                const newMem = await AIMemory.create({
                    prompt: item.prompt,
                    response: item.response,
                    embedding,
                    type: 'trained'
                });
                createdMemories.push(newMem);
            }
        }

        res.json({ msg: `Successfully imported ${createdMemories.length} memories`, memories: createdMemories });

    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Server Error during extraction' });
    }
};

export const updateUserExpiry = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { date } = req.body; // Expects ISO date string
    try {
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ msg: 'User not found' });

        user.planExpiry = new Date(date);
        await user.save();
        res.json(user);
    } catch (error) {
        res.status(500).json({ msg: 'Server Error' });
    }
};
