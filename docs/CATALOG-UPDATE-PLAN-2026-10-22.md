# Actualización independiente del catálogo: propuesta de implementación

Fecha: 22 de octubre de 2026, America/Santo_Domingo.

**Estado: propuesta; esta entrega no implementa un actualizador de catálogo ni publica contenido.** Complementa [OFFICIAL-CATALOG-PROPOSAL.md](OFFICIAL-CATALOG-PROPOSAL.md). El editor local de `tools/catalog/` prepara borradores revisables; las apps todavía no los consumen. La publicación y su identidad autorizada siguen pendientes.

## Punto de integración real

`frontend/src/lib/exercises.js` combina `EXDB`, correcciones de nombres y metadatos aprobados; construye `CATALOGUE`, `EXIDX` y `BODYPARTS` al cargar el módulo. `registerCustom` superpone `S.customEx` por ID y `allExercises` mezcla catálogo y ejercicios personales. `routine-exchange.js` captura además su propio `Map` de oficiales al importar el módulo. Por tanto, sustituir sólo la lista visible dejaría importaciones y resolutores con versiones distintas.

La implementación debe introducir un repositorio oficial con una instantánea inmutable por versión y lectura común para biblioteca, búsqueda, traducciones, resolutores, mapas e intercambio. Cada operación recibe una única revisión; los índices derivados se construyen antes de activarla. El catálogo incluido en la app sigue siendo el respaldo inicial offline. Los datos personales permanecen en el modelo y la persistencia actuales.

## Experiencia propuesta

1. Al abrir, reconectar o pulsar «Buscar actualizaciones de catálogo» en Ajustes, consultar un manifiesto compatible con tiempo límite. Una consulta fallida conserva el uso normal del catálogo instalado.
2. Mostrar «Nueva versión del catálogo», versión, fecha y resumen concreto de cambios; ofrecer **«Actualizar catálogo»** y **«Más tarde»**. Posponer recuerda esa versión localmente; Ajustes permite volver a revisarla. No se instala ni descarga toda la multimedia por aceptar un aviso.
3. Al actualizar, mostrar progreso de descarga y validación. Si existe entrenamiento activo o un editor con cambios pendientes, dejar la versión preparada y avisar que se aplicará al terminar o guardar/cancelar. Revalidar esa frontera justo antes de activar.
4. Confirmar la versión realmente instalada. Ante error, mostrar una acción «Reintentar» conservando la anterior. Ajustes ofrece «Restaurar catálogo anterior» y conserva el resumen de la versión activa. No se promete detección con la app cerrada u offline.

## Manifiesto y distribución

Publicar rutas inmutables `catalog/<versión>/catalog.json` y `catalog/<versión>/media/<sha256>.<ext>`. Avanzar `catalog/latest.json` únicamente después de verificar la descarga de todos los archivos exigidos por la versión. El manifiesto firmado debe incluir:

- `schemaVersion`, `catalogVersion`, fecha, `minAppVersion` y resumen de cambios traducible;
- URL, SHA-256 y tamaño del JSON; inventario de recursos con URL, hash, tamaño y tipo;
- identificador de clave y firma sobre una representación canónica documentada.

El cliente verifica origen permitido, compatibilidad, límites, firma, esquema, identidad y hashes antes de interpretar o activar contenido. El servidor valida el paquete y exige la identidad de publicación autorizada. La credencial de una cuenta o una comprobación JavaScript de «este PC» no satisfacen el límite de publicación desde el equipo autorizado. Se conserva la propuesta de clave vinculada al equipo, revocación y recuperación descrita en el documento anterior; nada de ello se configura en esta entrega.

Si se comparte Pages con la app, ambos workflows deben montar un artefacto completo y compartir exclusión de concurrencia; ninguno puede borrar el otro canal ni retroceder su manifiesto. La alternativa de alojamiento separado requiere autorizar ese recurso y su origen confiable. No se cambian las verificaciones del actualizador de la app/Android.

## Conservación de datos e identidad

- Un ID identifica siempre el mismo ejercicio. Corregir un nombre conserva ID y añade el anterior a la búsqueda. Un movimiento distinto recibe un ID nuevo; retirar uno mantiene su definición resoluble y su recurso anterior para referencias existentes.
- La actualización sólo escribe el repositorio oficial. No reescribe IDs ni contenido de rutinas, historial, sesión activa, `S.customEx`, alias, notas, preferencias, fotos o medidas. El overlay personal conserva precedencia; una nueva colisión con un ID privado se rechaza para revisión, sin reasignación automática.
- La primera versión del canal admite nuevos ejercicios y cambios de presentación: nombres, traducciones, instrucciones, imágenes y GIF. Cambiar modo de registro, músculos, equipo u otros metadatos que influyan en cálculos exige una revisión/migración separada. Parte del historial oficial consulta `EXIDX` actualmente: no se puede prometer que una modificación semántica sea sólo visual.
- Para sesiones futuras, añadir de forma compatible la revisión oficial utilizada y las instantáneas necesarias en la frontera de inicio/finalización. Reutilizar `target` y el patrón de `muscleSnapshot` existentes; no recalcular ni migrar silenciosamente sesiones antiguas. El intercambio sigue exportando las definiciones necesarias y conserva compatibilidad con clientes sin esa revisión.

## Instalación transaccional y recuperación

Proponer una base IndexedDB independiente `tgym-catalog`, con almacenes `versions`, `staging` y `metadata`. Mantener fuera de `gym_state_v1` y de `tgym-profile/snapshots` tanto catálogo como multimedia oficial. La representación es nueva y todavía no existe.

1. Descargar a staging; verificar firma/hash, JSON y recursos obligatorios. Un reintento de la misma versión/hash reutiliza los archivos ya verificados. Descargar GIF adicionales por demanda y verificar antes de conservarlos.
2. Reconstruir y comprobar todos los índices con una instantánea candidata, sin publicarla al resto de la aplicación. Comprobar referencias, colisiones y la frontera sin entrenamiento/editor activo.
3. En una única transacción IndexedDB, guardar la versión completa y cambiar los punteros `active` y `previous`. Publicar la instantánea en memoria sólo tras `oncomplete`. No hay transacciones de red: la descarga termina antes de esta transacción.
4. Si falla la descarga, validación, cuota o transacción, la versión activa sigue intacta. Si la validación de arranque de una activación ya confirmada falla, recuperar la versión completa anterior y dejar la candidata en cuarentena. La app incluida cubre la ausencia de cualquier versión externa válida.
5. Conservar como mínimo la activa y la anterior, junto con sus recursos obligatorios. El rollback cambia catálogo e índices como una unidad; no restaura ni sobreescribe el perfil del usuario. En Capacitor, adaptar este contrato a almacenamiento privado con preparación y cambio atómico equivalente, sin depender de una caché del navegador.

`frontend/public/sw.js` separa shell y multimedia, conserva actualmente hasta 40 imágenes vistas y puede recibir respuestas opacas. Esa caché no constituye una instalación verificada ni una garantía de todos los GIF offline. El canal nuevo debe excluir su manifiesto de la caché del shell, usar recursos inmutables verificables y gestionar una cuota propia sin borrar datos personales. La descarga offline de recursos de rutinas elegidas debe ser una opción explícita. La evicción del almacenamiento del sitio sigue requiriendo el respaldo personal ya existente.

## Criterios de aceptación antes de habilitar el canal

Probar nueva versión → aviso → posponer → reabrir → actualizar → reiniciar offline; cambios de nombre/GIF manteniendo IDs; referencias de rutinas e historial y overlay personal intactos; sesión activa/editor pendiente; dos pestañas compitiendo por activar; firma/hash/esquema incompatible; interrupción y cuota; reintento idempotente; fallo de arranque y rollback; importación/exportación con clientes anteriores. Verificar por separado PWA y Capacitor. La publicación real exige antes controles de servicio, firma, revocación y rechazo de un publicador no autorizado.
