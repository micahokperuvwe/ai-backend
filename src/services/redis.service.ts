import redisClient from '../config/redis';

export const cacheData = async (key: string, data: any, ttl: number = 3600) => {
    try {
        await redisClient.setEx(key, ttl, JSON.stringify(data));
    } catch (error) {
        console.error('Redis Cache Error:', error);
    }
};

export const getCachedData = async (key: string) => {
    try {
        const data = await redisClient.get(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Redis Get Error:', error);
        return null;
    }
};

export const incrementUsage = async (key: string): Promise<number> => {
    try {
        const usage = await redisClient.incr(key);
        // Set expiry if new key (e.g., monthly limit reset handled elsewhere, but for safety)
        // For simple daily/window limits, we might use setEx here if not exists.
        return usage;
    } catch (error) {
        console.error('Redis Incr Error:', error);
        return 0;
    }
};

export const getUsage = async (key: string): Promise<number> => {
    try {
        const usage = await redisClient.get(key);
        return usage ? parseInt(usage) : 0;
    } catch (error) {
        console.error('Redis Get Usage Error:', error);
        return 0;
    }
};
