# Notas de Recuperacion

## Recuperado

- HTML principal completo.
- CSS personalizado.
- JavaScript de operacion del estacionamiento.
- JavaScript de autenticacion y control de licencia.
- Configuracion estatica para servir o desplegar en Firebase Hosting.

## No Recuperado Desde el Despliegue

- Usuarios de Firebase Authentication.
- Documentos de Firestore.
- Reglas de seguridad, indices o backups de la base de datos.
- Datos guardados en el navegador del usuario mediante `localStorage`.

## Dependencias Externas Detectadas

- `https://cdn.tailwindcss.com/`
- `https://unpkg.com/lucide@latest`
- `https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js`
- `https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js`
- `https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap`
- Firebase Web SDK `10.9.0`

## Para Nuevo Firebase

1. Crea un proyecto nuevo en Firebase.
2. Habilita Hosting.
3. Habilita Authentication con Email/Password.
4. Habilita Firestore.
5. Reemplaza el objeto `firebaseConfig` en `public/auth.js`.
6. Crea el primer usuario administrador con el correo que uses como `SUPER_ADMIN`.
7. Despliega el contenido de esta carpeta.
