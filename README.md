# TGym

TGym permite programar rutinas y registrar entrenamientos en Android y web/PWA. Incluye calentamientos, Working/Top/Back-off Sets, supersets, RIR/RPE, progresión, deload, cronómetros, historial, calendario, Consistency, estadísticas, Progress Report, medidas corporales e InBody.

## Desarrollo local

Requisitos: Node 22 y pnpm 10 (las versiones de CI).

```sh
cd frontend
pnpm install --frozen-lockfile
pnpm run dev --mode standalone --host 127.0.0.1
```

Standalone utiliza un perfil local independiente y no necesita la API. En PowerShell, usa `pnpm.cmd`/`npm.cmd` si la política bloquea los shims `.ps1`.

```sh
pnpm test
pnpm build
pnpm build:pwa
pnpm build:mobile
node scripts/check-locales.mjs
node scripts/check-source-strings.mjs
node scripts/check-version.mjs
pnpm run test:fatigue-probe
```

No existen scripts frontend de lint o typecheck. `build:mobile` sincroniza Capacitor; no compila un APK. Android requiere JDK 21 y SDK 35: desde `frontend/android`, ejecuta `./gradlew assembleRelease lintRelease` (Windows: `gradlew.bat`). iOS requiere macOS/Xcode. La API opcional y MCP usan `npm ci` y `npm test` en sus respectivos directorios; MCP también tiene `npm run check:node-loadable`.

## Configuración y persistencia

Settings -> Back-off repetitions ofrece **Same reps** (mismo rango del Top Set) e **Increased reps** (+2 a ambos límites; 5 fijo ->7). El valor inicial es Increased reps, compatible con 1.15.45. Solo afecta a reps automáticas: las cargas, los rangos independientes explícitos, los resultados manuales y el historial se conservan. Cambiar el modo recalcula los Back-offs pendientes de la sesión activa.

Los cambios pasan por `useStore.update` y se guardan en `gym_state_v1`, con espejo IndexedDB en PWA y archivo privado `framegym-state.json` en móvil. La nueva preferencia es aditiva, viaja en backups y no requiere cambiar claves ni reescribir historial. Los datos son locales salvo sincronización/API o backup Drive habilitados por el usuario.

Data comienza con la explicación de almacenamiento local y transferencias opcionales. Los recordatorios de mediciones y entrenamientos tienen controles independientes y muestran permisos, horarios confirmados y errores. Abrir o cerrar Deload week conserva su configuración. La sincronización inicial de un perfil vacío espera la copia remota completa antes de subir cambios.

## PWA y actualizaciones

Sirve `frontend/dist` tras `pnpm build:pwa` con HTTPS (o localhost). La PWA debe completar la descarga del shell antes de usarse offline. Los medios vistos tienen caché separada; los no descargados pueden mostrar un fallback. El perfil vive fuera de la caché del Service Worker. Borrar los datos del sitio puede eliminar el perfil: conserva backups portables.

Settings -> Check for updates consulta el mecanismo correspondiente a PWA/Android. Android valida host, SHA-256, paquete, versión y firma antes del instalador del sistema; PWA activa el nuevo Service Worker y recarga. No cambies la clave de firma ni rebajes versionCode.

## Documentación

- [Arquitectura y flujo de datos](docs/ARCHITECTURE.md)
- [Progress Report y exportación](docs/PROGRESS-REPORT.md)
- [Offline y sus límites](docs/OFFLINE-AUDIT-2026-09-27.md)
- [Compilación móvil](docs/MOBILE.md)
- [Self-hosting desde este checkout](docs/SELF_HOSTING.md)
- [Publicación y verificación](docs/RELEASING.md)
- [Auditoría de esta actualización](docs/RELEASE-AUDIT-1.15.50.md)
- [Revisión funcional de Ajustes y persistencia](docs/SETTINGS-FUNCTIONAL-AUDIT.md)

## Licencia

TGym deriva de [openGym](https://gitlab.com/DuarteSantos8/opengym), creado por Duarte Santos. Se distribuye bajo [GNU AGPL v3](LICENSE) y conserva el historial y las atribuciones originales.
