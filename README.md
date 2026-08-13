# ParkMaster Pro Backup

Respaldo recuperado desde el despliegue publico:

`https://garaje-26c50.web.app/`

## Estructura

- `public/index.html`: interfaz HTML recuperada.
- `public/style.css`: estilos personalizados recuperados.
- `public/app.js`: logica local del sistema de cochera.
- `public/auth.js`: autenticacion, licencia y conexion Firebase.
- `public/download-manifest.json`: lista de recursos encontrados durante la recuperacion.
- `firebase.json`: configuracion base para Firebase Hosting.
- `server.mjs`: servidor local simple para revisar la app.

## Ejecutar Localmente

```bash
npm start
```

Abre `http://localhost:8765`.

La app usa recursos externos por CDN: Tailwind, Lucide, jsPDF, Google Fonts y Firebase Web SDK. Necesita internet para cargar igual que el despliegue original.

## Importante

Este respaldo recupera el frontend publicado. No exporta datos privados de Firebase Auth, Firestore, reglas, indices, usuarios ni configuracion interna del proyecto Firebase.

Para usarlo como proyecto nuevo, cambia `firebaseConfig` en `public/auth.js` por la configuracion del nuevo proyecto Firebase, habilita Authentication con Email/Password y crea Firestore.
