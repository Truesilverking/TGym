# TGym 1.15.73 / Android 109

Candidato en `fix/calendar-tracking-marker-1.15.73` para aplicar Pendiente `#696969` y sustituir la categoría «Not Tracking Yet» por el indicador externo de inicio del registro confirmado por el propietario. Diseño y flujo de datos: [CALENDAR-TRACKING-AUDIT-1.15.73.md](CALENDAR-TRACKING-AUDIT-1.15.73.md).

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

La evidencia de archivos reales, CI del commit exacto, candidato firmado y publicación se añade al completar los controles. Todos los perfiles de prueba son sintéticos y aislados; no se transmiten reportes a terceros. Las comprobaciones de navegador/emulador se distinguen de recepción/instalación en Android físico y Safari/PWA de iPhone real.
