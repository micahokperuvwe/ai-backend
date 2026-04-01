import AIMemory, { IAIMemory } from '../models/AIMemory';
import { generateCompletion, generateEmbedding, ImageAttachment } from './llm.service';
import { cacheData, getCachedData } from './redis.service';

type AIResponseSource = 'trained-memory' | 'memory-grounded-ai' | 'external-ai' | 'fallback-ai';

export interface ProcessedAIResult {
    response: string;
    source: AIResponseSource;
    matchedMemoryIds: string[];
    matchedMemories: Array<{
        id: string;
        prompt: string;
        response: string;
        type: IAIMemory['type'];
    }>;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const tokenize = (value: string): string[] => value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);

const scoreMemory = (prompt: string, memory: IAIMemory): number => {
    const normalizedPrompt = prompt.toLowerCase();
    const memoryPrompt = memory.prompt.toLowerCase();
    const memoryResponse = memory.response.toLowerCase();

    if (memoryPrompt === normalizedPrompt) return 100;
    if (memoryPrompt.includes(normalizedPrompt)) return 90;
    if (normalizedPrompt.includes(memoryPrompt)) return 80;

    const promptTokens = new Set(tokenize(prompt));
    const memoryTokens = tokenize(`${memory.prompt} ${memory.response}`);
    const overlap = memoryTokens.filter((token) => promptTokens.has(token)).length;

    return overlap + (memory.type === 'trained' ? 5 : 0);
};

const findRelevantMemories = async (prompt: string): Promise<IAIMemory[]> => {
    const escapedPrompt = escapeRegExp(prompt.trim());
    const promptTokens = tokenize(prompt);

    const exactMatch = await AIMemory.findOne({
        type: 'trained',
        prompt: { $regex: new RegExp(`^${escapedPrompt}$`, 'i') }
    });

    if (exactMatch) {
        return [exactMatch];
    }

    const keywordPatterns = promptTokens.slice(0, 8).map((token) => new RegExp(escapeRegExp(token), 'i'));
    const orConditions = [
        { prompt: { $regex: new RegExp(escapedPrompt, 'i') } },
        { response: { $regex: new RegExp(escapedPrompt, 'i') } },
        ...keywordPatterns.map((pattern) => ({ prompt: { $regex: pattern } })),
        ...keywordPatterns.map((pattern) => ({ response: { $regex: pattern } }))
    ];

    const candidates = await AIMemory.find({ $or: orConditions }).sort({ createdAt: -1 }).limit(20);

    return candidates
        .map((memory) => ({ memory, score: scoreMemory(prompt, memory) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map((item) => item.memory);
};

const buildMemoryContext = (memories: IAIMemory[]) => memories
    .map((memory, index) => `Memory ${index + 1}\nQuestion: ${memory.prompt}\nAnswer: ${memory.response}`)
    .join('\n\n');

const upsertSemanticMemory = async (prompt: string, response: string, embedding: number[]) => {
    await AIMemory.findOneAndUpdate(
        { prompt, type: 'semantic' },
        {
            prompt,
            response,
            embedding,
            type: 'semantic'
        },
        {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
        }
    );
};

export const processAIRequest = async (
    userId: string,
    prompt: string,
    attachments: ImageAttachment[] = []
): Promise<ProcessedAIResult> => {
    const cacheKey = attachments.length === 0
        ? `ai_response:${prompt.toLowerCase().trim()}`
        : '';
    const cached = await getCachedData(cacheKey) as ProcessedAIResult | null;
    if (cacheKey && cached) return cached;

    const matchedMemories = await findRelevantMemories(prompt);
    const matchedMemoryIds = matchedMemories.map((memory) => String(memory._id));
    const matchedMemorySummaries = matchedMemories.map((memory) => ({
        id: String(memory._id),
        prompt: memory.prompt,
        response: memory.response,
        type: memory.type
    }));

    if (matchedMemories.length > 0 && !process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
        const directMemoryResult: ProcessedAIResult = {
            response: matchedMemories[0].response,
            source: 'trained-memory',
            matchedMemoryIds,
            matchedMemories: matchedMemorySummaries
        };
        await cacheData(cacheKey, directMemoryResult);
        return directMemoryResult;
    }

    if (matchedMemories.length > 0 && (process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY)) {
        const groundedPrompt = [
            'Use the memory records below as your main source of truth.',
            'If the answer is present in memory, answer using that information clearly and naturally.',
            'If the memory is incomplete, say what is known from memory and then add a brief helpful answer.',
            '',
            buildMemoryContext(matchedMemories),
            '',
            `User question: ${prompt}`
        ].join('\n');

        const groundedResponse = await generateCompletion(
            groundedPrompt,
            'gpt-4.1-mini',
            'You are an educational assistant. Prefer the provided memory context over guessing.',
            attachments
        );

        if (groundedResponse && !groundedResponse.startsWith('Local Fallback Response')) {
            const groundedEmbedding = await generateEmbedding(prompt);
            await upsertSemanticMemory(prompt, groundedResponse, groundedEmbedding);

            const groundedResult: ProcessedAIResult = {
                response: groundedResponse,
                source: 'memory-grounded-ai',
                matchedMemoryIds,
                matchedMemories: matchedMemorySummaries
            };
            if (cacheKey) {
                await cacheData(cacheKey, groundedResult);
            }
            return groundedResult;
        }
    }

    const embedding = await generateEmbedding(prompt);
    const aiResponse = await generateCompletion(prompt, 'gpt-4.1-mini', undefined, attachments);
    const source: AIResponseSource = aiResponse.startsWith('Local Fallback Response')
        ? 'fallback-ai'
        : 'external-ai';

    if (!aiResponse.startsWith("Error") && source !== 'fallback-ai') {
        await upsertSemanticMemory(prompt, aiResponse, embedding);

        const result: ProcessedAIResult = {
            response: aiResponse,
            source,
            matchedMemoryIds,
            matchedMemories: matchedMemorySummaries
        };
        if (cacheKey) {
            await cacheData(cacheKey, result);
        }
        return result;
    }

    if (!aiResponse.startsWith("Error")) {
        const result: ProcessedAIResult = {
            response: aiResponse,
            source,
            matchedMemoryIds,
            matchedMemories: matchedMemorySummaries
        };
        if (cacheKey) {
            await cacheData(cacheKey, result);
        }
        return result;
    }

    return {
        response: aiResponse,
        source,
        matchedMemoryIds,
        matchedMemories: matchedMemorySummaries
    };
};
