# CV ATS Studio

Aplicación en español para crear e importar currículums, evaluar su preparación ATS, adaptarlos a vacantes y descargarlos en PDF con texto seleccionable o DOCX editable.

- **Editor y ATS.** Lectura del texto extraído de PDF y Word, evidencias por requisito, comparación y restauración de versiones.
- **Importación.** OCR local de PDF escaneados en español e inglés, con revisión junto a los campos editables.
- **Postulaciones.** Banco de logros confirmados y seguimiento de vacantes con una copia de la revisión o del archivo enviado.
- **Privacidad.** Descarga y eliminación de datos de la cuenta y gestión de los archivos de cada CV.

## Inicio local

Requisitos de desarrollo: Node.js 22.13 o posterior, npm y Docker Compose o una instancia de PostgreSQL 16.

```powershell
Copy-Item .env.example .env
docker compose up -d --wait db
npm ci
npm run db:deploy
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) y registra una cuenta. Docker publica PostgreSQL en el puerto local 55432. Si ya usas otra instancia, modifica `DATABASE_URL` y aplica la migración en una base dedicada.

## Despliegue

La [guía de instalación](INSTALLATION.md#despliegue-gratuito-con-render-y-neon) incluye los comandos y las variables para publicar con Render Free y PostgreSQL en Neon. El repositorio incluye un `.env.example` para desarrollo local.

## Pruebas

```text
npm run check
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

La IA requiere un proveedor compatible configurado y la recuperación por correo requiere SMTP. Consulta [Instalación](INSTALLATION.md) para configurar ambos servicios y desplegar sobre Node.js.

- [Guía de uso](DOCUMENTATION.md)
- [Arquitectura](ARCHITECTURE.md)
- [Base de datos](DATABASE.md)
- [API REST](API.md)
- [Seguridad y privacidad](SECURITY.md)
- [Instalación y despliegue](INSTALLATION.md)
- [Cambios](CHANGELOG.md) · [Contribución](CONTRIBUTING.md)
