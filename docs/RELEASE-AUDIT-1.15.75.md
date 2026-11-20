# TGym 1.15.75 / Android 111

Publicado el 19 de octubre de 2026 desde `339d543766c1c534e59000d18937fc83c394ac5b`, rama `fix/partial-routine-logic-1.15.75`. El tag anotado `v1.15.75` se creó después de aprobar las cuatro CI y verificar el candidato firmado. [Release 39328305167](https://github.com/Truesilverking/TGym/actions/runs/39328305167) aprobada; [versión pública](https://github.com/Truesilverking/TGym/releases/tag/v1.15.75). El commit de cierre documental es posterior y no altera la fuente del runtime.

**Parcial usa `#0087C2`** en pantalla, leyendas y PDF/PNG/combinados existentes. Texto negro `#000000`, contraste 5,24:1, y borde `#00547A`. Se conservan No entrenado `#ED1C24`, Pendiente `#696969`, Descanso blanco, pausa `#791F34` y el indicador externo de inicio de registro. No se cambian geometría, etiquetas, formatos, IDs ni cálculos.

El defecto funcional corregido era la contradicción al finalizar una rutina: el reloj reconocía todo el trabajo realizado, pero un calentamiento pendiente hacía que el botón y la confirmación dijeran «Finalizar antes». Ambos consideran ahora únicamente el trabajo requerido. Si queda trabajo pendiente, se conserva la confirmación y la cancelación. El guardado, la duración, el origen, la progresión y la clasificación diaria siguen sus reglas existentes.

La lógica de Parcial se conserva y se documenta: algunas rutinas programadas del día están registradas y otras no, por ejemplo 1/2. Una actividad extra no completa otra rutina programada. No se deduce la prescripción original a partir de filas históricas filtradas ni se reclasifica una sesión manual incompleta. Reglas, causa y compatibilidad: [PARTIAL-ROUTINE-AUDIT-1.15.75.md](PARTIAL-ROUTINE-AUDIT-1.15.75.md).

## Validación local

| Comprobación | Resultado |
| --- | --- |
| Instalación frontend | `pnpm install --frozen-lockfile`, aprobada, lockfile sin cambios |
| Frontend completo | 191 archivos, 2098/2098 pruebas |
| Regresiones de finalización | 41/41 en cuatro archivos; cinco casos nuevos de trabajo/calentamiento, advertencia y cancelación |
| Paleta/calendario | 28/28, contraste, separación y paridad pantalla/exportación |
| API | 16/16 |
| MCP | 37/37 y carga completa con Node |
| Catálogo | 6/6 |
| Locales | 12 paquetes × 1920 claves; 1216 cadenas de fuente |
| Fatiga | 108000 comparaciones y 14076 eliminaciones de historial |
| Builds | Web, PWA y recursos móviles/Capacitor sync aprobados |
| Android local | JDK 21/SDK 35, `assembleDebug :app:lintDebug`, 386 tareas, aprobado en 1 minuto |
| Versión | 1.15.75/code 111, superior a 74/code 110 |

No existen scripts frontend de lint/typecheck. El sync de recursos iOS no compila la app nativa: Windows carece de CocoaPods y Xcode.

Se conservaron los fallos iniciales y sus reproducciones. La primera corrida frontend tuvo dos fallos en el harness de importación: una espera fija de 25 ms comprobaba el estado antes de terminar el guardado y podía continuar después del unmount. La corrección solo de test espera la salida real de `saving`, manteniendo las aserciones de rollback y reintento. La corrida completa final pasó. El primer arranque HTTP de API excedió el hook de 10 segundos bajo carga concurrente; la reproducción focal 5/5 y la API completa secuencial 16/16 pasaron sin cambios de producción.

## Matriz del cambio

Perfiles y archivos sintéticos aislados. La matriz integral previa, su inventario y sus pendientes siguen en [APP-AUDIT-2026-10-19.md](APP-AUDIT-2026-10-19.md); no se presenta este ajuste como una nueva auditoría física de toda la app.

| Función | Escenario | Esperado | Observado | Evidencia | Estado |
| --- | --- | --- | --- | --- | --- |
| Calendario/leyenda | Parcial en claro/oscuro, 8 acentos, 2 tamaños, 4 niveles y 2 motores | Fondo exacto, fecha negra, borde fijo y cuadrados | 256 casos correctos; los otros estados conservan su estilo | `screen-proof.json`, `palette-proof.json` | Aprobado, navegador/emulación |
| Reportes | Cortos, Full, año, años completos y combinados; usuario nuevo, límite de seguimiento, pausa y futuro | Colores/leyenda coherentes, fechas locales, cuadrados sin recorte | 30 archivos generados y 6 descargados por UI abiertos; 100 páginas PDF renderizadas | `reports-proof.json`, `report-ui-proof.json`, `file-review-proof.json` | Aprobado |
| Métricas | Fixtures a tres horas locales contra fuente exacta 74 | Misma salida y entrada intacta | 144 Streak, 72 calendarios y 18 estadísticas idénticos | `metrics-proof.json` | Aprobado |
| Fin de rutina | Trabajo completo con calentamiento pendiente | Finalización normal y una sola fila guardada | Sin falso aviso; calentamiento conserva `done:false` | `WorkoutSummaryStreak.finish.test.jsx`, `Workout.test.jsx`, `finish-warmup-ui-proof.json` | Aprobado |
| Confirmación y guardado | Trabajo pendiente; cancelar, confirmar, repetir activación y recargar | Mantener confirmación, datos y duración; evitar duplicados | Dos finales normales, dos cancelaciones/confirmaciones con trabajo incompleto y dos con solo calentamiento marcado: filas/origen y 59000 ms conservados; un historial tras confirmar | `built-acceptance/finish-warmup-ui-proof.json` | Aprobado |
| Rutinas diarias | 0/2, 1/2, 2/2, extra, manual incompleta, unilateral, activa/cancelada, identidad y legado | Conservar contrato de actividad y emparejamiento por ID | Once escenarios reproducidos; nombres ambiguos no completan otra rutina | `partial-logic-repro.json`, `baseline74-routine-ui-observations.json`, `baseline74-store-guard-observations.json` | Reglas existentes comprobadas |
| Build exacto | Pantalla, preview y descarga de PDF/PNG/combinado | Mismo color y contenido | Diez archivos reales abiertos y ocho páginas Poppler; negro verificado dentro de celdas Parcial | `built-acceptance/{proof,file-review-proof}.json` | Aprobado |
| Actualización/offline | 74→75, normal/pausado × Edge/WebKit, cierre completo y reapertura | Backup y datos intactos, caché verificable, sin finalizar sesión | Cuatro perfiles conservan checksum/IDB/caché; pausa 9:00, una serie hecha y otra pendiente, sin historial añadido | `exact-pwa-acceptance.json` | Aprobado, origen local |
| Exportación offline | Full, varios años y PNG semanal | Archivos válidos y paleta correcta offline | 16 archivos abiertos: 52 páginas PDF y cuatro PNG; 6304 muestras, 102 de Parcial con negro | `pwa-exact339d543-file-review/proof.json` | Aprobado |
| Descarga/actualizador público | APK GitHub/Pages y versión 74/75 | Misma firma y fuente; ofrecer solo versión nueva | APKs idénticos, 75/111/339d543; 74 recibe oferta y 75 no | `public-artifacts-verified.json`, `updater-verified.json` | Aprobado |
| Paquete PWA público | Actualizar y reabrir offline; normal/pausado en dos motores | Preservar datos, backup y sesión; exportables iguales | Cuatro perfiles aprobados; 16 archivos con 52 imágenes PDF y cuatro PNG idénticos al build; ocho páginas públicas renderizadas | `public-pwa-acceptance.json`, `pwa-public339d543-file-review/proof.json` | Aprobado, shell público servido localmente |

La incidencia inicial de WebKit al reabrir una confirmación tras Cancel queda conservada: el harness esperaba que desapareciera el título antes de que terminara la navegación del modal. Esperando el cierre del estado de historial y la retirada de `inert`, los seis flujos del build pasaron. Se registra como explicación actual de secuenciación del test; no se presenta como un defecto adicional de producción demostrado. Se conservaron los datos y no hubo errores JavaScript.

Las rutas de evidencia de las tablas corresponden a `.tools/colors75/`, excepto los tests, que están bajo `frontend/src/`. Las muestras españolas están en `output/pdf/*1.15.75*` y no contienen datos personales.

## CI exacto anterior al tag

| Puerta | Resultado y artefacto |
| --- | --- |
| [Tests 39327290399](https://github.com/Truesilverking/TGym/actions/runs/39327290399) | Aprobado: 2098 frontend, 16 API, 37 MCP y 6 catálogo; locales/fatiga/carga Node |
| [PWA 39327293381](https://github.com/Truesilverking/TGym/actions/runs/39327293381) | Aprobado; artefacto 12222293443, CRC, fuente y caché correctos |
| [Android 39327296724](https://github.com/Truesilverking/TGym/actions/runs/39327296724) | Build/lint y 11/0/0 en emulador; artefacto 12222856845 |
| [Candidato 39327299498](https://github.com/Truesilverking/TGym/actions/runs/39327299498) | Aprobado; artefacto 12222214605 inspeccionado antes del tag |

El PWA local aceptado reproduce las tres variables públicas explícitas de `release.yml` (distribución PWA, propietario y repositorio). `pages.yml` valida sin esas variables: 31/50 assets son byte por byte iguales; el index solo cambia esos valores públicos de entorno y 18 chunks cambian sus referencias derivadas. Los 50 assets normalizan exactamente. Las cinco diferencias estáticas de HTML/CRLF/worker están documentadas y el digest de caché CI coincide con la plantilla del commit exacto. No se afirma igualdad binaria entre esas variantes. La paridad pública de producción se comprueba después de publicar.

El candidato conserva `app.framegym.mobile`, min SDK 23, target/compile SDK 35 y no es depurable. CRC, checksums, firma APK/JAR del AAB y continuidad oficial aprobados. Certificado SHA-256: `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`. Los 61 recursos web coinciden entre APK y AAB.

| Candidato | SHA-256 |
| --- | --- |
| APK | `9a23467529de79236e8d43d4a2cb32fa3c6209b3849dbaf3171514be96189c66` |
| AAB | `2bfe2fd1b1d4d70e11a62dca6c5c897609e5082be6151a9d279823baf40c990a` |

## Verificación pública

| Artefacto | Bytes | SHA-256 |
| --- | --- | --- |
| APK GitHub y Pages, idénticos | 9031428 | `d38ea4e8f728fe53dccef1777196d3faec7f103a014e03debc35199f5afce4d9` |
| AAB | 8080164 | `2bfe2fd1b1d4d70e11a62dca6c5c897609e5082be6151a9d279823baf40c990a` |

CRC, checksums, firma oficial, identidad, SDK y metadata 75/111/339d543 verificados de nuevo sobre los archivos descargados. El AAB es byte por byte idéntico al candidato. El APK público y candidato conservan las 1116 entradas idénticas en contenido y metadata: la diferencia de SHA se limita al bloque de firma. Los 61 recursos web son iguales entre los paquetes y respecto al candidato.

El manifiesto público y `build.json` identifican 75/111/339d543. Los dos actualizadores ofrecen 75 desde 74 y no repiten la oferta desde 75. Los 57 recursos del shell público coinciden con la plantilla del commit exacto y el digest del worker `tgym-app-1.15.75-339d543766c1c534e59000d18937fc83c394ac5b-34e85f53bc74`.

Los **50 assets compilados públicos son byte por byte idénticos al PWA local de producción** aceptado, con las tres variables públicas esperadas. Se distinguen de la variante CI anterior: seis diferencias estáticas públicas/locales —CRLF/LF, línea vacía HTML, formato JSON de `build.json` con metadata igual y digest derivado del worker— están explicadas. No se afirma igualdad binaria de todo el shell.

La política del tag remoto anotado habilitó el mecanismo de aviso existente. FCM aceptó `tgym_updates` y `tgym_updates_v2` a las **17:36:57 y 17:36:58 de Santo Domingo**, sin reintentos ni reenvíos. Es aceptación del servicio; no demuestra recepción, toque o instalación en un teléfono.

La URL pública se abrió con perfiles nuevos de Edge y WebKit: versión/commit/worker correctos, Parcial cian con fecha negra en celda y leyenda, otros estados y marcador conservados, sin categoría visible de Sin seguimiento. Diez descargas reales —cuatro PNG y seis PDF, incluidos combinados— se abrieron y ocho páginas se renderizaron con Poppler. Se verificó el negro dentro de las celdas cian y se revisaron los renders; sin deformaciones observadas ni errores JavaScript, preview/descarga iguales y datos sintéticos comprobados intactos. Los cuatro PNG públicos son byte por byte idénticos a los del build exacto aceptado.

La actualización con el shell público verificado se probó servido localmente en otros cuatro perfiles: normal/pausado × Edge/WebKit. Check/Update 74→75, backup previo con checksum, espejo IDB, caché SHA-256 y reapertura completa offline/origen detenido aprobados. Los datos normales conservan sus campos completos; los pausados mantienen 9:00, una serie hecha y otra pendiente, sin nuevo historial. Las marcas de interacción pueden avanzar legítimamente; no se consideran pérdida de datos. Edge usa `navigator.onLine=false`; WebKit reinicia el proceso con el origen detenido, aunque su emulación mantiene `navigator.onLine=true`.

Se abrieron las 16 descargas offline públicas: 52 imágenes PDF y cuatro PNG son píxel por píxel idénticos a los archivos del build exacto ya revisados. Se renderizaron ocho páginas públicas representativas con Poppler y se abrieron el contacto, dos meses ampliados y los cuatro PNG reales. Sin recortes, deformaciones o inconsistencias de color, fecha, leyenda o indicador observadas.

Evidencia: `.tools/colors75/{public-artifacts-verified,public-production-pwa-comparison,updater-verified,notification-verified,candidate-public-comparison,candidate-public-apk-entries,public-pwa-acceptance}.json`, `.tools/colors75/published-acceptance/{proof,file-review-proof,exact-built-png-match}.json` y `.tools/colors75/pwa-public339d543-file-review/proof.json`.

Resumen estructurado: [AUDIT-EVIDENCE-1.15.75.json](AUDIT-EVIDENCE-1.15.75.json). Tag remoto anotado: `02202018483e1c485d7e2e8707e594da8f4f8324`, apuntando al runtime 339d543; publicación y avisos ejecutados una sola vez.

## Pendientes de dispositivo

No hay dispositivo ADB conectado. Recepción/toque/instalación Android física, Safari/PWA instalada en iPhone, compilación Xcode y compartir nativo con receptores reales continúan pendientes. WebKit es emulación móvil y los 11 tests Android son de emulador. Los otros límites de la auditoría integral —lector de pantalla físico, presión real de almacenamiento, Drive/otro equipo y Health Connect con proveedor— no se declaran resueltos por esta versión.
