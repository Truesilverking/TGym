# TGym 1.15.74 / Android 110

Candidato en `fix/not-trained-red-1.15.74` para el último ajuste de color solicitado por el propietario: **Not Trained / No entrenado `#ED1C24`**, en calendario, leyendas y todos los PDF/PNG/combinados de Streak y Consistency.

Solo cambia el triple compartido `missed` en `calendar-visual.js`: fondo `#ed1c24`, texto `#000000` y borde `#8f1015`. El texto negro conserva contraste 4,79:1; el blanco daría 4,38:1. La pausa sigue en rojo oscuro `#791f34`, Pendiente en `#696969`, Descanso en blanco y se mantienen el indicador externo de fecha y la eliminación de la categoría visible de Sin seguimiento de 73. No se modifican datos, reglas, cálculos, formatos ni geometría.

La regresión comprueba el triple exacto por igual en pantalla/reportes y exige separación perceptual entre todas las categorías, además de texto legible. Resultados de tests, archivos reales, CI, publicación y límites de dispositivo se añaden al terminar la verificación. La auditoría y las decisiones previas permanecen en [RELEASE-AUDIT-1.15.73.md](RELEASE-AUDIT-1.15.73.md) y [APP-AUDIT-2026-10-19.md](APP-AUDIT-2026-10-19.md).

## Verificación local

- Frontend: 191 archivos, 2093 pruebas aprobadas. Pruebas focalizadas de estado/calendario: 28/28.
- Builds web, PWA y mobile assets/Capacitor sync aprobados. Versión 1.15.74/code 110 coherente.
- Comparación con el tag exacto 1.15.73: 144 resultados Streak, 72 calendarios y 18 estadísticas idénticos, incluidos los datos de entrada.
- No hay scripts frontend de lint/typecheck. iOS native requiere macOS/Xcode; no se afirma compilación nativa iOS desde Windows.
