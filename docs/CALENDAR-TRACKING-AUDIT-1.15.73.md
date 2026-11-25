# Gris e inicio del registro — 1.15.73

El propietario pidió `#696969` para Pendiente y quitar «Not Tracking Yet». Confirmó sustituir esa categoría por un punto de color junto a «Registrando desde [fecha]», fuera de la cuadrícula, conservando visibles las fechas anteriores con el estilo de Descanso.

## Presentación

| Elemento | Fondo | Texto | Borde |
| --- | --- | --- | --- |
| Pendiente, pantalla y exportables | `#696969` | `#ffffff` | `#424242` |
| Indicador externo de inicio | `#0f766e` | Etiqueta legible fuera de la cuadrícula | `#064e3b` |
| Fechas anteriores al registro | `#ffffff` | `#263345` | `#7b8796` |

Pendiente mantiene un contraste de texto de 5,49:1. El punto verde azulado es una anotación de fecha y no crea un estado de calendario ni modifica el color de una celda.

`calendar-visual.js` aplica el gris por la definición compartida y agrupa visualmente `untracked` con Descanso tanto en pantalla como en exportaciones. La leyenda omite la categoría, y las vistas de meses/años y la selección anterior al inicio ya no muestran «Not Tracking Yet». Los cuadrados y números de esas fechas siguen presentes. Se conservan las claves de traducción antiguas por compatibilidad.

`ZoomCalendar` muestra el indicador antes de la cuadrícula. `calendar-report-layout.js` lo coloca en el pie de página de los PDF/PNG de Streak y Consistency, incluidos Full, años completos e inclusión en PDF combinado; sustituye la palabra TGym redundante del pie y conserva TGym en el encabezado. No se cambia la geometría ni la paginación. La nueva etiqueta está traducida en los doce paquetes de idioma.

## Datos y regresión

El indicador usa `trackingStart`, la frontera efectiva existente, que puede diferir de `trainingStartDate` y del valor crudo `trainingHistory.trackedFrom` por el historial registrado. Solo se consume ese cálculo: no se edita ninguna fecha de inicio ni se añade un estado persistido. El `status: 'untracked'`, sus conteos, los denominadores y el tratamiento de actividad/Parcial se conservan.

Las regresiones de `calendar-visual.test.js` y `ZoomCalendar.test.jsx` cubren los cuatro niveles de zoom, eliminación de etiquetas/leyenda, selección previa con fecha visible, frontera efectiva distinta del inicio histórico, indicador fuera de celdas/leyendas y conservación de datos/estadísticas. Verifican el gris exacto, texto blanco, bordes y el indicador en ambos reportes PDF/PNG y todas sus páginas.

Resultados de archivos, builds, CI, paquetes públicos, actualización y límites de dispositivo: [RELEASE-AUDIT-1.15.73.md](RELEASE-AUDIT-1.15.73.md). La [auditoría integral anterior](APP-AUDIT-2026-10-19.md) mantiene su alcance y pendientes.
