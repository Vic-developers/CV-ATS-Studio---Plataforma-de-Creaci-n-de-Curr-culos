# Arquitectura

- `src/app` contiene las páginas de Next.js y la entrada de la API REST. Las sesiones y los secretos se procesan del lado de Node.js.
- `src/ui` contiene el panel, los siete pasos del editor, el diseñador y los paneles de revisión.
- `src/domain` contiene el contrato Zod, el orden semántico de lectura, las reglas de presentación, el motor ATS y la comparación de vacantes.
- `src/server` contiene autenticación, servicios de currículums y almacenamiento, extracción, generación documental y el adaptador de IA.
- `prisma` contiene el modelo y la migración inicial.
- `tests` cubre reglas de negocio, lectura y escritura documental, seguridad y la experiencia completa en Chromium.

## Decisiones

Se usa un documento tipado por currículum para aplicar guardados y duplicaciones atómicas. La revisión numérica impide que un guardado atrasado sobrescriba una edición más reciente.

La función `documentBlocks` produce un flujo semántico común con título, subtítulo, contacto, encabezados, párrafos y viñetas. PDFKit genera el PDF con fuentes incrustadas. docx genera el archivo editable con encabezados de Word y listas reales. El HTML usa las mismas reglas de presentación y la vista de impresión usa el PDF efectivo.

El análisis local ejecuta reglas explicables sin enviar datos. La revisión gramática externa es opcional. La IA usa una interfaz de proveedor servidor-servidor. Para agregar otro proveedor, implementa la interfaz `Provider` y selecciónalo en `recommend` sin modificar el modelo ni las pantallas.

Para ampliar la interfaz a otro idioma, agrega mensajes para las vistas y conserva las claves tipadas del modelo. Los encabezados del documento ya distinguen español e inglés.
