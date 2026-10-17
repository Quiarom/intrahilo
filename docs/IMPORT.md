# Importación pública revisada

No hay URL comunitaria verificada ni análisis de Asilo Digital. La ingesta comunitaria es por archivo JSON o `POST /api/ingest`, sin cookies ni login. Solo contenido público obtenido con autorización/mecanismo permitido.

## Requisitos de privacidad

1. Revisa y elimina nombres, teléfonos, correos, perfiles e identificadores personales **antes** de crear el archivo.
2. Usa únicamente IDs técnicos de documentos/hilos, nunca IDs de miembros. `sourceName` debe nombrar la fuente, no una persona.
3. Declara `preAnonymized: true`. Esto es una afirmación del importador, no una prueba automática de anonimización.
4. El schema estricto rechaza campos desconocidos (incluido author). El núcleo aplica redacción extra a correos, teléfonos, handles, perfiles comunes, autoidentificación y parejas de nombres propios antes de guardar texto. No garantiza cubrir todos los nombres. No se conserva payload crudo.
5. Las URLs de fuente son públicas HTTPS sin usuario, contraseña, query ni fragmentos. No se recopilan páginas desde esa URL comunitaria: sirve como referencia. Omitir URL es válido si el registro redactado interno es la evidencia permitida.

## Hilos explícitos

Ver `data/import-example.json` (sintético). Campos:

```json
{
  "preAnonymized": true,
  "conversations": [{
    "id": "thread-001",
    "sourceId": "public-forum",
    "sourceName": "Foro público revisado",
    "synthetic": false,
    "title": "Pregunta sobre memoria",
    "startedAt": "2026-10-10T10:00:00Z",
    "messages": [{
      "id": "document-001",
      "text": "¿Cómo compartir memoria con permisos separados?",
      "publishedAt": "2026-10-10T10:00:00Z"
    }]
  }]
}
```

El JSON anterior ilustra el FORMATO, no afirma un dato real ni aporta una URL supuesta. Úsalo con `synthetic: true` para probarlo como ejemplo ficticio. Una respuesta puede añadir `replyTo: "document-001"` con fecha posterior y otro ID técnico. Fechas ISO UTC; ningún mensaje puede preceder el inicio del hilo. Importar por CLI o HTTP aplica la misma validación y persistencia:

```bash
npm run import -- archivo-revisado.json
curl -X POST http://127.0.0.1:4310/api/ingest \
  -H 'Content-Type: application/json' --data-binary @archivo-revisado.json
```

Límites HTTP: 2MB; hasta 300 hilos, 300 mensajes/hilo, 10.000 caracteres/mensaje. IDs técnicos: letras/números/punto/guion/guion bajo/dos puntos, hasta 120. No se guarda el texto fuente dentro de errores de validación.

## Fuentes sin hilos: agrupación aproximada explícita

```json
{
  "preAnonymized": true,
  "grouping": "utc-day-approximate",
  "messages": [{
    "id": "flat-001",
    "sourceId": "public-flat-source",
    "sourceName": "Fuente pública sin hilos",
    "synthetic": true,
    "text": "Pregunta de ejemplo sobre memoria",
    "publishedAt": "2026-10-10T10:00:00Z"
  }]
}
```

Se agrupa por `(fuente, procedencia real/sintética, día UTC)`, no por persona ni similitud. Inicio = fecha mínima del grupo. Persiste `approximate=1` y se advierte en cobertura. No representa una reconstrucción fiable de conversaciones reales. Hasta 1000 mensajes por archivo plano, sujeto a límites por grupo del núcleo. Importar tarde un mensaje más antiguo del mismo día puede cambiar el inicio dentro del mismo día, nunca mezclar fuentes/procedencias.

## Idempotencia y referencias

El ID técnico del mensaje debe conservarse al editar su texto. Reimportar datos iguales no infla métricas. Hash normalizado elimina reenvíos exactos dentro de la misma fuente/procedencia, con el límite de subcontar repeticiones legítimas. Una conversación solo duplicada no aporta al denominador. Los documentos reciben un ID opaco scopeado para enlaces `/evidence/<id>`: misma clave cruda en dos fuentes o procedencias no colisiona. La fecha de contenido y la fecha de ingesta se guardan por separado.

El reset de la demo no elimina datos reales. Cambiar `synthetic` no convierte la muestra en real: esa etiqueta debe describir su procedencia auténtica.
