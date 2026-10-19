# Rediseño de Streak y Consistency — candidato 1.15.71

Esta nota describe el candidato local; la publicación y la validación integral se documentan por separado. Las muestras se generan con perfiles sintéticos aislados.

## Diseño y paleta

Los dos reportes comparten un encabezado compacto con TGym, título, intervalo y fecha de evaluación. Streak destaca la racha actual y la mejor, con la misma silueta de llama de la aplicación, rellena por completo al existir una racha activa. El texto aclara que el contador suma fechas de entrenamiento, no días naturales. Consistency conserva sus tres métricas: completados, no completados y cumplimiento.

Cada fecha conserva un cuadrado de proporción 1:1, separación uniforme y número centrado; mes, año y días de la semana aparecen fuera de las celdas. La paleta del exportable es fija e independiente del tema/acento. Celdas y leyendas usan el mismo resolvedor y borde explícito; el contraste entre número y fondo supera 4,5:1.

| Estado visual | Fondo | Texto | Borde |
| --- | --- | --- | --- |
| Completada (Consistency) / Actividad registrada (Streak) | `#115bb2` | `#ffffff` | `#073977` |
| Parcial, solo Consistency | `#f4cc83` | `#533600` | `#9c6b14` |
| No entrenado | `#f8d4d7` | `#78222d` | `#b56b73` |
| Pendiente | `#edf0f4` | `#39465a` | `#a8b2c0` |
| Descanso | `#deebcd` | `#354b28` | `#8fa374` |
| Entrenamiento en pausa | `#791f34` | `#ffffff` | `#4b1020` |

El azul representa una categoría en cada reporte; las reglas de actividad de Streak y las de calendario de Consistency siguen siendo independientes. Los demás estados tienen fondos diferentes dentro de cada leyenda. La pausa usa rojo oscuro y No entrenado, rojo claro.

## Decisión explícita sobre Parcial

La revisión encontró que `calendarDay` emite `partial` cuando se han completado algunas, pero no todas las rutinas programadas. No existe una equivalencia inequívoca con completado ni con no entrenado. Se consultó al propietario y su última instrucción fue **conservar «Parcial» hasta decidir otra regla**. Por eso el candidato conserva esta categoría y su leyenda en Consistency, con etiqueta concisa y toda la actividad intacta. Streak sigue usando sus propias reglas de actividad y no añade una categoría parcial.

## Flujo de datos y compatibilidad

`calendarPeriod`/`calendarDay` y `buildStreakReport` siguen produciendo los mismos estados, métricas y fechas locales. `calendarReportState` agrupa únicamente la presentación de `untracked` con Descanso: mantiene `data-status="untracked"`, devuelve semántica visual `rest` y no crea una entrada de leyenda adicional. Los cuadrados anteriores al inicio del seguimiento siguen visibles.

No se modifican la fecha de inicio, los datos persistidos, los IDs de estado, las rutinas, los históricos, los denominadores, los porcentajes ni los algoritmos de racha. Las fechas sin seguimiento no se convierten en descansos reales ni en entrenamientos. El calendario interactivo conserva su resolvedor anterior, con la diferencia entre descanso y sin seguimiento. El cambio de etiqueta a No entrenado solo afecta a la representación de exportación.

`calendar-report-layout.js` dibuja todos los exportables de ambos reportes. `calendar-grid.js` usa el mismo resolvedor para celdas y leyendas. Los adaptadores existentes de archivo, descarga, vista previa, compartir e inclusión en el PDF combinado siguen consumiendo esas páginas; no se añaden formatos ni mecanismos sociales. La silueta de la llama se comparte con `StreakFlame` mediante `streak-flame-path.js`.

## Variantes y paginación

| Variante existente | Presentación final |
| --- | --- |
| Semana, PDF/PNG | Una página/imagen; siete fechas, incluso al cruzar mes o año. |
| Mes, PDF/PNG | Una página/imagen con calendario completo. |
| Año, PDF | Tres páginas verticales, cuatro meses completos por página. |
| Full report, PDF | Tres páginas verticales con todas las fechas del año anclado. |
| Complete years, PDF | Tres páginas por año seleccionado; se conserva el máximo de 25 años. |
| Año y variantes PNG existentes de Streak | Una imagen vertical larga, un mes por fila, sin reducir los cuadrados para encajar doce meses en una hoja. |
| Intervalo personalizado de Streak | PDF con hasta cuatro grupos mensuales por página; PNG vertical hasta el límite existente de 366 fechas. |
| PDF combinado de Stats | Reutiliza exactamente las mismas páginas y filtros de cada reporte seleccionado. |

Los PDFs de varios meses usan cuadrados de 48 unidades y números de 30; las páginas de un mes y los PNG largos, cuadrados de 92 y números de 34. El año bisiesto conserva 366 fechas, sin repeticiones entre páginas. La opción Complete years ahora explica «Cuatro meses por página PDF»; ya no promete una página por año.

El rasterizador compartido limita cada imagen a 12 millones de píxeles y 16.384 unidades por lado; conserva 2× en las páginas normales y reduce uniformemente la escala de imágenes largas. Esto evita asignar un lienzo anual de aproximadamente 36 millones de píxeles/18.000 de alto al duplicar siempre la resolución. Si el navegador devuelve el fallo silencioso `data:,`, la generación produce un error recuperable y libera el lienzo/URL, en lugar de entregar un archivo vacío. La geometría del SVG y sus métricas permanecen intactas. Las notas y etiquetas largas reservan espacio según sus líneas antes de dibujar valores y meses, con regresión para los doce idiomas.

## Evidencia de regresión del diseño

Las pruebas de `calendar-visual`, `calendar-report`, `calendar-full-report`, `calendar-year-report`, `streak-report`, `report-exports`, `ReportsExport` y `StreakFlame` cubren paleta fija, contraste de texto, correspondencia celda/leyenda, conservación de estados internos y métricas, años bisiestos y límites 1000/9999, geometría cuadrada, límites de página, archivos combinados, etiquetas y llama completamente rellena. Los doce idiomas mantienen sus claves sincronizadas.

La generación y revisión de PNG/PDF reales, la comparación anterior/posterior de métricas y las limitaciones de dispositivo se registran en la auditoría integral. Las pruebas de componentes no equivalen a aceptación en un iPhone físico ni a un envío real de archivos a terceros.
