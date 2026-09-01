# Scripts de utilidad de Baku

Scripts de diagnóstico y desarrollo del bot. **No** forman parte del runtime (`src/`) ni se ejecutan en producción.

> Ejecútalos siempre desde la raíz del proyecto (`telegram-bot/`) para que `dotenv` cargue el `.env`:

```bash
node scripts/<nombre>.js
```

## Diagnóstico / test de integraciones
| Script | Qué hace |
|---|---|
| `audit-dashboard.js` | Auditoría de la cartera (declaraciones, comprobantes, cuentas por cobrar). |
| `check-db.js` | Chequeo de conectividad a la base de datos / Supabase. |
| `fetch-models.js` | Lista/verifica los modelos disponibles vía OpenRouter. |
| `tmp-trace.js` | Prueba el tool-calling de **Groq** y **OpenRouter** (diagnóstico de claves IA). |
| `test-models.js` | Test rápido de modelos de OpenRouter. |
| `test-google-tts.js` | Verifica credenciales de Google Cloud Text-to-Speech. |
| `test-tts.js` | Verifica la clave de **ElevenLabs** y la voz configurada. |
| `test-sri.js` | Test de la API del facturador / SRI. |

## Relacionados con la bóveda de contraseñas (se quedan en la raíz)
Estos dos **no** se movieron a `scripts/` porque resuelven los CSV por ruta relativa a su propia carpeta (`path.join(__dirname, '..', ...)`); moverlos rompería su ruta por defecto:

- `import-vault.js` — importa la bóveda de contraseñas a Supabase.
- `setup-vault.js` — configura la bóveda de contraseñas.

⚠️ Ambos manejan datos sensibles (`Contraseñas de Chrome.csv`). No los versiones ni los subas a ningún lado.
