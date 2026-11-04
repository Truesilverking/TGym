# TGym 1.15.73 / Android 109

Publicado el 19 de octubre de 2026 desde `38751265d383c55d2094ac53fe2a4e0954d4f247`, en `fix/calendar-tracking-marker-1.15.73`, para aplicar Pendiente `#696969` y sustituir la categoría «Not Tracking Yet» por el indicador externo de inicio del registro confirmado por el propietario. Diseño y flujo de datos: [CALENDAR-TRACKING-AUDIT-1.15.73.md](CALENDAR-TRACKING-AUDIT-1.15.73.md).

El tag anotado `v1.15.73` se creó después de aprobar las cuatro puertas de CI y comprobar el candidato firmado. [Release 39322393344](https://github.com/Truesilverking/TGym/actions/runs/39322393344) aprobada; [versión pública](https://github.com/Truesilverking/TGym/releases/tag/v1.15.73). La documentación de cierre va en un commit separado y no cambia el runtime publicado.

## Verificación local

- Frontend: 191 archivos, **2093 pruebas aprobadas**. API: 16/16. MCP: 37/37 y carga del grafo bajo Node aprobada.
- Pruebas focalizadas de calendario/estado: 28/28; otros seis archivos de regresión de reportes/locale: 69/69.
- Doce locales, 1920 claves sincronizadas y 1216 cadenas de fuente cubiertas en español. Versión 1.15.73/code 109 coherente.
- Builds web, PWA y mobile assets/Capacitor sync aprobados. No hay scripts frontend de lint/typecheck; la compilación nativa iOS requiere macOS/Xcode.
- Android local `assembleDebug :app:lintDebug`: BUILD SUCCESSFUL en 14 s, 386 tareas; el aviso existente del formato XML del SDK no es un fallo de compilación.
- Navegadores Edge/WebKit: 256 casos de pantalla en cuatro niveles de zoom, 320/390 px, claro/oscuro y ocho acentos. Gris, texto, borde, eliminación de categoría y marcador externo correctos; selección previa con fecha visible y sin etiqueta.
- Se abrieron 36 archivos guardados, incluidos seis descargados desde UI. Poppler renderizó 100 páginas PDF; 9036 muestras de relleno coinciden y 7612 celdas blancas conservan borde explícito. PNG/PDF, períodos cortos/largos, Full, años completos y combinado revisados sin recortes ni deformación observados.
- Frontera efectiva del seguimiento: 60 escenarios de reportes y los 13 idiomas aprobados. Vista previa/descarga idénticas, cancelación local de compartir sin envío a receptores y datos sintéticos conservados.
- Comparación independiente con el tag exacto 1.15.72: 144 resultados Streak, 72 calendarios y 18 estadísticas idénticos, incluidos estados y entradas originales.

Todos los perfiles de prueba son sintéticos y aislados; no se transmiten reportes a terceros. Las comprobaciones de navegador/emulador se distinguen de recepción/instalación en Android físico y Safari/PWA de iPhone real.

## Aceptación del build exacto

El PWA congelado tiene versión 1.15.73 y commit `38751265d383c55d2094ac53fe2a4e0954d4f247`. Edge y WebKit cargaron su worker, verificaron pantalla/leyendas/indicador en claro/oscuro y tres acentos y descargaron diez archivos reales de UI: cuatro PNG y seis PDF, incluidos dos combinados. Se abrieron todos, se renderizaron ocho páginas PDF con Poppler y se comprobaron rellenos y marcador en cada página/PNG. Vista previa/descarga iguales y datos comprobados intactos.

Otros cuatro perfiles aislados probaron 72→73 mediante Check/Update: normal y sesión pausada en cada motor. Los perfiles normales conservan el backup portable completo; los pausados conservan los campos inmutables y activos comprobados, mientras las marcas de interacción pueden avanzar legítimamente. Respaldo previo con checksum válido, todos los hashes de precaché exactos y reapertura completa del navegador sin conexión/origen detenido aprobados. La sesión pausada conserva 9:00, una serie hecha y otra pendiente, sin completar ni añadir historial.

Se abrieron otros 16 archivos descargados offline. Poppler renderizó 52 páginas PDF; se comprobaron 6304 muestras de celdas/leyendas, incluidas 348 Pendiente `#696969`, 56 marcadores verde azulado y 4544 celdas blancas con borde. Las seis imágenes de Consistency Full son idénticas a la QA de UI previa; Streak Full difiere únicamente en la fecha de generación 17→19, con calendarios, leyendas e indicador idénticos. Edge usa `navigator.onLine=false`; WebKit detiene el origen y reinicia el proceso, pero conserva `navigator.onLine=true` por limitación de automatización: es emulación móvil, no iPhone físico.

Evidencia local: `.tools/colors73/{screen-proof,reports-proof,report-ui-proof,metrics-proof,file-review-proof,tracking-locales-proof,exact-pwa-acceptance}.json`, `.tools/colors73/built-acceptance/{proof,file-review-proof}.json` y `.tools/colors73/pwa-exact3875126-file-review/proof.json`.

## CI exacto antes del tag

| Puerta | Ejecución y resultado |
| --- | --- |
| Tests | [39321404377](https://github.com/Truesilverking/TGym/actions/runs/39321404377), aprobado: 2093 frontend, 16 API, 37 MCP, 6 catálogo y comprobaciones de locales/fatiga/carga Node |
| PWA | [39321407930](https://github.com/Truesilverking/TGym/actions/runs/39321407930), aprobado; artefacto 12219803461 con CRC y metadata exactos |
| Android | [39321411243](https://github.com/Truesilverking/TGym/actions/runs/39321411243), aprobado: build/lint y 11 tests de emulador, cero fallos/omitidos |
| Candidato firmado | [39321414983](https://github.com/Truesilverking/TGym/actions/runs/39321414983), aprobado; artefacto 12219569841 inspeccionado independientemente antes del tag |

Los 50 recursos compilados del PWA local y CI son byte por byte iguales. Se explicaron por completo cinco diferencias estáticas: CRLF/LF, una línea vacía en HTML y el digest de caché derivado. El digest del shell CI coincide con su plantilla del commit exacto. No se afirma igualdad binaria total entre ambos shells.

El candidato usa `app.framegym.mobile`, versión 1.15.73/code 109, min SDK 23 y target/compile SDK 35; APK no depurable. CRC, checksums y firmas APK/JAR de AAB válidos, con 61 recursos web idénticos entre ambos. Conserva el certificado oficial de 72: `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`.

SHA-256 APK candidato: `9190ff206aae3bf6696aa4a128b46b161594daa28c46c477f095764bd475cb20`. AAB candidato: `16037b59b65f80ddedf395f40fecd903019dd3c5b4bee0203748090f5a606a5f`.

## Publicación y aceptación pública

| Artefacto público | Bytes | SHA-256 |
| --- | --- | --- |
| APK GitHub y Pages, idénticos | 9031464 | `0a868bdffcf39e2bd9ae7d26089fd8d1dfa2fabdf5e818c8e561e29f5f042cc2` |
| AAB | 8080194 | `16037b59b65f80ddedf395f40fecd903019dd3c5b4bee0203748090f5a606a5f` |

Las firmas, identidad, SDK y metadata pública coinciden con la fuente verificada. Las 1116 entradas del APK público y candidato son idénticas en contenido y metadata; el SHA de archivo difiere solo por el bloque de firma. El AAB completo es byte por byte idéntico al candidato. Se validaron checksums/CRC y las firmas de los paquetes públicos independientemente del workflow.

`updates/latest.json` público identifica 73/code 109/3875126 y `build.json` indica 73/3875126. Los actualizadores GitHub y PWA ofrecen 73 desde 72 y no repiten oferta desde 73. Los 57 recursos del shell público coinciden con el digest de caché `tgym-app-1.15.73-38751265d383c55d2094ac53fe2a4e0954d4f247-7c1e19c0efc6` y la plantilla del commit exacto.

El tag remoto anotado apunta a la fuente verificada y habilita el aviso existente. FCM aceptó los dos topics `tgym_updates` y `tgym_updates_v2` a las **16:52:31 de Santo Domingo**, sin reintentos ni reenvíos. Es aceptación por el servicio; no demuestra recepción, toque ni instalación en un teléfono.

La URL pública se abrió en perfiles nuevos de Edge y WebKit: versión/commit/worker correctos, gris exacto y texto blanco, seis categorías de leyenda, ningún «Not Tracking Yet» visible ni en aria/title, fechas previas blancas e indicador externo con fecha correcta. Se descargaron diez archivos reales: cuatro PNG y seis PDF, incluidos combinados, con ocho páginas renderizadas por Poppler. Los cuatro rellenos y el marcador están presentes en todos los archivos, sin deformaciones observadas; preview y descarga coinciden y los datos comprobados se conservan. Los cuatro PNG públicos son byte por byte idénticos a los del build exacto.

Evidencia: `.tools/colors73/{public-artifacts-verified,updater-verified,notification-verified,candidate-public-apk-entries,candidate-public-comparison}.json` y `.tools/colors73/published-acceptance/{proof,file-review-proof,exact-built-png-match}.json`.

Se repitieron los cuatro perfiles de actualización con el shell público descargado y verificado, servido localmente: normal/pausado × Edge/WebKit. Check/Update 72→73, respaldo previo válido, hashes de caché y reapertura completa sin conexión/origen detenido aprobaron; la sesión pausada conservó 9:00 y sus series sin generar historial. Se abrieron los 16 archivos offline: 52 imágenes PDF y cuatro PNG son píxel por píxel idénticos a la QA del build exacto. Se renderizaron ocho páginas representativas y se revisaron los cuatro PNG. Resumen: `.tools/colors73/public-pwa-acceptance.json`; revisión: `.tools/colors73/pwa-public3875126-file-review/proof.json`.

Resumen estructurado: [AUDIT-EVIDENCE-1.15.73.json](AUDIT-EVIDENCE-1.15.73.json). La matriz integral previa conserva su alcance y pendientes.

## Pendientes concretos

No hay dispositivo conectado por ADB. Recepción/toque/instalación Android físicos, Safari/PWA instalada de iPhone, compilación Xcode y compartir nativo hacia receptores reales permanecen pendientes. Se mantienen los límites de lector de pantalla físico, presión real de almacenamiento, Drive con otro equipo/cuenta y Health Connect con proveedor descritos en la [auditoría integral](APP-AUDIT-2026-10-19.md). No se afirma cobertura física por las pruebas de navegador, WebKit móvil o emulador Android.
