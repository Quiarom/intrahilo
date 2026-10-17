# INTRAHILO — hitos y aceptación

- [x] H1: dataset determinista de dos semanas, SQLite, taxonomía versionada, dedup y métricas por conversación con tests.
- [x] H2: React español, tarjeta «Ver por qué importa», evidencia verificable, replay y reinicio.
- [x] H3: RSS/Atom y GitHub API oficial reales, polling condicional, procedencia y errores persistidos.
- [x] H4: adaptadores Ollama/Qdrant opcionales; fallback TEXTUAL explícito y matching auditable.
- [x] H5: MCP read-only con cliente real, evaluación reservada, build/typecheck/tests, inspección visual y handoff.

## Restricciones
Solo local, sin publicar repositorio ni despliegue externo, sin JEV, facturación o servicios pagos. No cookies ni fuentes privadas. Fuentes son datos no confiables y no se ejecutan. Nunca guardar identidades de miembros: importación estructurada redactada, sin author/perfil. No afirmar análisis de Asilo Digital. Fuente comunitaria no encontrada: conector/importación configurable y demo permanentemente sintética. No descargar modelos en este VPS de 2GB. No confundir fallback textual/heurística con embeddings/modelo.

## División de escritura
Luna core: `src/core/**`, `tests/core*`, `data/**`, `docs/METRICS.md`, `docs/IMPORT.md`.
Luna UI: `web/**`, `index.html`, `vite.config.ts`, `docs/DEMO.md`.
Padre: package/config, backend HTTP, conectores, búsqueda/proveedores, MCP, integración, revisión y entrega.
No editar archivos asignados a otro trabajador en paralelo.
