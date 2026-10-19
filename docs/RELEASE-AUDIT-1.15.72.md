# TGym 1.15.72 / Android 108

Publicado el 19 de octubre de 2026 desde `65434627d9d045c243c7b7e4ee0190d29f8c39be`, en `fix/calendar-color-parity-1.15.72`, para unificar los cuatro colores de calendario/exportables y hacer blanco Descanso. La presentación reutiliza una definición compartida; no cambia cálculos ni datos. Diseño y alcance: [CALENDAR-COLORS-AUDIT-1.15.72.md](CALENDAR-COLORS-AUDIT-1.15.72.md).

El tag anotado `v1.15.72` apunta exactamente a ese commit y se creó después de comprobar las cuatro puertas de CI y el candidato firmado. [Release 39316370383](https://github.com/Truesilverking/TGym/actions/runs/39316370383) aprobada; [versión pública](https://github.com/Truesilverking/TGym/releases/tag/v1.15.72). La documentación de cierre se guarda en otro commit y no altera el runtime publicado. La instalación/recepción en teléfono e iPhone físico requieren evidencia de dispositivo y permanecen separadas de la emulación.

## Verificación local antes de publicación

- Frontend: 191 archivos, **2086 pruebas aprobadas**; API 16/16; MCP 37/37 y carga Node del grafo completa.
- Doce locales con 1919 claves sincronizadas y 1215 cadenas presentes en fuente. Probe de fatiga: 108000 comparaciones y 14076 eliminaciones aleatorias aprobadas. Versión 1.15.72/code 108 coherente.
- Builds web/PWA/mobile assets y Capacitor sync aprobados. Android `assembleDebug :app:lintDebug`: BUILD SUCCESSFUL, 386 tareas. Xcode/CocoaPods no se ejecutaron en Windows; no se afirma compilación iOS.
- **192 escenarios de pantalla** en Edge/WebKit: semana/mes y mini meses del componente existente, 320/390 px, claro/oscuro y ocho acentos. Fondo/texto/borde/leyenda exactos; blancos delimitados, cuadrados, sin desbordamiento y datos sintéticos conservados.
- **36 archivos guardados** abiertos, incluidos seis descargados desde la interfaz: generación de ambos reportes, PNG/PDF, Full, año, años completos y PDF combinado. Poppler renderizó **100 páginas PDF**; 9036 muestras de relleno de fechas coincidieron con sus colores esperados. Las páginas/hojas de contacto y los PNG fueron revisados visualmente, sin recortes ni solapes observados.
- Vista previa y descarga coinciden byte por byte; cancelación Web Share local sin error/receptor/transmisión. La interfaz nueva y los archivos usan blanco/rojo oscuro/rojo claro/gris claro como se solicitó.
- Comparación independiente con el código exacto de 1.15.71: **144 resultados Streak, 72 calendarios y 18 estadísticas idénticos**, con los datos de entrada intactos.

Evidencia local en `.tools/colors72/{screen-proof,reports-proof,report-ui-proof,metrics-proof,file-review-proof}.json` y logs de tests/builds de la misma carpeta. Se entrega un resumen estructurado al cierre. No existen scripts de lint/typecheck de frontend; se informa Android lint y las comprobaciones disponibles.

## Aceptación del build exacto

El build congelado identifica versión 1.15.72 y commit `65434627d9d045c243c7b7e4ee0190d29f8c39be`. Edge y WebKit cargaron ese worker en perfiles sintéticos separados: pantalla/leyendas en claro y oscuro con tres acentos, diez archivos reales de UI entre PDF/PNG/combinados, vista previa idéntica a descarga y datos intactos. Se abrieron los diez archivos y se renderizaron las ocho páginas PDF; los cuatro colores coinciden, sin deformaciones observadas.

Cuatro perfiles adicionales probaron la actualización real por los controles existentes de 71→72: normal y sesión pausada en cada motor. El respaldo previo validado coincide por completo con el original en los perfiles normales; en los pausados conserva los campos inmutables y de sesión expresamente comprobados, mientras las marcas de interacción pueden avanzar legítimamente. Todos los recursos de precaché coinciden por SHA-256 y la reapertura completa conserva los datos comprobados. Las sesiones pausadas conservan nueve minutos, una serie completada y otra pendiente, sin crear historial. Edge reabrió con `navigator.onLine=false`; WebKit reabrió con origen detenido y proceso reiniciado, pero mantuvo `navigator.onLine=true` por limitación de la automatización. Esto es evidencia de navegador/emulación, no de iPhone físico.

Desde esos perfiles se descargaron otros 16 archivos offline. Se abrieron todos y Poppler renderizó sus 52 páginas PDF; 6304 muestras de celdas/leyenda coinciden con el SVG del mismo perfil y fecha. Las 4544 celdas blancas conservan borde visible. Las seis imágenes de Consistency Full son idénticas a la QA de UI anterior; las seis de Streak Full difieren únicamente en el texto de fecha de generación (17→19), con calendarios y leyendas idénticos.

Evidencia: `.tools/colors72/built-acceptance/{proof,file-review-proof}.json`, `.tools/colors72/pwa-exact6543462-{edge,webkit}[-active-paused]/proof.json` y `.tools/colors72/pwa-exact6543462-file-review/proof.json`.

## CI del commit exacto, antes del tag

| Puerta | Ejecución y resultado |
| --- | --- |
| Tests | [39315143933](https://github.com/Truesilverking/TGym/actions/runs/39315143933), aprobado: 2086 frontend, 16 API, 37 MCP y 6 catálogo, locales, fatiga y carga Node |
| PWA | [39315148175](https://github.com/Truesilverking/TGym/actions/runs/39315148175), aprobado; artefacto 12216224223 con CRC y metadata exactos |
| Android | [39315151687](https://github.com/Truesilverking/TGym/actions/runs/39315151687), aprobado: build/lint y 11 tests de emulador, cero fallos/omitidos |
| Candidato firmado | [39315155323](https://github.com/Truesilverking/TGym/actions/runs/39315155323), aprobado; artefacto 12217174657 inspeccionado independientemente antes de crear el tag |

Los 50 recursos compilados del PWA local y de CI son byte por byte iguales. Los cinco archivos estáticos distintos se explican completamente por CRLF/LF, una línea vacía de HTML y el digest de caché derivado. Se verificó por separado el digest del shell de CI contra la plantilla del commit exacto; no se afirma igualdad binaria total entre ambos shells.

El candidato usa `app.framegym.mobile`, versión 1.15.72/code 108, min SDK 23 y target/compile SDK 35, sin debug. CRC, checksums, firma APK y firma JAR del AAB son válidos; los 61 recursos web de APK y AAB coinciden. Certificado oficial conservado desde 71: `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`.

SHA-256 del APK candidato: `534d8b22d558bf5707eb68cdd7c752160ff501ff8d7852cf47d5985a78674bc0`. SHA-256 del AAB candidato: `2d4ebb02530ffac34e4981fbaf1dd7d49bddc38c60465e214b85f771b7e092d7`.

## Publicación y verificación independiente

| Artefacto público | Bytes | SHA-256 |
| --- | --- | --- |
| APK GitHub y Pages, idénticos | 9031021 | `89484d9cf0d21818c52932c1acd80085a5dc7bffa1b46d2e87e439c21749e55a` |
| AAB | 8079793 | `2d4ebb02530ffac34e4981fbaf1dd7d49bddc38c60465e214b85f771b7e092d7` |

Los paquetes públicos mantienen identidad, SDK, firma oficial y metadata exacta 72/108/6543462. Se validaron checksums, CRC y firmas independientemente del workflow. Las 1116 entradas del APK candidato y público son idénticas en contenido y metadata; su SHA de archivo difiere solo por el bloque de firma. El AAB completo es idéntico al candidato. Los 61 recursos web de cada paquete coinciden.

`updates/latest.json` contiene versión 1.15.72, code 108 y el commit exacto. La PWA pública tiene build 72/6543462 y caché `tgym-app-1.15.72-65434627d9d045c243c7b7e4ee0190d29f8c39be-25055175ae04`; sus 57 recursos de shell descargados coinciden con el digest del worker y la plantilla del commit. Los actualizadores GitHub y PWA ofrecen 72 desde 71 y no repiten oferta desde 72.

El tag remoto es anotado, apunta al commit verificado y habilita el mecanismo existente de aviso. FCM aceptó los dos topics existentes `tgym_updates` y `tgym_updates_v2` a las **16:10:22 de Santo Domingo**, sin reintentos ni reenvíos. Esto confirma aceptación del servicio, no recepción, toque o instalación en un teléfono.

La aceptación fresca de la URL pública en Edge y WebKit verificó pantalla/leyendas en claro/oscuro y tres acentos, identidad exacta del build y datos sintéticos intactos. Se descargaron y abrieron diez archivos reales de UI: cuatro PNG y seis PDF, incluidos dos combinados, con ocho páginas renderizadas con Poppler. Los cuatro colores están presentes y la escala es uniforme; preview y descarga coinciden. Los cuatro PNG públicos son byte por byte idénticos a los del build exacto previamente revisado. Sin errores JavaScript ni receptores de terceros.

Evidencia: `.tools/colors72/{public-artifacts-verified,updater-verified,notification-verified,candidate-public-apk-entries,candidate-public-comparison,candidate-public-payload-verified}.json` y `.tools/colors72/published-acceptance/{proof,file-review-proof,exact-built-png-match}.json`.

La retención se repitió con el shell público descargado y verificado, servido localmente en cuatro perfiles aislados: normal/pausado × Edge/WebKit. Los cuatro casos aprobaron actualización mediante Check/Update, checksum del respaldo previo, caché completa y reapertura del proceso sin conexión/origen detenido. La sesión pausada conserva sus nueve minutos, filas y origen sin completar el entrenamiento. Se abrieron los 16 archivos offline públicos: sus 52 imágenes PDF y cuatro PNG son píxel por píxel idénticos a la QA del build exacto. Se renderizaron ocho páginas representativas adicionales con Poppler y se abrieron los cuatro PNG. Resumen: `.tools/colors72/public-pwa-acceptance.json`; revisión: `.tools/colors72/pwa-public6543462-file-review/proof.json`.

Resumen estructurado publicable: [AUDIT-EVIDENCE-1.15.72.json](AUDIT-EVIDENCE-1.15.72.json). La [matriz integral de la app](APP-AUDIT-2026-10-19.md) conserva sus resultados y límites; esta corrección añade la cobertura de paridad de colores y publicación 72 descrita aquí.

## Límites y pendientes

No hay dispositivo conectado por ADB. Recepción/instalación Android física, Safari/PWA instalada en iPhone y compilación Xcode, compartir hacia receptores reales y lector de pantalla físico siguen pendientes. No se afirma cobertura física por las pruebas de Edge, WebKit o emulador Android. El cambio no amplía el alcance de integraciones de la [auditoría integral 71](APP-AUDIT-2026-10-19.md): Drive/segundo equipo, Health Connect con proveedor y presión real de almacenamiento conservan sus pendientes documentados.
