
const axios = require('axios');
require('dotenv').config({ path: 'c:/Users/Santiago/Documents/Visual Code Antigraviti/SantiagoCordova.com/telegram-bot/.env' });

async function testTTS() {
    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    const ELEVENLABS_VOICE_ID = 'pNInz6obpgDQGKAiW9jL'; // Adam (Free/Pre-made)
    
    if (!ELEVENLABS_API_KEY) {
        console.error("❌ No ELEVENLABS_API_KEY found in .env");
        return;
    }

    console.log(`🔍 Testing ElevenLabs API with Voice ID: ${ELEVENLABS_VOICE_ID}`);
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`;

    try {
        const response = await axios.post(url, {
            text: "He comprobado tu conexión, Santiago. Baku.",
            model_id: "eleven_multilingual_v2",
            voice_settings: { stability: 0.5, similarity_boost: 0.75 }
        }, {
            headers: {
                'Accept': 'audio/mpeg',
                'xi-api-key': ELEVENLABS_API_KEY,
                'Content-Type': 'application/json'
            },
            responseType: 'arraybuffer'
        });

        console.log("✅ ElevenLabs TTS successful! Buffer length:", response.data.byteLength);
    } catch (error) {
        if (error.response) {
            console.error("❌ ElevenLabs API Error:", error.response.status, error.response.data.toString());
        } else {
            console.error("❌ Request Error:", error.message);
        }
    }
}

testTTS();
