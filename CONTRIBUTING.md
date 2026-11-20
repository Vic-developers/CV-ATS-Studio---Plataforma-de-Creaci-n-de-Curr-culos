# Contribuir

Usa una base de datos local de pruebas y datos sintéticos. Mantén el contrato Zod y los flujos de importación y exportación alineados. Añade migraciones con Prisma para cambios de almacenamiento.

Ejecuta la verificación de tipos, las pruebas de dominio y generación documental, las pruebas Playwright y la compilación. En cambios de exportación, comprueba orden de lectura, acentos, fechas, viñetas, encabezados y contenido cerca de los saltos de página mediante un lector independiente.

Para renderizar los PDF de la prueba documental, ejecuta `npm test` con `CV_TEST_ARTIFACTS=true` y usa Poppler sobre los archivos de `tmp/pdfs`. Nunca incluyas documentos reales, archivos de entorno ni credenciales en el repositorio.
