# Contribuir a TGym

TGym comparte una aplicación React entre web, PWA y Android/Capacitor. Antes de cambiar un área, consulta [la arquitectura](docs/ARCHITECTURE.md) y las [instrucciones del proyecto](AGENTS.md).

## Dos ramas permanentes

| Rama | Propósito |
| --- | --- |
| `main` | Código estable e integrado; rama predeterminada. |
| `Dev` | Cambios en desarrollo y su validación. |

1. Revisa `git status` y conserva cualquier trabajo local existente.
2. Trabaja en `Dev`; no crees ramas adicionales salvo que el propietario lo solicite.
3. Ejecuta las pruebas y compilaciones correspondientes y revisa el flujo afectado.
4. Publica los commits solicitados en `Dev` y abre un pull request de `Dev` hacia `main` cuando estén listos.
5. Integra después de revisar el diff y las comprobaciones. Conserva `Dev` después del merge y sincronízala con `main` antes del siguiente trabajo.

No fuerces pushes. Los cambios locales sin commit siguen siendo trabajo pendiente y no forman parte de lo publicado en GitHub.

Las propuestas rutinarias de Dependabot están pausadas para evitar ramas adicionales. Sus reglas de compatibilidad se conservan en `.github/dependabot.yml`; los avisos y la configuración de seguridad se mantienen. Las actualizaciones de dependencias se revisan y aplican en `Dev` cuando se soliciten.

## Desarrollo local

Requisitos: Node 22 y pnpm 10, como en GitHub Actions.

```sh
cd frontend
pnpm install --frozen-lockfile
pnpm run dev --mode standalone --host 127.0.0.1
```

Standalone usa un perfil local independiente, sin la API opcional. En PowerShell, usa `pnpm.cmd` o `npm.cmd` si la política bloquea los archivos `.ps1`.

| Directorio | Contenido y comprobaciones |
| --- | --- |
| `frontend/` | React + Vite. `pnpm test`, `pnpm build`, `pnpm build:pwa` y `pnpm build:mobile`. |
| `frontend/android/` | Proyecto Android. Gradle con JDK 21 y SDK 35. |
| `api/` | API opcional. `npm ci` y `npm test`. |
| `mcp/` | Servidor MCP de solo lectura. `npm ci`, `npm test` y `npm run check:node-loadable`. |
| `tools/catalog/` | Herramientas locales de catálogo. `node --test tools/catalog/core.test.mjs` desde la raíz. |
| `web/` | Imagen web y configuración nginx para self-hosting. |
| `docs/` | Arquitectura, auditorías y guías de publicación. |

No hay scripts frontend de lint ni typecheck. `build:mobile` sincroniza Capacitor y no compila un APK. La compilación nativa iOS requiere macOS/Xcode.

## Reglas de implementación

- Haz el cambio coherente más pequeño y mantén los helpers de entrenamiento existentes.
- Usa `useStore.update` para las ediciones persistidas normales; conserva las integraciones de almacenamiento y sincronización.
- Preserva los IDs de ejercicios y rutinas, el historial, los backups y la compatibilidad con datos antiguos.
- Centraliza la duración en `lib/workout-time.js`; mantén separados calentamiento, trabajo, descanso y técnicas de intensidad.
- Mantén sincronizadas las traducciones y utiliza las variables del tema y las preferencias de movimiento reducido.
- No incluyas credenciales, claves de firma, tokens, backups privados ni rutas locales del SDK en commits o reportes públicos.
- Prueba la lógica modificada con casos relevantes y verifica el flujo de usuario antes de integrar.

## Validación y publicación

Tests, Validate PWA y Validate Android comprueban los cambios pertinentes en `main` y `Dev`. Consulta cada ejecución de [GitHub Actions](https://github.com/Truesilverking/TGym/actions) antes de integrar.

Integrar código y publicar una versión son pasos independientes. Android/PWA se publican con tags explícitos `vX.Y.Z`; conserva las validaciones de descarga, SHA-256, paquete, versión y firma. Las imágenes Docker siguen sus triggers existentes en `main` y en releases. Sigue [docs/RELEASING.md](docs/RELEASING.md) y verifica los artefactos y el commit remoto.

## Incidencias y licencia

Abre una [incidencia de TGym](https://github.com/Truesilverking/TGym/issues) con los pasos, el resultado esperado, el resultado observado y la versión/plataforma. Evita adjuntar datos privados o credenciales.

Las contribuciones se distribuyen bajo la [GNU AGPL v3](LICENSE). TGym conserva el historial y las atribuciones de openGym.
