# API REST

Las mutaciones requieren un encabezado `Origin` que coincida con `APP_ORIGIN`. Usa `Content-Type: application/json` cuando la tabla indique un cuerpo JSON. Las rutas de CV e importación requieren una sesión activa mediante cookie.

| Método y ruta | Cuerpo o efecto |
| --- | --- |
| POST /api/auth/register | `email`, `password`. Crea usuario y sesión. |
| POST /api/auth/login | `email`, `password`. Inicia una sesión. |
| GET /api/auth/session | Consulta la cuenta autenticada. |
| POST /api/auth/logout | Revoca la sesión actual. |
| POST /api/auth/forgot | `email`. Envía el enlace de recuperación si existe la cuenta. |
| POST /api/auth/reset | `token`, `password`. Cambia la contraseña y revoca las sesiones. |
| GET /api/resumes | Lista currículums del usuario. |
| POST /api/resumes | `title`, opcionalmente `data`. Para importar, envía además `importId` y `confirmed: true`. |
| GET /api/resumes/:id | Obtiene un currículum propio. |
| PATCH /api/resumes/:id | `revision` vigente y los campos modificados entre `title`, `data` o `job`. Una oferta vacía desvincula la existente. |
| DELETE /api/resumes/:id | Elimina el CV y sus archivos e historiales asociados. |
| POST /api/resumes/:id/duplicate | `title`, opcionalmente `job`. Crea una variante. |
| POST /api/imports | `multipart/form-data` con `file`. Extrae y clasifica para revisión. |
| DELETE /api/imports/:id | Descarta una importación pendiente propia. |
| GET /api/resumes/:id/analyses | Devuelve los 30 análisis más recientes. |
| POST /api/resumes/:id/analyses | `grammarConsent` opcional. Calcula y guarda el análisis. |
| POST /api/resumes/:id/compare | `job`. Compara el CV guardado con la oferta sin modificar el documento. |
| POST /api/resumes/:id/ai | `task`, `consent`, `direction` opcional. Devuelve una propuesta para revisión. |
| POST /api/resumes/:id/preview | `data`. Devuelve un PDF en línea del borrador. |
| POST /api/resumes/:id/export | `format` (pdf/docx), `mode` (ats/visual), `acknowledge` opcional. Devuelve los bytes y registra la exportación. |
| GET /api/resumes/:id/exports | Devuelve metadatos de las 30 exportaciones más recientes. |

Las respuestas JSON de error incluyen `error` y, cuando corresponde, `fields`. Los códigos habituales son 401 para sesión ausente, 403 para origen cruzado, 404 para recursos inaccesibles, 409 para conflicto de revisión, 413 para tamaño, 415 para formato, 422 para datos inválidos, 429 para exceso de solicitudes y 503 para servicios sin configurar.
