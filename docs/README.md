# Documentación

| Documento | Estado | Para qué |
| :--- | :--- | :--- |
| [`ARQUITECTURA.md`](ARQUITECTURA.md) | Vigente | Cómo está montado: frontend, Cloud Functions, modelo de datos, flujos y seguridad. |
| [`OPERACIONES.md`](OPERACIONES.md) | Vigente | Desarrollo local, despliegue, rollback, backups, monitorización y scripts. |
| [`PLAN-LANZAMIENTO-2026-08-04.md`](PLAN-LANZAMIENTO-2026-08-04.md) | Vigente (checklist vivo) | Pendientes de seguridad, estabilidad y calidad, con su estado. |
| [`APP-CHECK-ENFORCEMENT.md`](APP-CHECK-ENFORCEMENT.md) | Vigente | Activación de App Check, token de depuración y reversión. |
| [`historico/`](historico/) | Histórico | Auditorías y planes anteriores. No se actualizan; cada uno indica al principio qué ha quedado desfasado. |

Reglas de mantenimiento:

- Si cambias el modelo de datos, una función, una regla o un flujo,
  actualiza `ARQUITECTURA.md` en el mismo commit.
- Si cambias cómo se despliega o se opera, actualiza `OPERACIONES.md`.
- Al cerrar o abrir un pendiente, actualiza `PLAN-LANZAMIENTO`.
- Las auditorías nuevas van con fecha en el nombre y, cuando dejen de
  reflejar el código, se mueven a `historico/` con un aviso al principio.
