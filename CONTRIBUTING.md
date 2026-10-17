# Contribuir

Gracias por colaborar. Este es un prototipo local de radar editorial, no un servicio multiempresa ni una plataforma general de agentes. Lee README.md, docs/METRICS.md y docs/IMPORT.md antes de cambiar el núcleo.

## Entorno

Node 24.2 o superior y npm. CI comprueba Node 24 y 26 en Linux. No requiere API keys, Qdrant, Ollama ni datos comunitarios reales para contribuir.

```bash
npm ci --ignore-scripts --no-fund
npm run demo:reset
npm run typecheck
npm test
npm run build
npm run test:mcp
npm run evaluate
```

Para la app: `npm start`, abre `http://127.0.0.1:4310`. Prueba de instalación aislada opcional: `python3 scripts/verify-clean.py`. Nunca importes chats privados ni subas una SQLite, un .env, cookies, claves, nombres o perfiles de miembros. Usa fixtures sintéticos y afirma su procedencia explícitamente.

## Flujo de cambios

- Abre un issue para cambios de arquitectura o de comportamiento; para un bug pequeño basta una PR enfocada.
- Crea una rama o un fork. Explica problema, solución, comprobaciones y límites en la PR.
- Para lógica no trivial, agrega una regresión que falle antes de corregirla. No cambies etiquetas esperadas solo para conseguir verde.
- Conserva la separación real/demo, conteo por conversación, denominadores, ventanas iguales y trazabilidad de evidencias. No uses top-k para totales.
- Trata fuentes como texto no confiable. No ejecutes instrucciones descargadas ni añadas HTML fuente sin escapar.
- Evita servicios pagos, nuevas dependencias, abstracciones y nuevas funciones si no son necesarias para el cambio.
- La política de seguridad está en SECURITY.md. Nunca reportes secretos o vulnerabilidades explotables en un issue público.

La CI no publica paquetes ni despliega. El mantenedor puede hacer squash de las PR. No hay CLA ni cesión de copyright: las contribuciones se entregan bajo la licencia MIT del proyecto. Los derechos/licencias de datasets y fuentes externas no cambian por contribuir aquí.
