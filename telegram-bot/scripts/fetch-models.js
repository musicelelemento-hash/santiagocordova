const axios = require('axios');
const { OpenAI } = require('openai');
require('dotenv').config();

const openRouterClient = new OpenAI({ 
    baseURL: 'https://openrouter.ai/api/v1', 
    apiKey: process.env.OPENROUTER_API_KEY 
});

const tools = [{ type: 'function', function: { name: 'test_tool', description: 'test', parameters: { type: 'object', properties: {} } } }];

async function main() {
    console.log("Fetching models...");
    try {
        const res = await axios.get('https://openrouter.ai/api/v1/models');
        const freeModels = res.data.data.filter(m => m.pricing.prompt == '0' || m.pricing.prompt == '0.0');
        console.log(`Found ${freeModels.length} free models. Testing 10...`);
        
        for (const m of freeModels.slice(0, 10)) {
            console.log(`Testing: ${m.id}`);
            try {
                const r = await openRouterClient.chat.completions.create({
                    messages: [{ role: 'user', content: 'hello' }],
                    model: m.id,
                    tools: tools,
                    tool_choice: 'auto',
                    max_tokens: 10
                });
                console.log(`✅ SUCCESS: ${m.id}`);
                console.log("Response:", r.choices[0].message.content || 'Tool Called');
                break;
            } catch (e) {
                console.log(`❌ FAILED: ${m.id} - ${e.message}`);
                // Continue to next model
            }
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}
main();
