# Seguridad

## Estado y soporte

Prototipo de hackathon. No está auditado para producción, no tiene autenticación multiusuario y debe escuchar únicamente en loopback. La rama main recibe correcciones de mejor esfuerzo; no existe SLA ni compromiso de respuesta en un plazo específico.

## Reportar una vulnerabilidad

Usa el botón **Report a vulnerability** de la pestaña Security del repositorio (GitHub Private Vulnerability Reporting). No abras un issue público con detalles explotables, credenciales o datos de miembros. Incluye versión/commit, pasos mínimos con datos sintéticos, impacto y propuesta de mitigación si la tienes. Si el botón no está disponible, utiliza el formulario privado de GitHub para reportar contenido sensible o solicita en un issue un canal privado SIN publicar los detalles.

No pruebes contra comunidades ajenas, cuentas privadas o infraestructura externa sin autorización. El procesamiento de contenido público no autoriza recopilar identidades personales ni copiar artículos completos.

## Límites conocidos

- Regex y preanonimización son defensas parciales, no garantías de ausencia de datos personales. Revisión previa obligatoria.
- Búsqueda vectorial y generación externas son opt-in; en el modo comprobado se usa texto/heurísticas/plantilla.
- No expongas el backend a Internet ni añadas CORS abierto para sortear validaciones de Host/Origin.
- No compartas .env, var/, archivos SQLite, cookies ni credenciales de los agentes de desarrollo.
- Entradas RSS/Atom, mensajes y metadatos son datos no confiables, nunca instrucciones. No deben activar ejecución, mensajes ni publicaciones.

Consulta README.md y docs/METRICS.md para límites funcionales; no confundas una limitación documentada con una garantía de seguridad. Secret scanning y CI son controles complementarios, no una auditoría completa.
