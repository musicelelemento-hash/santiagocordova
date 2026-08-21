// Script de un solo uso: genera las 3 imágenes de fondo de la apertura cinematográfica
// con Imagen (Gemini API) y las guarda como assets estáticos en public/images/hero/.
// No corre en producción ni en el navegador — el resultado se sirve como archivo normal.
//
// Uso:  node --env-file=.env.local scripts/generate-hero-images.mjs

import { GoogleGenAI } from '@google/genai';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error('Falta VITE_GEMINI_API_KEY. Corré con: node --env-file=.env.local scripts/generate-hero-images.mjs');
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

const OUT_DIR = path.resolve('public/images/hero');

const scenes = [
    {
        file: 'scene1-problema.jpg',
        prompt:
            'Ultra premium corporate abstract background, dark navy obsidian tones (#0B2149, #020617), ' +
            'fine cracked glass and fractured paper texture suggesting a compliance error, subtle warning amber light streak, ' +
            'cinematic rim lighting, minimalist, no text, no people, financial technology aesthetic, moody atmosphere, 8k detail',
    },
    {
        file: 'scene2-solucion.jpg',
        prompt:
            'Ultra premium corporate abstract background, dark navy obsidian base with vivid emerald teal (#00A896) light beams ' +
            'and precise geometric grid lines, sense of protection and a digital shield, glassmorphism, cinematic volumetric light, ' +
            'minimalist, no text, no people, financial technology aesthetic, elegant, 8k detail',
    },
    {
        file: 'scene3-marca.jpg',
        prompt:
            'Ultra premium corporate abstract background, dark navy obsidian base with luxurious gold (#C9A96E) light rays and ' +
            'fine floating particles, prestige and trust atmosphere, subtle ledger paper texture dissolving into light, cinematic, ' +
            'minimalist, no text, no people, financial technology aesthetic, elegant, high end, 8k detail',
    },
];

const MODEL_CANDIDATES = ['imagen-4.0-generate-001', 'imagen-3.0-generate-002'];

async function generateOne(scene) {
    let lastError;
    for (const model of MODEL_CANDIDATES) {
        try {
            const response = await ai.models.generateImages({
                model,
                prompt: scene.prompt,
                config: {
                    numberOfImages: 1,
                    aspectRatio: '16:9',
                    outputMimeType: 'image/jpeg',
                },
            });
            const img = response.generatedImages?.[0]?.image;
            if (!img?.imageBytes) throw new Error('Respuesta sin imageBytes');
            const buffer = Buffer.from(img.imageBytes, 'base64');
            await writeFile(path.join(OUT_DIR, scene.file), buffer);
            console.log(`OK  (${model}) -> ${scene.file}  (${(buffer.length / 1024).toFixed(0)} KB)`);
            return;
        } catch (err) {
            lastError = err;
            console.warn(`Falló con modelo ${model}: ${err?.message || err}`);
        }
    }
    console.error(`ERROR definitivo generando ${scene.file}:`, lastError?.message || lastError);
}

async function main() {
    await mkdir(OUT_DIR, { recursive: true });
    for (const scene of scenes) {
        await generateOne(scene);
    }
}

main();
