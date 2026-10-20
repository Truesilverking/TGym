# Calendario de Streak: semana, mes y año

La tarjeta anual usa enero–diciembre del año elegido, con un cuadrado por fecha real, lunes–domingo y espacios iniciales invisibles. La referencia visual se adapta a TGym conservando la paleta confirmada: actividad azul, Parcial `#0087C2`, No entrenado `#ED1C24`, Pendiente `#696969`, Descanso blanco y pausa roja oscura. Las fechas anteriores al seguimiento mantienen su estado interno y apariencia de Descanso; el marcador de inicio sigue fuera de la cuadrícula.

## Diseño e interacciones

Streak abre ahora el año completo. El selector Semana/Mes/Año permite pasar directamente entre escalas; las flechas cambian el período elegido y los controles de zoom conservan el selector previo de doce años. Pulsar un mes abre su vista mensual; los días con historial mantienen su acceso al detalle. Home conserva su selector semanal/mensual, y el resto de consumidores reutiliza el mismo calendario.

La rejilla anual tiene tres columnas y cuatro filas cuando el ancho lo permite. Las consultas sobre el contenedor reducen a dos columnas con 300 px de contenido o menos y a una con 210 px o menos. En los mini calendarios de hasta 430 px de contenido se ocultan únicamente los números visuales, como en la referencia: todos los cuadrados reales permanecen, con fecha/estado completos en su descripción accesible y título. Abrir el mes muestra los números a tamaño mayor. En pantalla amplia también se ven los números anuales.

`dateCell` y `CalendarVisual.css` definen el mismo cuadrado, paleta, borde, foco y tipografía para las tres escalas, ajustando su densidad. Hoy usa contorno interior, la selección un punto discreto y las fechas futuras borde discontinuo; las claves temporales están separadas de los estados. Los botones de navegación/zoom tienen 44×44 px. Se conservan los indicadores de descarga, mediciones, planificación y exportación existentes.

## Contadores y conservación de datos

`calendar-view.js` deriva las fechas activas de `trainingStreak(state, now).rows` y cuenta cada fecha `completed` una vez. Por tanto, varias sesiones o rutinas en un día no inflan el total; Parcial con actividad válida cuenta como una fecha activa. Sesiones activas, canceladas, sin resultado positivo, solo calentamientos, duplicadas y futuras siguen las exclusiones de la autoridad existente.

Los contadores de mes y período son **días activos**, no sesiones realizadas/planificadas ni longitud de racha. Los doce totales mensuales suman el anual. La racha actual y la mejor racha conservan sus cifras y etiquetas independientes en el encabezado existente. El texto localizado aclara la diferencia.

No cambia `trainingStreak`, `dailyPlan`, `calendarDay`, `consistencyStats`, el historial ni el esquema de almacenamiento. Los estados originales de las celdas siguen procediendo de `calendarDay`; incluso un registro importado futuro mantiene su estado fuente y recibe la marca temporal, pero no incrementa el contador de actividad antes de su fecha. No se reclasifican registros ni se borran filas.

`useLocalNow` y `localTZ` mantienen el calendario al volver al primer plano, al cambiar el día local o la zona horaria. Un único snapshot de actividad y una caché de estados de fecha por estado/día/zona evitan repetir todos los cálculos por cada mes. Las fechas y los desplazamientos se construyen a mediodía local.

## Comprobaciones

| Función | Escenario | Esperado | Observado | Evidencia | Estado |
| --- | --- | --- | --- | --- | --- |
| Año real | 2024/2026, febrero y meses de 28–31 días; centenarios 2000/2100 | 365/366 fechas únicas, orden enero–diciembre, lunes primero | 29 de febrero solo cuando corresponde; offsets correctos | `calendar-view.test.js`, `ZoomCalendar.test.jsx` | Aprobado |
| Actividad | Varias rutinas/sesiones, Parcial, extra, duplicados, inválidos y futuro | Una fecha activa válida como máximo por día | Totales coherentes entre tres vistas y meses/año, sin contar futuro | Tests anteriores y `fixture-ui-proof.json` | Aprobado |
| Fecha local | Medianoche, UTC−/UTC+, DST Nueva York y `pageshow` | Mismas fechas locales y refresco sin escribir historial | Se conserva el rango y al llegar la fecha aumenta el contador válido | `calendar-view.test.js`, `ZoomCalendar.test.jsx` | Aprobado |
| Navegación | 2024–2027, mes↔año, selector y zoom de doce años | Ancla consistente y detalle disponible | Navegación, drill-in y recarga conservan datos y selección | `source-acceptance/proof.json` | Aprobado |
| Visual compartido | Dos motores, tres escalas, cuatro anchos, dos temas y tres acentos | Celdas cuadradas, paleta fija y marcas temporales coherentes | 144 combinaciones, cero errores JS/desbordamientos observados | `source-acceptance/proof.json` | Aprobado, navegador/emulación |
| Contenedores | 200/290/360/670 px de contenido | Una/dos/tres columnas según espacio | Ocho casos Edge/WebKit aprobados | `responsive-ui-proof.json` | Aprobado |
| Datos/reglas | Ocho fixtures a tres horas contra tag exacto 75 | Misma salida de cálculos y entrada intacta | 192 Streak, 96 calendarios, 24 Consistency y 24 rachas exactamente iguales | `metrics-proof.json` | Aprobado |

Las evidencias locales están bajo `.tools/calendar76/`; las capturas con datos sintéticos, bajo `output/calendar76/`. Se conservó la primera incidencia visual detectada: la muestra de leyenda heredaba el color del tema. Se restauró su texto explícito `var(--calendar-ink)` y la matriz completa posterior pasó.

La medición Node de cinco muestras con diez años y 1000 sesiones sintéticas (1,28 MB, ocho ejercicios por sesión) compara las mismas 365 fechas y entrada inmutable: mediana anual anterior aproximada 757,9 ms frente a 547,0 ms en frío con el nuevo snapshot y caché. La autoridad existente cuesta 190,1 ms; el encabezado Streak conserva su llamada independiente. Son mediciones de funciones en esta PC, no de un teléfono ni garantía de tiempo de render. No se modifican los algoritmos de historial para optimizar esta presentación.

La primera suite frontend por defecto tuvo cuatro timeouts de Excel de 5 s bajo carga; la corrida completa con cuatro workers aprobó 2129/2129 sin modificar aserciones ni plazos. No hay scripts frontend de lint/typecheck. Los checks de publicación, paquete público, actualización y notificación se registran en [RELEASE-AUDIT-1.15.76.md](RELEASE-AUDIT-1.15.76.md).

Edge de escritorio, WebKit móvil emulado y emulador Android se distinguen de dispositivo real. No hay teléfono ADB conectado; iPhone/Safari/PWA instalada y recepción/toque/instalación físicos permanecen pendientes. La imagen de referencia se usa para la composición, no se copian perfiles, datos ni fotografías de terceros.
