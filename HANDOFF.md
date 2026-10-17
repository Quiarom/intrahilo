# HANDOFF — INTRAHILO

## Estado de entrega

Prototipo local ejecutado y verificado. No se publicó repositorio, no se desplegó fuera del servidor y no se activó facturación ni un servicio pago. No se usó JEV.

Ruta de trabajo: `/root/intrahilo`. Stack: TypeScript, React/Vite, backend HTTP Node, SQLite nativo. `README.md` contiene los comandos y límites; `docs/DEMO.md`, el guion de 90 segundos; `docs/METRICS.md` y `docs/IMPORT.md`, reglas y formato.

## Arranque y reproducción

```bash
npm ci --no-audit --no-fund
cp .env.example .env
npm run demo:reset
npm run build
npm start
```

Abrir `http://127.0.0.1:4310`. Solo loopback: no es un enlace público accesible desde el celular. No hay autenticación ni exposición pública autorizada. El backend sirve `dist`; Vite no es necesario para la demo compilada. `npm run dev` es el backend de desarrollo y `npx vite` puede ejecutarse aparte.

Comprobaciones:

```bash
npm test
npm run typecheck
npm run build
npm run test:mcp
npm run evaluate
python scripts/verify-clean.py
```

El último comando requiere Python solo para el verificador, no para la aplicación. Crea una copia aislada sin `node_modules`, `dist`, `.env`, `.git`, `var` ni artefactos anteriores; instala desde lockfile, reconstruye la demo, ejecuta tests/build/typecheck/MCP y arranca temporalmente en 4371. No usa proveedores ni fuentes de red. Guarda su salida detallada en `artifacts/clean-install.json` del proyecto original.

## Evidencia de verificación realizada

- `npm test`: **42 pruebas, 42 pasaron**, cero fallos.
- `npm run typecheck` y `npm run build`: salida 0.
- `npm run test:mcp`: `MCP_SMOKE_OK`, cuatro herramientas descubiertas y llamadas, argumentos inválidos rechazados, ventanas coherentes con el núcleo del panel.
- `python scripts/verify-clean.py`: **CLEAN_INSTALL_OK**. Los seis comandos de instalación/verificación salieron 0. HTTP en la copia limpia: 25 conversaciones actuales, 5 de memoria, 8 enlaces de evidencia exactos comprobados, replay añadió 3 y el total cambió a 28.
- Evaluación sintética mínima: 6/6 ejemplos etiquetados, sin alterar sus etiquetas esperadas. No es un benchmark independiente: alias revisados durante construcción y muestra demasiado pequeña para generalizar.
- Fuentes reales consultadas: Atom de releases de Ollama y API oficial GitHub para búsqueda, metadatos y releases de `langchain-ai/langgraph` y `langchain-ai/langgraphjs`. Se observaron solicitudes condicionales sin reprocesado (304).
- SQLite de trabajo tenía **18 recursos externos reales**: 10 Atom y 8 GitHub; además 2 recursos sintéticos. Ningún recurso externo carecía de fecha de ingesta tras revalidación. No hay conversaciones reales almacenadas.
- Navegador: ruta directa al tema memoria, propuesta y enlaces, presentación móvil de 390px sin desbordamiento horizontal. Reset abrió confirmación con foco en Cancelar y Escape cerró el diálogo; replay desde botón actualizó el radar a 28 conversaciones. Después se reconstruyó la demo inicial.
- Captura visual obtenida con CDP `fromSurface=false`; la captura predeterminada se colgaba. No afirmar fallo del producto por ese problema de captura.
- `npm audit --omit=dev --audit-level=high`: cero vulnerabilidades reportadas en dependencias de producción en esa ejecución.

## Qué es real y qué es sintético

**Sintético:** las 50 conversaciones comunitarias iniciales, el replay, las preguntas y las dos novedades usadas en oportunidades demo. Dataset determinista en `src/core/demo.ts`; intento extra de reenvío deduplicado no aumenta el denominador. Memoria 2/25→5/25; automatización 8/25→8/25 pese a 8→59 mensajes; un hilo concentra 31 mensajes; hay un tema nuevo, pregunta respondida y posiblemente pendiente, recurso relevante y popular irrelevante. Todos estos valores se calculan y prueban en código.

**Real:** los recursos públicos externos descargados por conectores. Se muestran separados. No implican que exista una necesidad comunitaria real correlacionada.

**Comunidad:** no hay URL verificada. No se ha analizado Asilo Digital. Hay importación estricta de conversaciones o formato plano con agrupación aproximada por fuente/procedencia/día UTC. Datos reales requieren revisión y preanonimización antes de importar. No importar chats privados o exportaciones crudas.

## Modos y límites abiertos

- Modo comprobado: **búsqueda textual**, taxonomía por alias y preguntas por heurística explícita. No hay recuperación vectorial funcionando en este VPS.
- Adaptadores Ollama/Qdrant implementados y fallback probado; no hay servicios/modelos instalados y no se validó la ruta vectorial contra instancias reales. `compose.vector.yml` fija Qdrant v1.19.2 y loopback, pero no se ejecutó. No descargar modelos en este VPS de 2GB sin evaluar capacidad.
- Brief: plantilla editorial, no evaluación de un LLM. Adaptador de generación OpenAI-compatible opt-in desactivado y no probado contra proveedor real. No asumir que una suscripción de chat ofrece API.
- Redacción por patrones no garantiza anonimización universal; se exige revisión humana previa y se rechazan campos desconocidos de autor. Puede redactar nombres técnicos válidos.
- Pregunta posiblemente pendiente: no encontramos respuesta suficiente según la heurística en el historial disponible; no implica ausencia de una solución externa. Longitud/replyTo no garantizan suficiencia semántica.
- Ventanas de la UI principal fijadas a la demo; API/MCP aceptan otras fechas. Misma duración y conjunto de fuentes, con límites de cobertura explícitos.
- Dedup exacta puede subcontar repeticiones legítimas. No se fusionan automáticamente recursos equivalentes de conectores distintos.
- Proyección de asignaciones persistida con versión y corte; escaneo lineal adecuado para muestras pequeñas. No hay garantía de rendimiento ni de alta concurrencia con muchas ventanas distintas.
- Releases reales pueden contener solo versión/enlace. No inventar capacidades a partir de eso.
- La variación de estrellas corresponde al intervalo entre observaciones reales; no es tendencia semanal ni réplica de GitHub Trending.
- No WebSub, publicación automática, multitenancy, billing, app móvil ni clustering dinámico.

## MCP

Ejemplo Claude Code/Desktop: `mcp.example.json`. Hermes: `docs/hermes-mcp.example.yaml`; sampling desactivado. Sustituir las rutas absolutas. No se modificó la configuración global de Hermes. SDK oficial 1.x (protocolo hasta 2025-11-25), cliente real comprobado por stdio. Las herramientas no importan, publican, borran ni ejecutan SQL arbitrario; pueden materializar internamente asignaciones y snapshots de lectura.

## Loop Coding y continuidad

Board local `intrahilo`. Luna `openai-codex/gpt-6-luna` comprobado y usado en tareas principales. Hubo límites de cuota y agotamiento de 60 iteraciones; se conservaron cambios y el padre corrigió los huecos con regresiones RED→GREEN. La descomposición automática produjo subtareas: no asumir que heredan el pin del padre; el último verificador fue fijado explícitamente a Luna. Los resúmenes y estados de workers no son evidencia de aceptación: el padre ejecutó los gates y la instalación limpia.

No reabrir ni recrear el grafo por notificaciones antiguas. Leer estado/último intento y confirmar ausencia de writer activo antes de editar. `TASKS.md` y `PROGRESS.md` documentan el cierre funcional local, aunque el historial del board conserve intentos fallidos.

## Siguiente paso de mayor impacto

Obtener la URL pública autorizada o una muestra comunitaria real preanonimizada. Construir una evaluación revisada de clasificación y suficiencia de respuestas con esa muestra antes de ampliar infraestructura, activar modelos o afirmar utilidad editorial general.
