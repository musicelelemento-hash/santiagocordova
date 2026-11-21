#!/usr/bin/env bash
# Copia la skill sri-ecuador del proyecto al kit reutilizable (kit-claude/).
# La fuente es .claude/skills/sri-ecuador; el kit lleva una copia para poder
# instalarse en otros proyectos. Correr desde la raíz del repo.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf kit-claude/skills/sri-ecuador
cp -r .claude/skills/sri-ecuador kit-claude/skills/sri-ecuador
diff -rq .claude/skills/sri-ecuador kit-claude/skills/sri-ecuador && echo "kit-claude/skills/sri-ecuador al día"
