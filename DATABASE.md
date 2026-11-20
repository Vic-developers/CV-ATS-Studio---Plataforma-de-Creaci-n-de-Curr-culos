# Base de datos

PostgreSQL aplica restricciones, índices y borrado referencial descritos en [el esquema Prisma](prisma/schema.prisma).

| Entidad | Uso |
| --- | --- |
| User, Session, PasswordReset | Cuentas, sesión opaca y recuperación por tokens de un solo uso. |
| Resume | Título, propietario, documento JSON validado, revisión, estado, resultado ATS y marcas de tiempo. |
| JobDescription | Oferta asociada a un documento. |
| ImportFile | Fuente original y diagnóstico técnico. Vinculación al CV tras confirmación. |
| ATSAnalysis | Resultado, hallazgos y revisión analizada. |
| AIRecommendation | Propuestas generadas para un documento. |
| ExportHistory | Formato, modo, nombre, fecha y bytes de cada exportación. |
| RateLimit | Contadores por ventana para operaciones costosas y autenticación. |

Los datos personales, perfiles, experiencias, educación, habilidades, certificaciones, idiomas, proyectos y referencias son entidades del documento JSON, estructuradas según el contrato de [resume.ts](src/domain/resume.ts). El catálogo de plantillas está versionado en ese mismo módulo. Las variantes son filas independientes de `Resume` con `parentId`. Borrar un documento base desvincula sus copias. El usuario puede borrar cada copia por separado.

Las relaciones uno a uno usan claves únicas. Los índices por propietario y fecha favorecen el listado, y los índices por currículum y fecha favorecen el historial. Conserva copias de seguridad cifradas y prueba regularmente la restauración.

Ejecuta una tarea diaria de mantenimiento para eliminar importaciones sin confirmar, tokens y contadores vencidos. Concede a esa tarea acceso desde el entorno privado de PostgreSQL.

```sql
DELETE FROM "ImportFile" WHERE "resumeId" IS NULL AND "createdAt" < NOW() - INTERVAL '1 day';
DELETE FROM "PasswordReset" WHERE "expires" < NOW();
DELETE FROM "Session" WHERE "expires" < NOW();
DELETE FROM "RateLimit" WHERE "expires" < NOW();
```
