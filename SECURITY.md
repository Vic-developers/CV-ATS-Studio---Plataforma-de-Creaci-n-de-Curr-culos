# Seguridad y privacidad

## Aplicación

- Las contraseñas usan scrypt con sal aleatoria. Las cookies de sesión son HttpOnly y SameSite=Lax, y en producción usan Secure y el prefijo `__Host-`. PostgreSQL almacena el hash de los tokens de sesión y recuperación.
- La recuperación usa tokens aleatorios de un solo uso que expiran a los 30 minutos. Cambiar la contraseña revoca las sesiones.
- Las mutaciones verifican el origen. Las consultas de CV se filtran por el ID propietario y los subrecursos se resuelven después de verificar la propiedad.
- Las páginas usan una política de seguridad de contenido con nonce para scripts. Las vistas representan texto mediante React y evitan insertar HTML aportado por usuarios. Los enlaces admitidos son HTTP y HTTPS. El PDF se genera con texto y el DOCX se importa mediante extracción de texto.
- Los archivos se validan por extensión, MIME, firma, tamaño, estructura y límites de contenido. Los DOCX se reconstruyen a partir de las partes XML permitidas antes de extraer texto.
- Los datos se envían a un servicio externo solo al autorizar una solicitud de IA o una revisión lingüística. En solicitudes de IA se excluyen campos de contacto y referencias, aunque el texto libre puede contener información personal.

## Operación

Usa HTTPS, PostgreSQL en una red privada, cifrado de discos y copias de seguridad, y un gestor de secretos. Configura las políticas de retención y privacidad del proveedor de IA para prohibir el uso de los CV para entrenamiento sin consentimiento explícito. Cada configuración de proveedor debe revisarse según sus términos.

Solo activa `TRUST_PROXY` detrás de un proxy que sobrescriba `X-Real-IP` y bloquee acceso directo al Node.js. Aplica un límite de tamaño de peticiones en la entrada y límites de uso por IP. Monitoriza errores y consumo sin registrar documentos, claves ni tokens.

Eliminar un CV borra sus datos y archivos asociados de las tablas operativas. Programa la caducidad de las copias de seguridad según la política de retención. Conserva copias y variantes activas solo mientras el usuario las mantenga.
