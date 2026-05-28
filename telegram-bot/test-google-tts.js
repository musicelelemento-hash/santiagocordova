
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
require('dotenv').config();

async function testGoogleTTS() {
    console.log("🎙️ Testing Google Cloud TTS...");
    
    let credentials;
    try {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

        if (projectId && clientEmail && privateKey) {
            credentials = { 
                project_id: projectId, 
                client_email: clientEmail, 
                private_key: privateKey 
            };
            console.log("✅ Credentials found in .env");
        } else {
            console.warn("⚠️ No detailed credentials in .env, checking ADC...");
        }

        const client = new TextToSpeechClient(credentials ? { credentials } : {});
        
        const request = {
            input: { text: "Esto es una prueba de Google Cloud, Santiago. Baku." },
            voice: { languageCode: 'es-US', name: 'es-US-Studio-B', ssmlGender: 'FEMALE' },
            audioConfig: { audioEncoding: 'MP3' },
        };

        const [response] = await client.synthesizeSpeech(request);
        console.log("✅ Google Cloud TTS successful! Audio content length:", response.audioContent.length);
    } catch (error) {
        console.error("❌ Google Cloud TTS Error:", error.message);
        if (error.code === 7) {
            console.error("💡 Hint: API might not be enabled or permission denied.");
        }
    }
}

testGoogleTTS();
