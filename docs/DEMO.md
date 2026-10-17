# Guion de demo · 90 segundos

1. Abre la aplicación y conserva «Demo sintética». La banda persistente identifica la muestra; las ventanas, cobertura y método aparecen debajo del titular.
2. Recorre el radar y elige un tema. Lee su razón, recuentos comparados y variación en puntos porcentuales.
3. Pulsa «Ver por qué importa». La vista conecta la línea temporal con evidencia, preguntas posiblemente abiertas y recursos externos. «HECHOS OBSERVADOS» y «PROPUESTA, NO HECHO» separan observación de interpretación.
4. Abre una evidencia y vuelve con el botón o la navegación del navegador; su texto procede del registro exacto servido por la API.
5. «Reproducir nuevos registros» solicita replay histórico sintético; informa del resultado y no representa tráfico en vivo. Para reconstruir esa muestra, «Reiniciar demo» pide confirmación explícita y no afecta datos reales.
6. Selecciona «Datos reales» para consultar el radar real cuando haya conversaciones; el estado de fuentes permanece separado y los resultados reales nunca se mezclan con la demo.

La interfaz consume la API definida en `CONTRACT.md`; no contiene respuestas de demostración inventadas. Ejecuta `npm run build && npm start`: el backend sirve `dist` en `http://127.0.0.1:4310`. Para desarrollo opcional, ejecuta `npx vite` (Vite sirve la UI en `http://127.0.0.1:5173`; `vite.config.ts` fija ese host y redirige `/api` al backend en 4310). Comprobaciones: `npm run typecheck`, `npm run build` y `npm test`.
