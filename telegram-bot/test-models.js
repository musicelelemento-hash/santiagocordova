require('dotenv').config();
const { OpenAI } = require('openai');

const openRouterClient = new OpenAI({ 
    baseURL: 'https://openrouter.ai/api/v1', 
    apiKey: process.env.OPENROUTER_API_KEY 
});

const tools = [
    {
        type: "function",
        function: {
            name: "get_database_summary",
            description: "Proporciona un resumen global",
            parameters: { type: "object", properties: {} }
        }
    }
];

const modelsToTest = [
    'google/gemini-2.5-flash-lite-preview-02-05:free', // Try the newest lite
    'google/gemini-2.0-flash-lite-preview-02-05:free',
    'google/gemini-2.0-pro-exp-02-05:free', // Often available but might not support tools well
    'meta-llama/llama-3-8b-instruct:free', // Very small, usually very reliable
    'meta-llama/llama-3.1-8b-instruct:free',
    'mistralai/mistral-7b-instruct:free', // Mistral is usually a solid fallback
    'sophosympatheia/rogue-rose-103b-v0.2:free' // Random free model as absolute last resort
];

async function main() {
    console.log("---- Testing OpenRouter Free Models ----\n");
    
    for (const model of modelsToTest) {
        console.log(`Testing: ${model}`);
        try {
            const r = await openRouterClient.chat.completions.create({
                messages: [{ role: 'user', content: 'hello' }],
                model: model,
                tools: tools,
                tool_choice: "auto",
                max_tokens: 20
            });
            console.log(`✅ SUCCESS: ${model}`);
            console.log(`Response: ${r.choices[0].message.content || 'Tool Called'}\n`);
            // Stop on the first working model
            break; 
        } catch (e) {
            console.error(`❌ FAILED: ${model}`);
            console.error("Reason:", e.message);
            if (e.error) console.error("Raw:", JSON.stringify(e.error));
            console.log("------------------------\n");
        }
    }
}
main();
