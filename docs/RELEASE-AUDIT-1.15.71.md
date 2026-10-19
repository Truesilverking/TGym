# TGym 1.15.71 / Android 107

Candidato solicitado el 19 de octubre de 2026. El código está en `feature/report-redesign-app-audit`; la publicación requiere verificar sus Actions y artefactos firmados antes del tag. Esta nota se actualizará con commit, workflows, hashes y estado público.

## Resultado local previo a publicación

- Frontend: **191 archivos, 2085 pruebas aprobadas**, con cuatro workers.
- API: **16/16**, incluidos cinco escenarios HTTP con servidor y disco temporales. MCP: **37/37** y carga del grafo bajo Node aprobada. Editor local de catálogo: **6/6**.
- Locales: doce packs, 1919 claves sincronizadas; 1215 cadenas de fuente presentes. Probe de fatiga: 108000 comparaciones y 14076 eliminaciones aleatorias aprobadas. Versión 1.15.71 / code 107 coherente.
- Builds web, PWA y mobile assets/Capacitor sync aprobados. Windows no ejecuta Xcode/CocoaPods: no se afirma compilación iOS.
- Generación real en Edge y WebKit: **52 archivos**; se abrieron **102 páginas PDF**, con escala uniforme, imagen dentro de A4 y **8624 muestras de relleno** tomadas del JPEG final. PNG anuales dentro del límite de 12 MP. Contactos y páginas representativas revisados visualmente; muestras adicionales abiertas/renderizadas con Poppler.
- Comparación independiente contra snapshot inicial 1.15.70: 144 resultados de racha, 72 calendarios y 18 estadísticas exactamente iguales, incluidos estados y datos de entrada.
- Navegación: seis vistas × tres tamaños × dos motores; filtros y registros preservados tras reload. Rutinas/sesiones: recorridos de teclado, finalización/Continue, pausas, inactividad y reapertura en ambos motores.

La auditoría y su matriz completa están en [APP-AUDIT-2026-10-19.md](APP-AUDIT-2026-10-19.md). Diseño/paleta y la decisión de conservar Parcial: [REPORT-DESIGN-AUDIT-1.15.71.md](REPORT-DESIGN-AUDIT-1.15.71.md). Los scripts de frontend no incluyen lint ni typecheck; no se inventan esos resultados.

## Verificación pendiente del candidato publicado

Registrar aquí el SHA de fuente, CI exacto, candidato APK/AAB firmado, Android lint/emulador, transición PWA 70→71/offline, tag, Release/Pages y notificación aceptada por el servicio. La recepción/instalación en un teléfono y la aceptación en un iPhone físico permanecen pendientes porque no hay hardware conectado.
