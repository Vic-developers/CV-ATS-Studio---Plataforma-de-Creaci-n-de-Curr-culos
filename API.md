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
| GET /api/resumes/:id/exports | Devuelve metadatos de las exportaciones guardadas. |

## Lectura, versiones y archivos

| Método y ruta | Cuerpo o efecto |
| --- | --- |
| POST /api/resumes/:id/reading | `format`, `mode` y `exportId` opcional. Extrae el texto del documento generado o de los bytes de una descarga registrada. Devuelve páginas, fragmentos ausentes y posibles cambios de orden. |
| GET /api/resumes/:id/base | Obtiene el CV base si la variante sigue vinculada a un CV de la cuenta. |
| GET /api/resumes/:id/versions | Lista los puntos de control. |
| POST /api/resumes/:id/versions | `label` y `revision` vigente. Guarda un punto de control. |
| GET /api/resumes/:id/versions/:versionId | Obtiene una versión guardada. |
| POST /api/resumes/:id/versions/:versionId | `revision` vigente. Respalda el CV actual y restaura el punto de control. |
| DELETE /api/resumes/:id/versions/:versionId | Elimina un punto de control. |
| GET /api/imports/:id | Descarga el original de una importación propia. |
| GET /api/imports/:id/page?number=1 | Devuelve una página del PDF original como PNG. |
| DELETE /api/resumes/:id/source | Elimina el archivo original de un CV guardado. |
| GET /api/resumes/:id/exports/:exportId | Descarga una exportación guardada. |
| DELETE /api/resumes/:id/exports/:exportId | Elimina una exportación del historial. |

`GET /api/resumes/:id/exports` admite el filtro opcional `revision`. `POST /api/imports` devuelve `pageCount` para PDF y `null` para Word. La comparación de vacantes incluye `requirementEvidence` con requisito, término, estado, cita y sección cuando corresponde.

## Logros, postulaciones y cuenta

| Método y ruta | Cuerpo o efecto |
| --- | --- |
| GET /api/achievements | Lista los logros de la cuenta. |
| POST /api/achievements, PATCH /api/achievements/:id | `title`, `context`, `description`, `metrics` y `confirmed: true`. |
| DELETE /api/achievements/:id | Elimina el logro del banco. |
| GET /api/applications | Lista las postulaciones de la cuenta. |
| POST /api/applications | `company`, `role`, `sentOn` (AAAA-MM-DD), `status`, `url`, `notes`, `resumeId`, `revision` y `exportId` opcional. Registra la postulación y conserva la versión vinculada. |
| PATCH /api/applications/:id | Actualiza los campos de seguimiento. |
| GET /api/applications/:id | Devuelve los datos y el contenido archivado del CV. |
| GET /api/applications/:id/document | Descarga los bytes del archivo archivado si existe. |
| DELETE /api/applications/:id | Elimina la postulación y su copia del CV. |
| GET /api/account/export | Descarga un JSON versionado con los datos y adjuntos de la cuenta. |
| DELETE /api/account | Requiere `password` y `confirm: "ELIMINAR"`. Borra la cuenta y revoca sus sesiones. |

Estados de postulación válidos: `sent`, `interview`, `offer`, `rejected` y `withdrawn`.

Las respuestas JSON de error incluyen `error` y, cuando corresponde, `fields`. Los códigos habituales son 401 para sesión ausente, 403 para origen cruzado, 404 para recursos inaccesibles, 409 para conflicto de revisión, 413 para tamaño, 415 para formato, 422 para datos inválidos, 429 para exceso de solicitudes y 503 para servicios sin configurar.
