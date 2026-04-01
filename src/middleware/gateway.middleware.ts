import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import { getUsage, incrementUsage } from '../services/redis.service';

export const apiKeyAuth = async (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
        return res.status(401).json({ msg: 'API Key required' });
    }

    try {
        // Simple cache or database lookup
        const user = await User.findOne({ apiKey });
        if (!user) {
            return res.status(401).json({ msg: 'Invalid API Key' });
        }

        // Attach user to req
        // @ts-ignore
        req.user = user;

        // Plan Enforcement & Usage
        if (user.plan === 'premium') {
            // Unlimited
            return next();
        }

        const usageKey = `usage:${user._id}`;
        const usage = await getUsage(usageKey);

        // Check limits based on plan
        let limit = 30; // Free
        if (user.plan === 'basic') limit = 1000;
        if (user.plan === 'pro') limit = 10000;

        if (usage >= limit) {
            return res.status(402).json({ msg: 'Plan limit exceeded. Please upgrade.' });
        }

        await incrementUsage(usageKey);
        next();

    } catch (error) {
        console.error('Gateway Error:', error);
        res.status(500).json({ msg: 'Gateway Error' });
    }
};
