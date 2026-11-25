# Colores compartidos de calendario y exportables — 1.15.72

El propietario solicitó blanco para Descanso, rojo oscuro para pausa, rojo claro para No entrenado y gris claro para Pendiente, tanto en PDF/PNG/combinados como en el calendario en pantalla. La versión 1.15.71 tenía dos definiciones distintas; la pantalla conservaba los colores antiguos.

`calendar-visual.js` ahora define esos cuatro estados una sola vez en `SHARED_CALENDAR_STATES`. Los registros de pantalla y exportación reutilizan los mismos objetos; las celdas y leyendas de semana, mes y mini calendarios, y los generadores Streak/Consistency individuales y combinados siguen leyendo esos registros.

| Estado compartido | Fondo | Texto | Borde |
| --- | --- | --- | --- |
| Descanso | `#ffffff` | `#263345` | `#7b8796` |
| Entrenamiento pausado | `#791f34` | `#ffffff` | `#4b1020` |
| No entrenado | `#f8d4d7` | `#78222d` | `#b56b73` |
| Pendiente | `#edf0f4` | `#39465a` | `#a8b2c0` |

Todos los valores son opacos y explícitos. El blanco conserva borde visible incluso sobre una página blanca. El texto supera 4,5:1 de contraste y el borde de Descanso supera 3:1 frente al relleno blanco. El tema y el acento no sustituyen estos valores. La etiqueta de pantalla para `missed` pasa de No completada a No entrenado; su identificador no cambia.

## Estados y reglas conservados

- Sin seguimiento mantiene su tratamiento: gris `#d7dee8`, texto `#202733`, borde `#657185` y leyenda propia en pantalla. En exportables conserva su agrupación visual con Descanso y la ausencia de entrada propia; al ser blanco Descanso, su relleno exportado también es blanco. Esto se comunicó antes de aplicar el cambio. El estado interno sigue siendo `untracked`, sin alterar el inicio del seguimiento ni contarlo como descanso real.
- Parcial conserva el ámbar de pantalla y el pastel del exportable, conforme a la decisión anterior del propietario. Sus datos y significado permanecen intactos.
- Completada/Actividad registrada conserva azul. No se cambian geometría, paginación, estadísticas, cálculos, datos guardados, IDs, almacenamiento ni formatos.

## Regresión

`calendar-visual.test.js` comprueba los cuatro triples exactos de fondo/texto/borde y su igualdad entre pantalla y reportes; conserva el tratamiento de Sin seguimiento y Parcial y verifica contraste, colores distintos y correspondencia con leyendas. El antiguo requisito de distancia perceptual superior a 25 entre todos los colores se ajusta a la nueva elección explícita de blanco/grises claros: permanece para categorías saturadas y se complementa con colores y bordes distintos y texto legible para los claros.

`ZoomCalendar.test.jsx` monta un mes con los cuatro estados y comprueba estilos explícitos de celdas/leyendas, etiqueta accesible y conservación del estado de entrada. Las pruebas de cálculo y métricas de la aplicación permanecen separadas de la presentación.

La validación de navegador, archivos reales, CI, paquete firmado y publicación se registra en `RELEASE-AUDIT-1.15.72.md`. Se utilizan únicamente perfiles sintéticos aislados. WebKit se identifica como emulación, y una aceptación FCM no demuestra recepción o instalación física.
