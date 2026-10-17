# INTRAHILO · nombre provisional

[![CI](https://github.com/Quiarom/intrahilo/actions/workflows/ci.yml/badge.svg)](https://github.com/Quiarom/intrahilo/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Qué está empezando a importar en tu comunidad.** Prototipo local del reto Radar de contenido de 30X: conversación → señal temporal → evidencia → pregunta posiblemente pendiente → novedad relacionada → propuesta editorial.

La comunidad objetivo no tiene URL verificada. **No se ha analizado Asilo Digital.** La demo comunitaria y sus dos novedades de ejemplo son sintéticas y se identifican permanentemente. Las novedades públicas descargadas por RSS/Atom y GitHub aparecen en una sección real independiente, no se mezclan con las oportunidades de demo.

## Arrancar desde cero

Requiere **Node ≥24.2 y npm**, sin Docker, cuentas ni API keys para la demo. Verificado con Node 26.7.0. La aplicación se ejecuta localmente y no está desplegada. El código es público bajo MIT; esto no publica tu base de datos ni expone el backend.

```bash
npm ci --ignore-scripts --no-fund
cp .env.example .env
npm run demo:reset
npm run build
npm start
```

Abre **http://127.0.0.1:4310**. `npm start` sirve la interfaz compilada y la API. `Ctrl+C` detiene el servidor. No se expone a Internet: solo escucha en loopback y valida Host/Origin. En un servidor remoto, esa URL es local al servidor, **no un enlace accesible desde el celular**. No se ha configurado un túnel ni abierto el puerto público.

Desarrollo: backend `npm run dev`; en otra terminal `npx vite` sirve el frontend en 5173 y reenvía `/api` a 4310. Para ver `/external/...` durante desarrollo usa el backend 4310. No es necesario Vite en ejecución para la demo compilada.

```bash
npm test                 # núcleo, HTTP real local, conectores y presentación
npm run typecheck
npm run build
npm run test:mcp         # cliente SDK real: initialize/listTools/callTool
npm run evaluate        # evaluación pequeña, sintética y explícitamente limitada
```

## Probar el flujo protagonista

1. Conserva «Demo sintética». Ventanas UTC: 1–8 y 8–15 de octubre de 2026, extremo final excluido.
2. «Memoria y contexto» → **Ver por qué importa**. Los números provienen de SQLite; no están hardcodeados en React.
3. Abre las evidencias, la pregunta original, la respuesta asociada y el recurso externo sintético. Cada referencia corresponde a un registro persistido; los recursos ficticios usan rutas internas, no una web inventada.
4. Distingue **HECHOS OBSERVADOS** de **PROPUESTA, NO HECHO**. El brief es una plantilla, no una evaluación de un modelo.
5. Vuelve y pulsa **Reproducir nuevos registros**. Se añaden tres conversaciones históricas sintéticas, una sola vez. No es streaming ni actividad en vivo.
6. **Reiniciar demo** pide confirmación en la UI. El comando siguiente hace lo mismo, sin preguntar; solo reconstruye filas sintéticas y conserva datos reales:

```bash
npm run demo:replay
npm run demo:reset
```

Dataset reproducible: `src/core/demo.ts`; taxonomía editable: `data/taxonomy.json`; ejemplos etiquetados: `data/classifier-holdout.json`. Guion de 90 segundos: [docs/DEMO.md](docs/DEMO.md).

## Fuentes reales sin nuevas credenciales

```bash
npm run poll
```

También hay «Consultar fuentes» en la UI. Configuración validada en `sources.json`:

- Atom de releases de Ollama: `https://github.com/ollama/ollama/releases.atom`, verificado mediante descarga real.
- API oficial de GitHub: búsqueda acotada `org:langchain-ai langgraph in:name archived:false`, hasta dos repositorios. Consulta metadatos y hasta una página de tres releases por repositorio. Los repositorios devueltos en esta ejecución fueron `langchain-ai/langgraph` y `langchain-ai/langgraphjs`; no se garantiza que una búsqueda futura devuelva exactamente los mismos.

Se conservan URL, fecha de publicación, fecha de ingesta, procedencia, validadores HTTP, fallos y observaciones fechadas de estrellas. Polling serial y condicional con ETag/Last-Modified; 304 no reprocesa contenido. Límites de respuesta/tiempo, rechazo de XML con DTD/entidades, paginación acotada siguiendo Link, retry limitado para 5xx y espera ante límites. Redirecciones no se siguen automáticamente: se registra error para revisar la URL, sin evadir bloqueos. DNS público fijado al socket HTTPS; sin cookies personales.

No se almacenan autores de feeds, perfiles ni stargazers. Solo se utiliza título/resumen permitido del feed y metadatos técnicos de GitHub; no se rastrean artículos completos ni se ingiere un README como instrucciones. Algunas fichas de release solo contienen versión y enlace: no se inventa qué capacidades incorporan.

**Estrellas ordenadas no significan crecimiento.** La variación es neta entre observaciones fechadas reales; una confirmación 304 de metadatos puede confirmar el mismo valor. No hay ranking Trending ni afirmación de tendencia semanal con un intervalo corto.

`POLL_INTERVAL_SECONDS=0` desactiva automatización por defecto. Un valor ≥300 habilita polling mientras corre el backend. Cada ingesta emite eventos internos SSE para actualizar el panel. WebSub no está implementado.

## Importar una comunidad pública

Formato y privacidad: [docs/IMPORT.md](docs/IMPORT.md). Hay importación de conversaciones/hilos y un formato plano con agrupación aproximada explícita por día UTC. La fuente es configurable mediante los campos del archivo; no existe scraper comunitario ni URL supuesta.

```bash
npm run import -- data/import-example.json
```

El ejemplo es **sintético** y añade una conversación a esa partición. Revisa y elimina datos personales **antes** de importar datos reales; se exige `preAnonymized: true`, un schema estricto rechaza campos de autor y se aplica redacción adicional antes de SQLite. El filtro automático **no garantiza anonimización universal**. No importes una exportación cruda de chats ni datos privados. La responsabilidad de revisar nombres embebidos no se delega a una expresión regular.

Las ventanas de ejemplo están fijadas para la demo. Para analizar otras fechas usa `/api/radar?synthetic=false&currentStart=...&currentEnd=...` o los argumentos MCP; siempre se compara el periodo inmediatamente anterior de igual duración. El panel principal no incluye un editor de ventanas.

## Búsqueda y proveedores

**Modo ejecutado aquí: búsqueda TEXTUAL**, con clasificación por alias y detección de preguntas por heurística. No se presenta como recuperación semántica/vectorial. Los conteos salen de todas las conversaciones elegibles en SQLite, nunca de top-k.

El adaptador vectorial `src/providers.ts` usa Ollama `/api/embed` y Qdrant REST: colección por modelo/dimensión, actualizaciones por fingerprint y filtro real/sintético. Solo acepta servicios vectoriales locales. Si no están configurados o fallan, la respuesta indica fallback textual y su limitación. No se instalaron Ollama, Qdrant ni modelos en este VPS pequeño; **la ruta vectorial no fue comprobada contra servicios reales**.

Para un equipo con capacidad y Docker ya instalado:

```bash
docker compose -f compose.vector.yml up -d
```

Después configura `OLLAMA_URL`, `QDRANT_URL` y `EMBEDDING_MODEL` en `.env` usando un modelo de embeddings **ya instalado y autorizado** en Ollama, y reinicia el backend. El compose fija Qdrant v1.19.2 y loopback; no instala Ollama ni descarga un modelo. La primera búsqueda indexa el corpus de esa partición en lotes pequeños. Cambiar de modelo crea otra colección. La caché de fingerprints es de proceso; reiniciar puede reindexar. No se afirma que esta combinación quepa con un modelo en un servidor de 2GB.

Generación: por defecto **plantilla editorial sin modelo**. `/api/draft/:topic` usa ese fallback. Existe un adaptador opt-in OpenAI-compatible, desactivado por `GENERATION_ENABLED=false`. Requiere endpoint, modelo y API key autorizados por separado. No se convirtió una suscripción de chat/OAuth en acceso API ni se hicieron llamadas a ese adaptador. No publica nada ni altera los hechos del radar.

## MCP de consulta

Cuatro herramientas por stdio: `get_topic_trends`, `get_topic_evidence`, `find_open_questions`, `match_external_updates`. Validación de argumentos, límites de tamaño, ventanas/fuentes/referencias/procedencia y limitaciones en cada respuesta. Sin SQL arbitrario, escrituras de ingesta ni acceso libre al almacenamiento por herramientas. Las consultas pueden materializar asignaciones y snapshots internos; «solo lectura» significa que no permiten modificar fuentes, importar, publicar ni borrar.

- Claude Code/Desktop: `mcp.example.json` — sustituye `/RUTA/INTRAHILO` por tu ruta absoluta.
- Hermes: ejemplo en `docs/hermes-mcp.example.yaml`, con sampling desactivado. No se modificó la configuración global de Hermes.
- Prueba independiente sin configurar un cliente externo: `npm run test:mcp` crea una SQLite temporal y usa el cliente oficial SDK por stdio. Comprueba cuatro llamadas, coherencia de ventanas con el mismo núcleo del panel y rechazo de argumentos fuera de límites.

SDK oficial 1.x fijado por lockfile: protocolo compatible hasta 2025-11-25. No se afirma soporte de todas las novedades MCP de 2026.

## Estructura y límites

- `src/core`: SQLite, demo, redacción, clasificación, preguntas, métricas y oportunidades.
- `src/connectors.ts`: red pública, HTTP condicional, RSS/Atom y GitHub.
- `src/server.ts`: API y archivos estáticos locales; `src/cli.ts`: comandos.
- `src/providers.ts`: textual, ruta vectorial opcional y borrador editorial opt-in.
- `src/mcp.ts`: herramientas MCP; `web/`: React y CSS.
- `var/`: SQLite local, excluida de Git y del paquete. `artifacts/`: resultados de verificación, excluidos de Git.

Reglas precisas y techos: [docs/METRICS.md](docs/METRICS.md). No hay autenticación multiempresa, billing, app móvil, publicación automática, scraping privado, WebSub, clustering dinámico ni plataforma de agentes. No aprende solo: almacena y recalcula con reglas versionadas.

**Siguiente paso de mayor impacto:** proporcionar la URL pública autorizada o una muestra preanonimizada de la comunidad y evaluar clasificación/preguntas con ejemplos reales revisados, antes de añadir infraestructura o afirmar utilidad general.


## Open Source y hackathon

Código bajo [licencia MIT](LICENSE). La licencia del código no concede derechos sobre contenido de comunidades, feeds o marcas de terceros. `private: true` en package.json solo impide publicar accidentalmente un paquete npm: no determina la visibilidad del repositorio GitHub.

- [Guía para contribuir](CONTRIBUTING.md), [código de conducta](CODE_OF_CONDUCT.md) y [política de seguridad](SECURITY.md).
- Issues estructurados, plantilla de PR y CODEOWNERS.
- CI con Node 24 y 26: instalación desde lockfile sin scripts de instalación, comprobación básica del repositorio, types, tests, build, cliente MCP, evaluación y auditoría de dependencias de producción. El badge muestra el estado REAL del último workflow, no un resultado inventado.
- Acciones fijadas por SHA, permisos de solo lectura, sin credenciales persistidas en checkout y sin pull_request_target. Dependabot semanal para npm y Actions; no auto-merge.
- Desarrollo local con Node 24 LTS (`.nvmrc`), archivos de texto LF/UTF-8 y exclusiones de secretos/SQLite/cachés.

[Contexto de la hackathon](docs/HACKATHON.md): [hackathon.30x.com](https://hackathon.30x.com/) exige repositorio público durante la revisión. Proyecto independiente, no producto oficial ni aval de 30X. El nombre está en revisión: consulta [la investigación de marca](docs/BRAND_RESEARCH.md). No se afirma disponibilidad legal de marca o dominio.
