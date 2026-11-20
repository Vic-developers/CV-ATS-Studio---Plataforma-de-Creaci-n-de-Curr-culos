# Instalación y despliegue

Consulta el [inicio local](README.md) para arrancar PostgreSQL y Next.js en desarrollo.

## Variables

| Variable | Configuración |
| --- | --- |
| DATABASE_URL | Cadena PostgreSQL. Usa TLS para conexiones remotas. |
| DIRECT_DATABASE_URL | Conexión directa opcional para Prisma Migrate cuando `DATABASE_URL` utiliza un pool. |
| APP_ORIGIN | Origen absoluto del sitio. Usa HTTPS en producción. |
| SMTP_URL, SMTP_FROM | Credenciales SMTP y remitente autorizado. Habilitan recuperación. |
| AI_BASE_URL, AI_API_KEY, AI_MODEL | Endpoint base, credencial y modelo compatible con Chat Completions y salida JSON. |
| LANGUAGE_TOOL_URL | Instancia de LanguageTool con ruta `/v2/check`. Habilita ortografía y gramática externas. |
| TRUST_PROXY | Usa `true` solo con un proxy de confianza. |
| CV_DB_PORT | Puerto de PostgreSQL publicado por Compose. Por defecto 55432. |

## Producción

Configura PostgreSQL, secretos, correo, proveedor de IA y HTTPS en la plataforma elegida. Sitúa la aplicación detrás del proxy y restringe acceso directo al proceso Node.js. Despliega desde una copia limpia.

```text
npm ci
npm run check
npm test
npm run build
npm run db:deploy
npm start
```

Ejecuta `db:deploy` una vez por versión antes de dirigir tráfico a los procesos nuevos. Habilita copias de seguridad y el mantenimiento diario descrito en [base de datos](DATABASE.md). Verifica con una cuenta de prueba el flujo de recuperación y una solicitud real a cada servicio externo que habilites. Usa un servidor de Node.js con acceso a PostgreSQL y a las fuentes incluidas en assets/fonts.

En Windows, la configuración inicial de Docker Compose evita el puerto 5432 del host. Si 55432 está reservado también, ajusta `CV_DB_PORT` y el puerto de `DATABASE_URL` en la misma dirección.

## Despliegue gratuito con Render y Neon

Render ejecuta el servidor Node.js y Neon mantiene la base PostgreSQL, incluidos los currículums, los archivos originales y las exportaciones. Esta configuración sirve para uso personal o de bajo tráfico. Consulta los límites vigentes de [Render Free](https://render.com/docs/free) y [Neon](https://neon.com/pricing).

1. Crea un proyecto PostgreSQL en Neon y copia su cadena de conexión TLS. Si usas la dirección con pool para la aplicación, puedes guardar la dirección directa en `DIRECT_DATABASE_URL` para las migraciones.
2. Crea un **Web Service** de tipo **Node** en Render y conecta este repositorio de GitHub. Selecciona el plan **Free**.
3. Configura el servicio con los valores de la tabla. Guarda las cadenas y las claves como variables de entorno en Render. En `APP_ORIGIN` usa la dirección HTTPS exacta asignada al servicio, sin barra final.
4. Despliega y revisa los registros de compilación y migración. Abre la URL, crea una cuenta y prueba guardar, importar y descargar un CV de prueba. Una base nueva empieza vacía. Si necesitas conservar las cuentas y documentos locales, migra los datos de forma explícita.

| Campo en Render | Valor |
| --- | --- |
| Build Command | `npm ci --include=dev && npm run build && npm run db:deploy` |
| Start Command | `npm start -- --hostname 0.0.0.0` |
| NODE_VERSION | `24.22.1` |
| DATABASE_URL | Cadena de conexión TLS de Neon |
| DIRECT_DATABASE_URL | Cadena directa de Neon, cuando se configura por separado para migraciones |
| APP_ORIGIN | La URL HTTPS de Render o del dominio público configurado |

El registro, la edición, la comparación con vacantes y las exportaciones funcionan con PostgreSQL. Para habilitar el asistente de IA configura las tres variables `AI_*`. Para recuperar contraseñas configura `SMTP_URL` y `SMTP_FROM` con un remitente autorizado. Render Free bloquea los puertos SMTP 25, 465 y 587. Si tu proveedor admite el puerto 2525, verifica una entrega real desde el servicio. [Puertos SMTP de Render](https://render.com/docs/free#other-limitations)
