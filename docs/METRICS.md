# Métricas, evidencia y techos del prototipo

## Unidad, ventanas y cobertura

La unidad es la conversación/hilo, no un mensaje ni una persona. Un tema cuenta como máximo una vez por conversación. El inicio del hilo lo asigna a una ventana UTC semiabierta `[inicio, fin)`. Fechas normalizadas a ISO con milisegundos antes de comparar. La ventana previa es inmediatamente anterior y de igual duración; ambas consultan exactamente el mismo conjunto de fuentes: la selección explícita o la unión de fuentes observadas en el intervalo combinado. Mostrar ese conjunto no demuestra continuidad/completitud del archivo; fuentes recién incorporadas pueden sesgar el cambio.

Se excluyen conversaciones sin mensajes no duplicados. Una conversación compuesta únicamente de reenvíos exactos no se crea y no aumenta el denominador. La agrupación plana por día UTC está marcada `approximate=1` y la cobertura lo advierte: no equivale a hilos nativos.

Se clasifica con el contenido disponible anterior al fin de la ventana actual, sin incorporar mensajes posteriores para atribuir temas al pasado. `assignments` persiste versión de la taxonomía y `as_of`; una nueva fecha de corte o versión recalcula ambos periodos. El snapshot de asignaciones es una proyección local materializada, no un historial inmutable de todas las versiones; `metric_observations` conserva snapshots por ventana/fuentes/versión. Búsqueda sobre historial completo puede materializar otro corte y la siguiente consulta métrica restaura el suyo. SQLite con WAL/busy_timeout; no está diseñado para consultas concurrentes masivas con ventanas diferentes.

## Fórmulas

- Conteo: número de conversaciones elegibles del tema en W.
- Presencia: conteo del tema / total elegible de W.
- Diferencia: `(presencia_actual - presencia_previa) × 100`, puntos porcentuales.
- Razón: `presencia_actual / presencia_previa`, solo si la previa >0 y hay denominador actual. Nunca razón de conteos con denominadores distintos.
- Persistencia: fechas UTC distintas con conversaciones del tema dentro de la ventana actual.
- Preguntas posiblemente pendientes: preguntas de conversaciones de la ventana actual para las que no existe evidencia de respuesta suficiente según la heurística antes del fin de la ventana actual.

Denominador cero: `evidencia insuficiente`; el 0 numérico en la API solo evita NaN/Infinity y no es una estimación. Razón `null` si el tema no existía en la ventana previa. UI distingue nuevo observado de ausencia de denominador. Ningún total usa resultados de búsqueda top-k. Particiones reales y sintéticas se consultan por separado, incluido matching y evidencias.

## Etiquetas configurables

Umbrales en `data/taxonomy.json`:
1. Sin denominadores en ambas ventanas o menos de `minConversations` actuales (1): evidencia insuficiente.
2. Aumento ≥`emergingDeltaPp` (5 pp): emergente.
3. Presencia en ≥`persistentDays` (3) días actuales: persistente.
4. Presencia concentrada en ≤`spikeMaxDays` (1) día actual: pico puntual.
5. Resto: evidencia insuficiente para esas etiquetas.

Son heurísticas de presentación, NO significancia estadística, causalidad ni garantía de crecimiento futuro. No se mezcla todo en un score.

## Clasificación y preguntas

Taxonomía pequeña editable: memoria/contexto, automatización, audio espacial nuevo, integración y otro. Alias con normalización de acentos y límites de palabra; multilabel. Hash del archivo efectivo identifica la versión. No usa modelo de clasificación en el modo ejecutado. `INTRAHILO_TAXONOMY` opcional permite otra ruta local.

Pregunta: signo `?` o `¿` en un mensaje. Se asocia una respuesta solo si es posterior, en el mismo hilo, enlazada por `replyTo`, no interrogativa, al menos `answerMinCharacters` (24) caracteres y `answerMinWords` (4) palabras y no es un simple agradecimiento/acuse. La evidencia de respuesta enlaza el documento exacto. Una respuesta posterior al corte no cierra retrospectivamente la pregunta. Longitud y replyTo NO prueban suficiencia semántica; puede haber falsos positivos/negativos.

**Posiblemente pendiente significa: no encontramos una respuesta suficiente en el historial disponible.** No significa que nadie respondió fuera de la fuente o que no exista solución. Las herramientas pueden devolver preguntas respondidas con su estado para auditar la heurística.

## Deduplicación y oportunidades

Mensajes: ID técnico por fuente/procedencia y hash del texto redactado normalizado dentro de esa fuente/procedencia. Se permiten ediciones por el mismo ID y se reemplazan asignaciones; un batch inválido revierte sus cambios. Límite conocido: mensajes legítimos idénticos pueden subcontarse; tampoco se intenta deduplicar la misma discusión entre comunidades distintas. Un import repetido no añade documentos ni conversaciones, aunque deja un registro de ejecución.

RSS: URL canónica sin query/fragmento, con ID estable. GitHub: ID técnico de release/repositorio. Upsert de contenido evita reclasificar recursos sin cambio. No hay fusión de recursos equivalentes de fuentes distintas: se conserva su procedencia; podrían aparecer dos fichas de la misma novedad si se configuran conectores superpuestos.

Matching externo: tema compartido, misma partición y publicación dentro de la ventana actual. Es asociación textual, no prueba de que resuelva la necesidad. Popularidad no genera relevancia. El brief usa plantilla y guarda IDs exactos de evidencia/recursos; la propuesta no es un hecho observado. En muestras grandes la evidencia visual se limita, sin alterar los conteos completos.

## Datos de demostración

`src/core/demo.ts` crea 50 conversaciones elegibles, 25 por semana, más un intento de reenvío deduplicado. Memoria tiene 2 y 5 hilos; automatización tiene 8 y 8, pero sus mensajes aumentan de 8 a 59. Un hilo concentra 31 mensajes. Audio espacial solo existe en la segunda semana. Hay una pregunta con respuesta explícita y otra posiblemente pendiente. Dos recursos externos sintéticos: memoria relacionada y novedad visual popular irrelevante. Replay añade tres hilos de memoria una sola vez. Los tests calculan y comprueban estos casos; React no contiene esos valores como datos.

## Límites de privacidad y ejecución

No se aceptan campos autor/perfil mediante la importación pública. Se exige revisión/preanonimización; se redactan patrones comunes antes de persistir título, texto y nombre de fuente. Redacción regex no demuestra ausencia universal de nombres propios; puede también redactar nombres técnicos. No importar texto real sin revisión. No se ejecutan mensajes, HTML, README ni instrucciones descargadas. No se envían mensajes ni se publica contenido.
