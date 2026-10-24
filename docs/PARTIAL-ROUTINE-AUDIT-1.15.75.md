# Parcial y finalización de rutinas — 1.15.75

El fondo solicitado para **Partially completed / Parcial** es `#0087C2`, con texto negro `#000000` (contraste 5,24:1) y borde `#00547A`. La definición compartida se aplica a las celdas y leyendas de pantalla y a los PDF/PNG de Consistency, incluidos Full, años completos y secciones combinadas. Streak conserva su leyenda de actividad: no se añade una categoría Parcial donde no existe.

Se conservan los otros colores confirmados: No entrenado `#ED1C24`, Pendiente `#696969`, Descanso blanco y Entrenamiento pausado `#791F34`. La fecha de inicio del registro sigue fuera de la cuadrícula; las fechas anteriores conservan su estado interno sin una categoría visible independiente.

## Reglas existentes comprobadas

La finalización del trabajo dentro de una sesión y la clasificación diaria de rutinas programadas responden a preguntas distintas. No se reclasifican históricos ni se convierte actividad parcial en ausencia de entrenamiento o en trabajo íntegramente realizado.

| Ámbito | Regla |
| --- | --- |
| Trabajo requerido en la sesión activa | Todas las filas que no sean calentamiento deben estar marcadas. Debe existir al menos una fila de trabajo. Se reutiliza `effectiveWorkoutComplete`; los calentamientos no bloquean la finalización. |
| Fin anticipado | Si queda trabajo requerido sin marcar, se mantiene la confirmación antes de guardar. Cancelar conserva la sesión; confirmar guarda lo realizado según el mecanismo existente. |
| Actividad registrada | Una sesión finalizada con resultado positivo de trabajo, incluso unilateral parcialmente confirmado, cuenta como actividad. Abrir una sesión, dejarla activa, cancelarla o registrar solo calentamientos no cuenta. |
| Rutina programada realizada | Una sesión válida se empareja una sola vez por su origen e ID estable. La compatibilidad histórica por nombre solo se usa cuando no hay ambigüedad. |
| Parcial del calendario | Hay más de una rutina programada y se han registrado algunas, pero no todas: `0 < realizadas < programadas`. Ejemplo: 1/2 muestra Parcial; 2/2 completa ambas posiciones. |
| Entrenamiento extra | Cuenta como actividad diaria y racha según las reglas existentes, sin completar otra rutina programada. El caso extra 0/2 conserva su representación de actividad y las dos posiciones pendientes. |
| Racha y porcentaje diario | Varias sesiones en una fecha cuentan como una fecha activa. El porcentaje diario de actividad es distinto del contador de rutinas realizadas/programadas. |
| Fechas, descanso y pausa | Se mantienen las fechas locales, el límite de seguimiento y las reglas de descanso, pausa y pendiente. No cambia ningún denominador. |

Un entrenamiento finalizado manualmente con trabajo pendiente conserva el tratamiento existente de actividad y origen. No se introduce una nueva definición de Parcial para el contenido de cada rutina. Para adoptar esa regla habría que decidir expresamente qué significa completar una rutina y cómo tratar registros antiguos: el guardado manual histórico puede omitir ejercicios totalmente sin marcar, por lo que sus filas conservadas no permiten reconstruir toda la prescripción original.

## Defecto reproducido y corrección

Con una fila de trabajo realizada y un calentamiento pendiente, el reloj reconocía la rutina completa, pero el botón y la confirmación final contaban también el calentamiento. La llamada real a `finishWorkout` abría «Finish early? — 1 set still unchecked» aunque `effectiveWorkoutComplete` era verdadero.

La corrección alinea el botón y la confirmación con la misma definición de trabajo requerido. La ausencia de actividad continúa teniendo su confirmación propia. No cambia la escritura de historial, el origen, la duración efectiva, la progresión ni las reglas diarias; no se marcan series automáticamente.

La validación detectó además una carrera en el test de importación: esperaba 25 ms fijos aunque la UI deja pintar el estado de guardado antes de persistir. Bajo carga, el test comprobaba el perfil antes de terminar y su continuación podía alcanzar el siguiente caso. El harness ahora espera la salida efectiva de `saving`; se mantienen las aserciones de rollback, reintento único y aceptación de adaptaciones. No cambia el importador de producción.

## Evidencia y límites

Los casos sintéticos antes del cambio incluyen 0/2, 1/2, 2/2, extra 0/2, finalización manual incompleta, ejercicio totalmente pendiente, unilateral parcial, sesión activa, cancelada, solo calentamiento e identidad editada. La reproducción de UI anterior se ejecutó en Edge y WebKit, guardó y recargó los registros y revisó Home, calendario e History. Se documentan como reglas observadas; no se presentan esas reglas deliberadas como defectos nuevos.

Resultados finales de regresión, exportables abiertos, CI, artefactos y publicación: [RELEASE-AUDIT-1.15.75.md](RELEASE-AUDIT-1.15.75.md). La auditoría general y las pruebas físicas pendientes continúan en [APP-AUDIT-2026-10-19.md](APP-AUDIT-2026-10-19.md).
