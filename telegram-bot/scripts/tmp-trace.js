require('dotenv').config();
const Groq = require('groq-sdk');
const { OpenAI } = require('openai');

const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
const openRouterClient = new OpenAI({ 
    baseURL: 'https://openrouter.ai/api/v1', 
    apiKey: process.env.OPENROUTER_API_KEY 
});

const tools = [
    {
        type: "function",
        function: {
            name: "get_database_summary",
            description: "Proporciona un resumen global de toda la cartera",
            parameters: { type: "object", properties: {} }
        }
    }
];

async function main() {
    console.log("---- Testing Keys and Models ----");
    
    // Check Groq
    console.log("\n1. Testing GROQ...");
    try {
        const r = await groqClient.chat.completions.create({
            messages: [{ role: 'user', content: 'hola baku' }],
            model: 'llama-3.3-70b-versatile',
            tools: tools,
            tool_choice: "auto",
        });
        console.log('✅ Groq OK:', r.choices[0].message.content || 'Called tools');
    } catch (e) {
        console.error('❌ Groq Error Details:');
        console.error('- Message:', e.message);
        console.error('- Status:', e.status);
        if (e.error) console.error('- Raw Error:', JSON.stringify(e.error));
    }

    // Check OpenRouter
    console.log("\n2. Testing OpenRouter...");
    try {
        const r2 = await openRouterClient.chat.completions.create({
            messages: [{ role: 'user', content: 'hola baku' }],
            model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free',
            tools: tools,
            tool_choice: "auto",
        });
        console.log('✅ OpenRouter OK:', r2.choices[0].message.content || 'Called tools');
    } catch (e) {
        console.error('❌ OpenRouter Error Details:');
        console.error('- Message:', e.message);
        console.error('- Status:', e.status);
        if (e.error) console.error('- Raw Error:', JSON.stringify(e.error));
    }
}
main();
