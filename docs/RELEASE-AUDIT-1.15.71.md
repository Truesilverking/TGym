# TGym 1.15.71 / Android 107

Publicado el 19 de octubre de 2026 desde `946aba662e713c5bd0ef06a85401685e9210b6dc`, en `feature/report-redesign-app-audit`. El tag anotado `v1.15.71` apunta exactamente a ese commit. La documentación posterior de evidencia se guarda en otro commit y no cambia el runtime publicado.

## Resultado local previo a publicación

- Frontend: **191 archivos, 2085 pruebas aprobadas**, con cuatro workers.
- API: **16/16**, incluidos cinco escenarios HTTP con servidor y disco temporales. MCP: **37/37** y carga del grafo bajo Node aprobada. Editor local de catálogo: **6/6**.
- Locales: doce packs, 1919 claves sincronizadas; 1215 cadenas de fuente presentes. Probe de fatiga: 108000 comparaciones y 14076 eliminaciones aleatorias aprobadas. Versión 1.15.71 / code 107 coherente.
- Builds web, PWA y mobile assets/Capacitor sync aprobados. Android `assembleDebug :app:lintDebug`: BUILD SUCCESSFUL, 386 tareas, cero errores y veinte advertencias de lint. Windows no ejecuta Xcode/CocoaPods: no se afirma compilación iOS.
- Generación real en Edge y WebKit: **52 archivos**; se abrieron **102 páginas PDF**, con escala uniforme, imagen dentro de A4 y **8624 muestras de relleno** tomadas del JPEG final. PNG anuales dentro del límite de 12 MP. Contactos y páginas representativas revisados visualmente; muestras adicionales abiertas/renderizadas con Poppler.
- Comparación independiente contra snapshot inicial 1.15.70: 144 resultados de racha, 72 calendarios y 18 estadísticas exactamente iguales, incluidos estados y datos de entrada.
- Navegación: seis vistas × tres tamaños × dos motores; filtros y registros preservados tras reload. Rutinas/sesiones: recorridos de teclado, finalización/Continue, pausas, inactividad y reapertura en ambos motores.
- UI de reportes: seis PDFs descargados, 24 páginas abiertas; preview y descarga byte por byte iguales, cancelación Web Share local y combinado en ambos motores. PWA exacta: transición 70→71, respaldo previo idéntico, caché SHA-256 y reapertura offline/origen detenido; ocho PDFs adicionales (48 páginas) y cuatro PNG generados offline y revisados.

La auditoría y su matriz completa están en [APP-AUDIT-2026-10-19.md](APP-AUDIT-2026-10-19.md). Diseño/paleta y la decisión de conservar Parcial: [REPORT-DESIGN-AUDIT-1.15.71.md](REPORT-DESIGN-AUDIT-1.15.71.md). Los scripts de frontend no incluyen lint ni typecheck; no se inventan esos resultados.

## CI exacto, publicación e integridad

| Comprobación | Ejecución / resultado |
| --- | --- |
| Tests | [39307887961](https://github.com/Truesilverking/TGym/actions/runs/39307887961), aprobado; 2085 frontend, 16 API, 37 MCP, 6 catálogo y comprobaciones descritas arriba |
| PWA | [39307890852](https://github.com/Truesilverking/TGym/actions/runs/39307890852), aprobado; ZIP con CRC válido y metadata 71/946aba6; todo el JS/CSS/imagen coincide con el build local, diferencias estáticas de saltos de línea/digest derivado registradas |
| Android | [39307893929](https://github.com/Truesilverking/TGym/actions/runs/39307893929), compilación/lint y **11 tests de emulador** aprobados, cero fallos/omitidos: Health 2, safe areas 2, sonido 5, notificación de entrenamiento 1 e instrumentación base 1 |
| Candidato firmado | [39307896562](https://github.com/Truesilverking/TGym/actions/runs/39307896562), aprobado y APK/AAB inspeccionados antes del tag |
| Release | [39308962605](https://github.com/Truesilverking/TGym/actions/runs/39308962605), aprobado; [v1.15.71](https://github.com/Truesilverking/TGym/releases/tag/v1.15.71) |

Paquete público `app.framegym.mobile`, versión 1.15.71/code 107, min SDK 23, target/compile SDK 35; APK no depurable. Firma APK y firma JAR de AAB válidas y certificado idéntico al de 1.15.70. Certificado SHA-256: `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`.

| Artefacto público | Bytes | SHA-256 |
| --- | --- | --- |
| APK GitHub y Pages, idénticos | 9031069 | `f96de77fc9d7daa6eea03218f910a2c1b7cf7ff7be8bb2508d3a2ee812f0910b` |
| AAB | 8079837 | `de3e67f40fd1d219e63887ad589ba6fef4e35148a2ef182ae8200345032528a1` |

El APK candidato tiene otro hash por el bloque de firma; las 1116 entradas del archivo y los recursos de runtime son idénticos al público. El AAB completo es byte por byte idéntico al candidato. Se validaron CRC, checksums, identidad, SDKs, firmas y metadata interna de ambos paquetes; los 61 recursos web incluidos coinciden entre APK y AAB.

`updates/latest.json` público contiene versión 71/code 107 y el mismo commit. PWA pública: build 71/946aba6, caché `tgym-app-1.15.71-946aba662e713c5bd0ef06a85401685e9210b6dc-ee2d345426bc`; los **57 recursos de shell** descargados corresponden al digest del worker y su plantilla en el commit exacto. Los actualizadores GitHub y PWA ofrecen 71 desde 70 y no ofrecen otra actualización estando en 71.

El workflow aceptó el aviso FCM para los topics existentes `tgym_updates` y `tgym_updates_v2` a las 15:16:42 de Santo Domingo. No se reenvió ni reintentó la notificación. Esto demuestra aceptación por el servicio, no recepción/toque/instalación en un teléfono.

La conservación del perfil, sesión pausada de nueve minutos, respaldo previo, caché y reapertura offline se documenta en [la aceptación PWA](audit-2026-10-19-pwa-update.md). Se repitieron los cuatro casos con los bytes públicos congelados: normal/pausado × Edge/WebKit. Sus 12 PDF y 4 PNG se abrieron; 52 páginas PDF se renderizaron y revisaron. Las imágenes de las 48 páginas comparables de Full/años son píxel por píxel iguales a la fuente exacta y los 4 PNG semanales son byte por byte iguales. Las muestras mensuales públicas adicionales son de un perfil sintético en inglés; las muestras entregadas en español se generaron desde el mismo código exacto. Evidencia estructurada: [AUDIT-EVIDENCE-1.15.71.json](AUDIT-EVIDENCE-1.15.71.json).

## Pendientes de dispositivo e integraciones

No hay dispositivo conectado por ADB. La recepción/instalación Android real, Safari/PWA de iPhone físico y compilación Xcode, compartir hacia receptores reales, OAuth de Drive/segundo equipo, Health Connect con proveedor, presión real de almacenamiento y lector de pantalla permanecen pendientes. Las pruebas de permisos/rechazos y almacenamiento simulado no se presentan como aceptación física. Vite avisa sobre chunks mayores de 1500 kB; no se observó un bloqueo en los flujos revisados y queda pendiente un benchmark de móvil físico.
