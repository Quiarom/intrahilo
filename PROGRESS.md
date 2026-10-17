# PROGRESS

## Descubrimiento
- Proyecto nuevo en `/root/intrahilo`; no existe proyecto INTRAHILO ni instrucciones AGENTS.md en directorios superiores inspeccionados.
- Node v26.7.0 / npm 11.19.0. VPS 1967 MiB, ~1011 MiB disponibles al inicio, swap 4GB. Sin binarios Docker/Ollama ni listeners Qdrant/Ollama. No se instalarán modelos.
- Comunidad objetivo sin URL verificada: demo sintética + importación documentada. No se ha analizado Asilo Digital.
- Luna comprobado: `openai-codex/gpt-6-luna` respondió `LUNA_SMOKE_OK`. Configuración global no modificada.
- Loop Coding nativo: se comprobó `hermes kanban create --goal`; user scope funciona al pasar XDG_RUNTIME_DIR y DBUS_SESSION_BUS_ADDRESS existentes. Sin reiniciar gateway ni cambiar linger.
- Documentación oficial consultada: GitHub REST best practices (ETag, 304, límites/retry), MCP build server, Qdrant local quickstart y Ollama `/api/embed`.

## Decisiones
- Node SQLite nativo, React/Vite/TypeScript, backend Node pequeño. SDK MCP oficial. Sin ORM ni framework de agentes.
- Heurística versionada para clasificación/preguntas y brief editorial de plantilla, todos rotulados; generación externa solo opt-in con adaptador, nunca convertir suscripción chat en API.
- Dataset demo y fuentes reales separados en consultas, métricas y matching.


## Implementación y recuperación
- Luna participó mediante Loop Coding nativo; la cuota produjo rate limits y el core agotó 60 iteraciones. Se conservó el trabajo, no se consideraron completos los stubs y el padre añadió regresiones antes de corregir métricas, preguntas, deduplicación, fechas, aislamiento y evidencia.
- La descomposición automática de UI produjo subtareas; el pin de modelo no se heredó en todas. Se detectó y fijó el verificador restante a `openai-codex/gpt-6-luna`. No se modificó la configuración global.
- Se sustituyeron dos expectativas smoke incorrectas: permitir dos hilos totalmente duplicados contradecía el denominador; la primera demo de automatización no mantenía proporción estable. El dataset deliberado y las nuevas pruebas verifican la especificación del usuario. No se alteraron las etiquetas manuales para hacer pasar resultados.
- Adaptadores pequeños para RSS/Atom, GitHub oficial, búsqueda textual, Ollama/Qdrant opcional y generación opt-in. Modo realmente ejecutado: textual + heurísticas + brief de plantilla.
- Modelo SQLite separado con migraciones aditivas, corte/versión del clasificador, fechas de contenido/ingesta, oportunidades con referencias exactas y particiones real/demo. Importación plana agrupa explícitamente por día UTC y marca aproximación.

## Verificación final
- Suite 37/37, TypeScript y build pasan. Cliente SDK MCP real devuelve MCP_SMOKE_OK para las cuatro herramientas y rechaza argumentos fuera de límite.
- Instalación limpia EJECUTADA: `python scripts/verify-clean.py` devolvió CLEAN_INSTALL_OK. npm ci, reset, typecheck, test, build y test:mcp salieron 0 sin reutilizar DB/node_modules/dist anteriores. Comprobó HTTP, 8 enlaces exactos y replay 25→28.
- Descargas reales verificadas y polling condicional 304. DB de trabajo: 10 recursos Atom y 8 GitHub reales, aparte de 2 sintéticos; no hay conversaciones comunitarias reales. Recursos externos con fecha de ingesta completa tras revalidación.
- Evaluación manual mínima 6/6; no benchmark independiente ni prueba de calidad general. npm audit de producción reportó 0 vulnerabilidades en esa ejecución.
- Navegador: detalle memoria, referencias de preguntas y novedad, móvil390px sin overflow, reset con foco/Escape y replay actualizando totales. Captura predeterminada falló; CDP fromSurface=false funcionó y permitió inspección visual.
- README, .env.example, fuentes, configuración MCP, compose opcional, reglas de métricas/importación, guion90s y HANDOFF.md entregados. Sin publicación ni despliegue externo.

## Limitaciones abiertas, no bloqueantes del fallback
- Comunidad pública pendiente de URL/muestra preanonimizada; no se analizó Asilo Digital.
- Ollama/Qdrant ausentes: configuración/adaptadores presentes, ruta vectorial real NO validada. No se instalaron modelos ni se activaron servicios pagos.
- Generación externa desactivada y no probada; no se asume acceso API por suscripción de chat.
- Revisión previa de privacidad obligatoria; patrones de redacción no garantizan anonimización universal. Ver HANDOFF.md para límites técnicos y siguiente paso.
