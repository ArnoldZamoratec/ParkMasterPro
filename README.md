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

## Despliegue seguro (obligatorio)

El proyecto incluye `firestore.rules` con control por tenant. Antes de desplegar:

1. Despliega las reglas: `firebase deploy --only firestore:rules`.
2. Crea manualmente en Firestore el documento `admins/{uidDelSuperAdmin}` con el campo `grantedAt` (timestamp). Sin este documento nadie (ni el super admin) podra operar el panel SaaS.
3. Los clientes deben existir como documentos en `users/{uid}` (el super admin los crea desde el Panel SaaS). La autocreacion de cuentas sin documento previo queda bloqueada.
4. Verifica que los headers de seguridad (CSP, X-Frame-Options) de `firebase.json` no bloqueen la app en tu entorno antes de desplegar a produccion.

Si aun no migras los datos operativos a Firestore, la app sigue funcionando 100% en `localStorage`; las reglas solo protegen licencias y preparan la sincronizacion multi-dispositivo.
