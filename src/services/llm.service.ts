import axios from 'axios';

// Simple interface for LLM responses
export interface LLMResponse {
    text: string;
}

export interface ImageAttachment {
    type: 'image';
    name: string;
    mediaType: string;
    dataUrl: string;
}

const openAIResponsesUrl = 'https://api.openai.com/v1/responses';
const openAIEmbeddingsUrl = 'https://api.openai.com/v1/embeddings';

export const generateEmbedding = async (text: string): Promise<number[]> => {
    if (!process.env.OPENAI_API_KEY) {
        return [];
    }

    try {
        const response = await axios.post(
            openAIEmbeddingsUrl,
            {
                input: text,
                model: 'text-embedding-3-small'
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        return response.data.data[0].embedding;
    } catch (error) {
        console.error('Embedding Error:', error);
        return [];
    }
};

const extractOpenAIText = (data: any): string => {
    const outputText = data?.output_text;
    if (typeof outputText === 'string' && outputText.trim()) {
        return outputText.trim();
    }

    const parts = data?.output?.flatMap((item: any) =>
        item?.content?.map((content: any) => content?.text).filter(Boolean) || []
    ) || [];

    return parts.join('\n').trim();
};

export const generateCompletion = async (
    prompt: string,
    modelType: string = 'gpt-4.1-mini',
    systemPrompt?: string,
    attachments: ImageAttachment[] = []
): Promise<string> => {
    // 1. Try OpenAI
    if (process.env.OPENAI_API_KEY) {
        try {
            const userContent = [
                { type: 'input_text', text: prompt },
                ...attachments.map((attachment) => ({
                    type: 'input_image',
                    image_url: attachment.dataUrl
                }))
            ];

            const input = [
                ...(systemPrompt ? [{ role: 'system', content: [{ type: 'input_text', text: systemPrompt }] }] : []),
                { role: 'user', content: userContent }
            ];

            const response = await axios.post(
                openAIResponsesUrl,
                {
                    model: modelType,
                    input,
                    max_output_tokens: 3000,
                    temperature: 0.7
                },
                {
                    headers: {
                        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const text = extractOpenAIText(response.data);
            if (text) {
                return text;
            }
        } catch (error) {
            console.error('OpenAI Error:', error);
            // Fallthrough to next provider or fail
        }
    }

    // 2. Try Gemini
    if (process.env.GEMINI_API_KEY) {
        try {
            // Using Gemini 1.5 Flash or Pro via REST API
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
            const response = await axios.post(url, {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    maxOutputTokens: 8192, // Allow very large responses
                    temperature: 0.7
                }
            });
            // Gemini response structure
            return response.data.candidates[0].content.parts[0].text;
        } catch (error) {
            console.error('Gemini Error:', error);
        }
    }

    // 3. Fallback Mock (Must be valid format for whatever caller expects, usually JSON for auto-import)
    console.warn("Using Local Fallback AI (No Keys or Keys Failed)");
    // Return a mock JSON for auto-import testing
    if (prompt.includes("JSON Array")) {
        return JSON.stringify([
            { prompt: "What is the capital of France?", response: "Paris." },
            { prompt: "Who wrote Romeo and Juliet?", response: "William Shakespeare." },
            { prompt: "What is 2 + 2?", response: "4." }
        ]);
    }

    return "Local Fallback Response: AI not configured.";
};
