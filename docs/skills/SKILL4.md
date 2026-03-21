---
name: prompts-chat-bridge
description: "Puente entre Claude y el repositorio comunitario de prompts.chat para descubrir e instalar habilidades de IA especializadas."
metadata:
  {
    "features": [
      "01 Instalación automatizada de SKILL.md y archivos de configuración",
      "02 Búsqueda basada en palabras clave en la biblioteca de prompts.chat",
      "03 144375 estrellas de GitHub",
      "04 Filtrado específico por categoría para descubrimiento de capacidades",
      "05 Gestión fluida de directorios locales (.claude/skills/)",
      "06 Recuperación de metadatos previos a la instalación"
    ],
    "use_cases": [
      "01 Exploración de indicaciones de ChatGPT para mejorar la salida de Claude",
      "02 Automatización de bibliotecas de equipo compartidas de agentes de IA",
      "03 Equipar a Claude con habilidades especializadas en pruebas unitarias"
    ]
  }
---

# Puente de Prompts Comunitarios (SKILL4)

Esta habilidad sirve como puente entre Claude y el vasto repositorio de indicaciones y capacidades impulsadas por la comunidad que se encuentra en **prompts.chat**.

## Características Principales

- **01 Instalación automatizada**: Crea automáticamente los archivos `SKILL.md` y configuraciones necesarias en `.claude/skills/`.
- **02 Búsqueda avanzada**: Encuentra instantáneamente habilidades especializadas mediante palabras clave en la biblioteca comunitaria.
- **03 Reconocimiento global**: Basado en un repositorio con más de 144,375 estrellas en GitHub.
- **04 Descubrimiento inteligente**: Permite el filtrado por categorías específicas para encontrar la herramienta exacta que necesitas.
- **05 Integración local**: Gestión transparente de directorios para que las nuevas habilidades se activen de inmediato.
- **06 Recuperación de metadatos previos a la instalación**: Permite revisar la funcionalidad antes de instalar.

## Casos de Uso

1. **Exploración de indicaciones de ChatGPT**: Para mejorar la calidad de salida de Claude en proyectos específicos.
2. **Biblioteca compartida**: Automatizar la configuración de una biblioteca de equipo de componentes reutilizables.
3. **Especialización instantánea**: Encontrar y equipar a Claude con habilidades de pruebas unitarias o desarrollo avanzado.

---

# Guía Técnica: Skill Lookup (prompts.chat)

## When to Use This Skill

Activate this skill when the user:

- Asks for Agent Skills ("Find me a code review skill")
- Wants to search for skills ("What skills are available for testing?")
- Needs to retrieve a specific skill ("Get skill XYZ")
- Wants to install a skill ("Install the documentation skill")
- Mentions extending Claude's capabilities with skills

## Available Tools

Use these prompts.chat MCP tools:

- `search_skills` - Search for skills by keyword
- `get_skill` - Get a specific skill by ID with all its files

## How to Search for Skills

Call `search_skills` with:

- `query`: The search keywords from the user's request
- `limit`: Number of results (default 10, max 50)
- `category`: Filter by category slug (e.g., "coding", "automation")
- `tag`: Filter by tag slug

Present results showing:
- Title and description
- Author name
- File list (SKILL.md, reference docs, scripts)
- Category and tags
- Link to the skill

## How to Get a Skill

Call `get_skill` with:

- `id`: The skill ID

Returns the skill metadata and all file contents:
- SKILL.md (main instructions)
- Reference documentation
- Helper scripts
- Configuration files

## How to Install a Skill

When the user asks to install a skill:

1. Call `get_skill` to retrieve all files
2. Create the directory `.claude/skills/{slug}/`
3. Save each file to the appropriate location:
   - `SKILL.md` → `.claude/skills/{slug}/SKILL.md`
   - Other files → `.claude/skills/{slug}/{filename}`

## Skill Structure

Skills contain:
- **SKILL.md** (required) - Main instructions with frontmatter
- **Reference docs** - Additional documentation files
- **Scripts** - Helper scripts (Python, shell, etc.)
- **Config files** - JSON, YAML configurations

## Guidelines

- Always search before suggesting the user create their own skill
- Present search results in a readable format with file counts
- When installing, confirm the skill was saved successfully
- Explain what the skill does and when it activates
