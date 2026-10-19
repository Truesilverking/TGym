# TGym 1.15.72 / Android 108

Candidato solicitado el 19 de octubre de 2026 para unificar los cuatro colores de calendario/exportables y hacer blanco Descanso. La presentación reutiliza una definición compartida; no cambia cálculos ni datos. Diseño y alcance: [CALENDAR-COLORS-AUDIT-1.15.72.md](CALENDAR-COLORS-AUDIT-1.15.72.md).

Los resultados de tests/builds, navegador/archivos y publicación se incorporan al completar la verificación. Fuente en `fix/calendar-color-parity-1.15.72`; el tag se crea después de comprobar CI y el candidato firmado. La instalación/recepción en teléfono e iPhone físico requieren evidencia de dispositivo y permanecen separadas de la emulación.

## Verificación local antes de publicación

- Frontend: 191 archivos, **2086 pruebas aprobadas**; API 16/16; MCP 37/37 y carga Node del grafo completa.
- Doce locales con 1919 claves sincronizadas y 1215 cadenas presentes en fuente. Probe de fatiga: 108000 comparaciones y 14076 eliminaciones aleatorias aprobadas. Versión 1.15.72/code 108 coherente.
- Builds web/PWA/mobile assets y Capacitor sync aprobados. Android `assembleDebug :app:lintDebug`: BUILD SUCCESSFUL, 386 tareas. Xcode/CocoaPods no se ejecutaron en Windows; no se afirma compilación iOS.
- **192 escenarios de pantalla** en Edge/WebKit: semana/mes y mini meses del componente existente, 320/390 px, claro/oscuro y ocho acentos. Fondo/texto/borde/leyenda exactos; blancos delimitados, cuadrados, sin desbordamiento y datos sintéticos conservados.
- **36 archivos guardados** abiertos, incluidos seis descargados desde la interfaz: generación de ambos reportes, PNG/PDF, Full, año, años completos y PDF combinado. Poppler renderizó **100 páginas PDF**; 9036 muestras de relleno de fechas coincidieron con sus colores esperados. Las páginas/hojas de contacto y los PNG fueron revisados visualmente, sin recortes ni solapes observados.
- Vista previa y descarga coinciden byte por byte; cancelación Web Share local sin error/receptor/transmisión. La interfaz nueva y los archivos usan blanco/rojo oscuro/rojo claro/gris claro como se solicitó.
- Comparación independiente con el código exacto de 1.15.71: **144 resultados Streak, 72 calendarios y 18 estadísticas idénticos**, con los datos de entrada intactos.

Evidencia local en `.tools/colors72/{screen-proof,reports-proof,report-ui-proof,metrics-proof,file-review-proof}.json` y logs de tests/builds de la misma carpeta. Se entrega un resumen estructurado al cierre. No existen scripts de lint/typecheck de frontend; se informa Android lint y las comprobaciones disponibles.
