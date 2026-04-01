import { Router } from 'express';
import { chat, runAgent, generateStudyMaterial, getPublicMemories } from '../controllers/ai.controller';
import { protect } from '../middleware/auth.middleware';
import { apiKeyAuth } from '../middleware/gateway.middleware';

const router = Router();

// All AI routes require Protection (JWT) AND Gateway (API Key/Plan)
// The user might send API Key in header OR we rely on JWT user to find key?
// Requirement said: "API middleware: Read API key, look up user... if admin, ensure api_key_uses = -1..."
// But implementation plan says "Middleware (Plan Enforcement, API Key Validation)".
// We can use protect() to get user from JWT, then check plan/limits.
// OR we can use apiKeyAuth to get user from API Key.
// Let's support both or chain them. Ideally:
// If web UI -> JWT -> Check Plan/Usage associated with user.
// If external API -> API Key -> Check Plan/Usage.
// For now, let's assume Web UI uses JWT. We'll use a middleware that checks usage.
// We'll reuse apiKeyAuth logic but for JWT user if API Key is missing? 
// No, let's stick to simple: Use JWT for auth, and a new 'trackUsage' middleware that is like gateway but for logged in users.
// Actually, `apiKeyAuth` looks up user by key. `protect` looks up by token.
// Let's assume the frontend sends the API Key? Or the backend knows the user's limits.
// Let's use `protect` then a usage middleware. `apiKeyAuth` is good for external access.
// For this app (SPA + API), we likely use headers.

// Let's use a simpler composite middleware for the route:
// 1. protect (Validates User identity)
// 2. checkUsage (Checks plan/limits)

import { Request, Response, NextFunction } from 'express';
import { getUsage, incrementUsage } from '../services/redis.service';

const checkUsage = async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
        return res.status(401).json({ msg: 'Not authorized' });
    }

    if (user.plan === 'premium') return next();

    const usageKey = `usage:${user._id}`;
    const usage = await getUsage(usageKey);
    let limit = 30;
    if (user.plan === 'basic') limit = 1000;
    if (user.plan === 'pro') limit = 10000;

    if (usage >= limit) return res.status(402).json({ msg: 'Plan limit exceeded' });

    await incrementUsage(usageKey);
    next();
};

router.post('/chat', protect, checkUsage, chat);
router.post('/agent', protect, checkUsage, runAgent); // checkUsage might be redundant if Premium check is inside runAgent, but good for tracking
router.post('/generate', protect, checkUsage, generateStudyMaterial);
router.get('/memories', protect, getPublicMemories);

export default router;
