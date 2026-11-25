# TGym 1.15.74 / Android 110

Publicado el 19 de octubre de 2026 desde `e06c725e200d2cff28b02dada58f4ed1a809d03c`, en `fix/not-trained-red-1.15.74`, con el último ajuste de color solicitado por el propietario: **Not Trained / No entrenado `#ED1C24`**, en calendario, leyendas y todos los PDF/PNG/combinados de Streak y Consistency.

El tag anotado `v1.15.74` apunta a esa fuente y se creó después de validar las cuatro puertas de CI y el candidato firmado. [Release 39324636686](https://github.com/Truesilverking/TGym/actions/runs/39324636686) aprobada; [versión pública](https://github.com/Truesilverking/TGym/releases/tag/v1.15.74). La documentación de cierre va en otro commit y no altera el runtime publicado.

Solo cambia el triple compartido `missed` en `calendar-visual.js`: fondo `#ed1c24`, texto `#000000` y borde `#8f1015`. El texto negro conserva contraste 4,79:1; el blanco daría 4,38:1. La pausa sigue en rojo oscuro `#791f34`, Pendiente en `#696969`, Descanso en blanco y se mantienen el indicador externo de fecha y la eliminación de la categoría visible de Sin seguimiento de 73. No se modifican datos, reglas, cálculos, formatos ni geometría.

La regresión comprueba el triple exacto por igual en pantalla/reportes y exige separación perceptual entre todas las categorías, además de texto legible. Los resultados de tests, archivos reales, CI, publicación y límites de dispositivo se registran aquí. La auditoría y las decisiones previas permanecen en [RELEASE-AUDIT-1.15.73.md](RELEASE-AUDIT-1.15.73.md) y [APP-AUDIT-2026-10-19.md](APP-AUDIT-2026-10-19.md).

## Verificación local

- Frontend: 191 archivos, 2093 pruebas aprobadas. Pruebas focalizadas de estado/calendario: 28/28.
- Builds web, PWA y mobile assets/Capacitor sync aprobados. Versión 1.15.74/code 110 coherente.
- Android local `assembleDebug :app:lintDebug`: BUILD SUCCESSFUL en 36 s, 386 tareas.
- Comparación con el tag exacto 1.15.73: 144 resultados Streak, 72 calendarios y 18 estadísticas idénticos, incluidos los datos de entrada.
- Edge/WebKit: 256 casos de pantalla en cuatro niveles, dos tamaños, claro/oscuro y ocho acentos; relleno, texto, bordes y leyendas correctos. Comparación de paleta contra 73: todos los demás estados y el indicador son idénticos.
- Se abrieron 36 archivos guardados, incluidos seis de UI. Poppler renderizó 100 páginas PDF y 9036 muestras de relleno coinciden. PDF/PNG, Full, años completos y combinado revisados visualmente: rojo solicitado y fechas negras legibles, pausa oscura distinguible, gris e indicador conservados; sin deformaciones observadas. Preview/descarga y cancelación local de compartir aprobadas, sin receptores de terceros.
- No hay scripts frontend de lint/typecheck. iOS native requiere macOS/Xcode; no se afirma compilación nativa iOS desde Windows.

Evidencia local: `.tools/colors74/{screen-proof,reports-proof,report-ui-proof,metrics-proof,palette-proof,file-review-proof}.json`; builds/tests en `.tools/colors74-*.log` y Android en `.tools/colors74/android-build-lint.log`. Los perfiles son sintéticos y aislados.

## Build exacto y actualización de prueba

El PWA congelado identifica versión 1.15.74 y commit `e06c725e200d2cff28b02dada58f4ed1a809d03c`. Edge y WebKit verificaron worker, paleta y leyendas y descargaron diez archivos reales de UI: cuatro PNG y seis PDF, con ocho páginas renderizadas por Poppler. Se comprobó en todos el rojo exacto y texto negro dentro de las celdas rojas, además de los otros colores y el indicador. Vista previa y descarga coinciden; sin errores JavaScript ni cambios de los datos comprobados.

Cuatro perfiles separados probaron 73→74 mediante Check/Update: normal y sesión pausada en cada motor. Los normales conservan el backup portable completo; los pausados conservan los campos inmutables y activos comprobados, con marcas de interacción que pueden avanzar legítimamente. Backup previo con checksum válido, espejo IndexedDB, caché completa verificada por SHA-256 y reapertura del proceso offline aprobados. La sesión pausada conserva 9:00, una serie hecha y otra pendiente, sin completar ni añadir historial.

Se abrieron 16 exportables offline y se renderizaron 52 páginas PDF con Poppler, además de cuatro PNG. Las 6304 muestras de celdas/leyendas incluyen 292 No entrenado en rojo/negro, 348 Pendiente grises, 56 marcadores y 4544 blancos con borde. Consistency Full coincide píxel por píxel con la QA de UI; Streak Full solo difiere en la fecha de generación 17→19 y conserva todos los calendarios/leyendas/indicadores. Edge usa `navigator.onLine=false`; WebKit reinicia el proceso con origen detenido, pero conserva `navigator.onLine=true` por limitación de automatización: es emulación móvil y no prueba de iPhone real.

Evidencia: `.tools/colors74/built-acceptance/{proof,file-review-proof}.json`, `.tools/colors74/exact-pwa-acceptance.json` y `.tools/colors74/pwa-exacte06c725-file-review/proof.json`.

## CI exacto previo al tag

| Puerta | Ejecución y resultado |
| --- | --- |
| Tests | [39323654918](https://github.com/Truesilverking/TGym/actions/runs/39323654918), aprobado: 2093 frontend, 16 API, 37 MCP, 6 catálogo y comprobaciones de locales/fatiga/carga Node |
| PWA | [39323657802](https://github.com/Truesilverking/TGym/actions/runs/39323657802), aprobado; artefacto 12220224904 con CRC y metadata exactos |
| Android | [39323660115](https://github.com/Truesilverking/TGym/actions/runs/39323660115), aprobado: build/lint y 11 tests de emulador, cero fallos/omitidos; artefacto 12222065824 |
| Candidato firmado | [39323662782](https://github.com/Truesilverking/TGym/actions/runs/39323662782), aprobado; artefacto 12221836642 inspeccionado independientemente antes del tag |

Los 50 recursos compilados del PWA local y CI son byte por byte iguales. Cinco diferencias estáticas están explicadas por CRLF/LF, una línea vacía HTML y el digest de caché derivado; el digest del shell CI coincide con la plantilla del commit exacto. No se afirma igualdad binaria total de ambos shells.

El candidato mantiene `app.framegym.mobile`, versión 1.15.74/code 110, min SDK 23 y target/compile SDK 35; no es depurable. CRC, checksums, firma APK/JAR de AAB y continuidad del certificado oficial aprobados: `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`. Los 61 recursos web APK/AAB coinciden.

SHA-256 APK candidato: `c59aa163197a4abf1760ce86aaa2e4b939672983157476e5a5e14138facdf0ae`. AAB candidato: `77abc5df0cb0b620d611277e4d79b7fedbffa276cbfd042455c66f6569f6ba26`.

## Verificación pública

| Artefacto público | Bytes | SHA-256 |
| --- | --- | --- |
| APK GitHub y Pages, idénticos | 9031400 | `86bb001d5f45ec4828fae570193b20b7fec00a0bdd2f19d42a138d8d7a12627b` |
| AAB | 8080157 | `77abc5df0cb0b620d611277e4d79b7fedbffa276cbfd042455c66f6569f6ba26` |

Identidad, SDK, firmas, checksums y CRC públicos verificados independientemente. El APK público y candidato tienen 1116 entradas idénticas en contenido y metadata; su SHA de archivo difiere únicamente por el bloque de firma. El AAB completo es byte por byte idéntico al candidato; los 61 recursos web de ambos paquetes coinciden.

`updates/latest.json` público identifica 1.15.74/code 110/e06c725 y `build.json` indica 74/e06c725. Los actualizadores GitHub y PWA ofrecen 74 desde 73 y no repiten oferta desde 74. Los 57 recursos del shell público coinciden con la plantilla del commit exacto y el digest del worker `tgym-app-1.15.74-e06c725e200d2cff28b02dada58f4ed1a809d03c-d461394c2d23`.

La política del tag remoto anotado habilitó el mecanismo existente de aviso. FCM aceptó `tgym_updates` y `tgym_updates_v2` a las **17:10:28 de Santo Domingo**, sin reintentos ni reenvíos. Esto confirma aceptación del servicio y no recepción, toque o instalación en un teléfono.

La URL pública se abrió en perfiles nuevos de Edge y WebKit con versión/commit/worker correctos, rojo exacto y fechas negras en celdas/leyendas. Los estados restantes, ausencia de categoría visible de Sin seguimiento y marcador externo se conservaron. Se descargaron y abrieron diez archivos reales de UI: cuatro PNG y seis PDF, incluidos combinados, con ocho páginas renderizadas por Poppler. En todos se comprobó `#ED1C24` y negro dentro de las celdas rojas, los otros rellenos y el marcador; sin deformaciones observadas, datos comprobados intactos, preview/descarga iguales y cero errores JavaScript. Los cuatro PNG públicos son byte por byte idénticos a los del build exacto validado.

Evidencia: `.tools/colors74/{public-artifacts-verified,updater-verified,notification-verified,candidate-public-apk-entries,candidate-public-comparison}.json` y `.tools/colors74/published-acceptance/{proof,file-review-proof,exact-built-png-match}.json`.

La actualización se repitió con el shell público verificado y servido localmente en cuatro perfiles aislados: normal/pausado × Edge/WebKit. Los cuatro aprobaron Check/Update 73→74, checksum de respaldo previo, espejo IndexedDB, hashes de caché y reapertura completa offline/origen detenido. Los datos normales coinciden y las sesiones pausadas conservan sus campos comprobados, 9:00 y series sin generar historial. Se abrieron los 16 archivos offline públicos: sus 52 imágenes PDF y cuatro PNG son píxel por píxel idénticos a la QA del build exacto. Se renderizaron ocho páginas representativas con Poppler y se revisaron los cuatro PNG reales, sin problemas de color, geometría, leyenda o indicador. Resumen: `.tools/colors74/public-pwa-acceptance.json`; revisión: `.tools/colors74/pwa-publice06c725-file-review/proof.json`.

Resumen estructurado: [AUDIT-EVIDENCE-1.15.74.json](AUDIT-EVIDENCE-1.15.74.json). Muestras sintéticas guardadas en `output/pdf/*1.15.74*`; no se incluyen datos personales en GitHub.

## Pendientes y alcance

Android físico (recepción/toque/instalación), Safari/PWA instalada en iPhone, compilación Xcode y compartir nativo con receptores reales permanecen pendientes. Las pruebas de Edge, WebKit emulado y emulador Android se identifican como tales. Los límites de lector de pantalla físico, presión real de almacenamiento, Drive/otro equipo y Health Connect con proveedor siguen documentados en la [auditoría integral](APP-AUDIT-2026-10-19.md). Esta versión corrige únicamente la preferencia final de color; no se afirma una nueva auditoría física ni cobertura absoluta de toda la app.
