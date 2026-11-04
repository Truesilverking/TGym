# Catálogo oficial: evaluación y preparación local

Fecha: 17 de octubre de 2026 (America/Santo_Domingo).

## Resultado y alcance

Es viable separar el contenido de las actualizaciones de TGym reutilizando GitHub y su alojamiento estático. **La distribución independiente todavía es una propuesta**: requiere autorizar un canal de publicación y una identidad criptográfica. No se han creado claves, permisos, servicios, ramas de contenido ni publicaciones de catálogo. Tampoco se añadió un actualizador de catálogo incompleto a la app.

Se implementó una herramienta **local de borradores y preparación para revisión**, con copia inicial del catálogo oficial actual, edición, importación de recursos, vista previa, validación, respaldo automático del JSON anterior y paquete inmutable de revisión. Guardar o preparar **no publica**. El paquete no tiene firma ni autorización remota y ninguna app lo consume.

La condición del pedido que exige presentar requisitos antes de configurar nuevos permisos aplica aquí. Los reportes y la publicación autorizada de la nueva versión de la app siguen su flujo habitual y no dependen de esta decisión.

Decisión confirmada por el propietario durante esta sesión: **entregar la propuesta y la herramienta local; dejar publicación y actualización del catálogo pendientes de configurar**. No se autorizó configurar la identidad ni el canal remoto en esta entrega.

## Arquitectura encontrada

| Área | Implementación actual y consecuencia |
| --- | --- |
| Catálogo | `frontend/src/lib/exercises-data.js` y las capas aprobadas en `exercises.js` forman 1324 filas oficiales. `CATALOGUE`, `EXIDX` y `BODYPARTS` se construyen al cargar el módulo. La app no consulta versiones de contenido. |
| Personalización | `S.customEx`, `exerciseAliases` y las notas/preferencias del usuario viven en su perfil; `registerCustom` conserva la resolución por ID. El editor de ejercicios existente crea/edita estos datos personales, no un catálogo global. |
| Historial, rutinas e intercambio | Comparten IDs y resolutores. `routine-exchange.js` además captura un `Map` de los ejercicios oficiales al importar el módulo. Cambiar solamente el array de la biblioteca produciría lectores incoherentes. Un cambio de músculo/equipo oficial puede afectar cálculos que consultan `EXIDX`; requiere política explícita y pruebas. |
| Administración | `/admin` pertenece al API opcional y comprueba administrador también en servidor. No administra contenido global ni autoriza publicaciones de GitHub. Una sesión admin o reconocer «mi PC» en JavaScript no establece permiso de publicación. |
| Multimedia | Los modos standalone/mobile apuntan a imágenes y GIF de un commit inmutable del dataset en jsDelivr. Los nombres existentes conservan esa referencia. El service worker guarda hasta 40 recursos vistos en su caché separada, con fallback visual y reintento al reconectar. Esto **no garantiza retención permanente de todos los recursos vistos**. |
| Publicación | `release.yml` genera un artefacto completo de Pages junto al APK/AAB y metadatos de actualización. Una segunda publicación de Pages que sólo contuviera catálogo borraría la app; una publicación de app posterior también eliminaría contenido que no se incorporara al artefacto. |
| Actualizaciones actuales | El aviso de actualización de app y sus comprobaciones manuales/automáticas ya existen. No son avisos de catálogo. Las verificaciones de APK, firma, SHA-256 y versión deben permanecer intactas. |

Auditoría remota de permisos realizada por el coordinador, sin modificarlos: el colaborador `Truesilverking` tiene permiso `admin`; Pages es público y usa workflow; el entorno `github-pages` tiene una política personalizada de ramas y no exige revisores. Esto verifica capacidad de administración de la cuenta. **No prueba que sólo esta computadora pueda publicar**.

## Herramienta local implementada

Requiere Node 22 o posterior, ya utilizado en CI. No añade dependencias ni modifica el perfil de TGym.

Desde la raíz del repositorio, en PowerShell:

```powershell
node tools/catalog/admin.mjs init
node tools/catalog/admin.mjs serve
```

`init` copia exclusivamente el catálogo oficial del código actual a `%LOCALAPPDATA%\TGymCatalog`; no lee perfiles, exportaciones ni el navegador. Se niega a sobreescribir una copia existente. `serve` imprime una dirección local de sesión para abrir en el navegador. Ctrl+C cierra el servidor y revoca la sesión. Puede elegirse una carpeta **fuera del repositorio público** con `--root "C:\carpeta\TGymCatalog"` en cada comando.

Flujo disponible:

1. Buscar un ejercicio o crear uno nuevo. Los nuevos reciben un UUID con prefijo `official_`; no reutilizarlo para otro movimiento.
2. Editar nombre/instrucciones/metadatos. Un cambio visible de nombre conserva el nombre anterior en `legacyNames`. El editor JSON permite revisar la definición completa.
3. Elegir imagen o animación y añadir/reemplazar PNG, JPEG, GIF o WebP. Los archivos se guardan una sola vez por SHA-256. Un reemplazo crea una nueva referencia y deja disponible el archivo anterior.
4. Revisar la vista previa: decodificación real del navegador, dimensiones, legibilidad y movimiento. El modo de movimiento reducido mantiene oculta la animación hasta pulsar Reproducir.
5. Validar y guardar. Cada guardado válido respalda primero el JSON previo en `backups/`; un error mantiene el archivo principal anterior. Una revisión desactualizada en otra ventana no puede sobrescribir cambios recientes.
6. Asignar versión `major.minor.patch` y cambios, guardar y preparar el paquete. El resultado está en `prepared/<versión>/`, con catálogo, recursos y `review.json` que declara `published: false`. La misma versión no se prepara de nuevo encima de otra.

Comandos adicionales:

```powershell
node tools/catalog/admin.mjs validate
node tools/catalog/admin.mjs prepare
node --test tools/catalog/core.test.mjs
```

Respaldo: copiar **toda** la carpeta `TGymCatalog`, incluidos `media`, `baseline.json` y `backups`, a una unidad o servicio de respaldo elegido por el propietario. Los respaldos automáticos guardan el JSON anterior y los recursos son inmutables; no constituyen por sí solos una copia frente a pérdida del disco. La herramienta no configura ni transmite un respaldo externo.

La validación local rechaza campos desconocidos/personales, IDs duplicados o inseguros, borrado de IDs existentes, URLs temporales/locales, recursos ausentes, diferencias de hash/extensión y cambios de metadatos de cálculo de ejercicios existentes. Los archivos admiten hasta 8 MiB, 4096 píxeles por lado y un paquete de recursos nuevos de hasta 96 MiB. GIF/WebP tienen límites de cuadros y píxeles acumulados para acotar la vista previa. Los GIF conservan exactamente sus bytes y movimiento; no se afirma haberlos optimizado con un codificador. La deduplicación evita copias repetidas.

La inspección de formato lee firmas/cabeceras/dimensiones y estructura de animación; **no sustituye una decodificación completa de PNG/JPEG/WebP**. La vista previa verifica la decodificación en el navegador y el operador debe revisar claridad y movimiento. El futuro canal de publicación debe repetir la validación con un decodificador aislado antes de firmar/activar. El formato del paquete es un borrador revisable, no un contrato de actualización ya instalado.

La autorización del editor es sólo local: escucha en `127.0.0.1`, exige token aleatorio por sesión, rechaza Host/Origin ajenos y no permite lectura/escritura fuera de la carpeta de borrador. No identifica ni autoriza un equipo ante GitHub. El equipo y la cuenta de Windows deben mantenerse protegidos; otros procesos bajo esa misma cuenta siguen teniendo acceso a sus archivos.

## Propuesta mínima de distribución

### Canal, publicación y alojamiento

Mantener la copia maestra privada/local. Crear un canal de contenido con versiones inmutables y recursos por hash; almacenar solamente contenido aprobado para publicación. No copiar nunca `S`, notas, aliases, archivos privados ni borradores completos desde el perfil.

Propuesta preferida: rama de artefactos de contenido del repositorio existente y un workflow manual dedicado. Publica primero `catalog/<versión>/media/<hash>.<ext>`, después `catalog.json` y firma; comprueba descargas públicas y hashes antes de avanzar `catalog/latest.json`. El manifiesto firmado incluye versión de esquema y catálogo, fecha, cambios, tamaño/hash del catálogo y cada recurso, versión mínima de app y clave firmante. Su contenido firmado debe tener una serialización única; el cliente verifica firma y hash antes de leer datos.

La publicación de contenido y `release.yml` deben tomar el **mismo grupo de concurrencia**, leer la última versión de ambos canales y montar un único artefacto de Pages con app + actualizaciones de app + catálogo. Deben verificar que no desaparecieron versiones de catálogo referenciadas por clientes. Un release de app no puede restaurar una copia vieja de `latest.json`. Se conserva el instalador y la firma Android actuales. Esto requiere editar el pipeline y permisos/controles de publicación, **pendiente de autorización**.

Alternativa si se prefiere evitar modificar el despliegue conjunto: repositorio dedicado de contenido con su propio Pages y permisos aislados. Requiere autorizar la creación/configuración de ese repositorio y otra URL confiable en la app. Tiene mayor separación administrativa, pero añade un recurso de infraestructura.

Límites comprobados en documentación oficial: un sitio de Pages publicado no puede superar 1 GB; existe un límite flexible de transferencia de 100 GB/mes. No se promete coste cero: deben verificarse plan real, consumo de Actions, tamaño final con APK y retención de versiones, cantidad de usuarios y licencias de los recursos. [Límites de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).

### Autorización del equipo y revocación

Hay que elegir expresamente el nivel de garantía:

| Opción | Garantía y requisitos |
| --- | --- |
| Equipo ligado a hardware (preferida para el requisito literal) | Crear una clave de firma no exportable en el TPM de Windows y publicar sólo su clave pública. El editor solicita firma al proveedor protegido; CI y las apps verifican la firma. Verificar primero disponibilidad TPM/proveedor/algoritmo compatible y la autorización del usuario de Windows. La clave no sale del equipo, aunque malware con permiso para usarla sigue siendo un riesgo. La clave pública, no una identificación del navegador, autoriza las publicaciones. Requiere configurar esta identidad y el control del canal. |
| Credencial por posesión | Clave de firma protegida localmente y credencial de GitHub de alcance mínimo. Es más sencilla, pero una copia de las claves permite publicar desde otro equipo. Sólo puede elegirse aceptando esta limitación; no cumple una garantía literal de equipo exclusivo. Una deploy key de escritura autoriza un repositorio, no es por sí sola una restricción a una rama. |

Fundamento: [TPM de Windows](https://learn.microsoft.com/en-us/windows/security/hardware-security/tpm/how-windows-uses-the-tpm), [proveedores CNG](https://learn.microsoft.com/en-us/windows/win32/seccertenroll/cng-key-storage-providers) y [deploy keys de GitHub](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys). No se han generado ni instalado claves.

El permiso GitHub debe limitarse al canal, con protección de rama/entorno y revisión del actor antes de publicar. La firma debe ser obligatoria incluso cuando alguien tenga permiso de escritura en el repositorio. Un administrador del repositorio puede cambiar permisos/workflows, y quien pueda publicar una app modificada podría eliminar su verificación: ninguna clave puede quitar al propietario último del proyecto esa autoridad. Las claves privadas y tokens no se guardan en código público, paquetes, localStorage de usuarios ni respaldos portables.

Revocar el equipo implica retirar/revocar su credencial de publicación en GitHub y deshabilitar la clave pública del canal mediante una política de confianza firmada por una clave de recuperación independiente. La clave de recuperación debe establecerse antes de distribuir el canal. Las apps deben obtener y validar esa política cuando se conecten y rechazar firmas revocadas; un cliente que permanezca offline conserva su última versión válida y no puede conocer una revocación nueva. Si se pierde la clave sin esa recuperación preestablecida, hace falta una actualización de app para cambiar la raíz de confianza. La rotación y el procedimiento de recuperación forman parte de la configuración pendiente.

### Cliente y protección de datos

Crear un repositorio de contenido local separado (`IndexedDB` para PWA; almacenamiento privado equivalente en Capacitor), sin añadir todo el catálogo o sus imágenes a `gym_state_v1`. La app incluida conserva un catálogo inicial funcional offline. El registro instalado contiene manifiesto verificado, esquema, versión, catálogo y las referencias descargadas. El puntero activo sólo cambia en una transacción después de validar la nueva versión completa; una descarga fallida deja la anterior intacta. Reintentar la misma versión/hash es idempotente.

Sustituir los índices capturados al cargar módulo por una única instantánea oficial versionada que lean biblioteca, búsqueda, traducciones, resolutor de IDs e intercambio. El overlay personal conserva precedencia por ID. Colisiones con IDs privados se rechazan; nunca se reasigna un ID a otro movimiento. Una actualización no escribe rutinas, historial, aliases, notas, preferencias ni `active`. Si hay sesión activa o edición sin guardar, se descarga/prepara y se aplaza la activación hasta una frontera segura. Cambios de semántica que afectan cálculos necesitan una migración/revisión separada; el canal mínimo permite primero nuevos ejercicios y correcciones de presentación/recursos.

Al abrir o reconectar, solicitar metadatos con tiempo límite y sin caché obsoleta del shell. Si hay versión compatible nueva: «Catálogo actualizado disponible», resumen, «Actualizar» y «Más tarde». Guardar la versión pospuesta fuera del perfil para no repetir el aviso por la misma versión; el botón manual de Ajustes siempre permite revisarla. Mostrar progreso, error recuperable y versión realmente instalada. Un catálogo con esquema/firma/hash inválido no se activa. No se promete aviso inmediato con app cerrada u offline.

Descargar multimedia por demanda usando URLs portables inmutables y verificar hash/tamaño antes de guardarla. Mantener separada la caché de recursos oficiales de la caché del shell y datos personales. El mínimo actual de 40 imágenes debe sustituirse por un índice de descargas con cuota explícita: mantener recursos descargados mientras el almacenamiento lo permita y ofrecer descarga/retención del material de rutinas elegidas. Ante falta de espacio, conservar perfil y versión activa; mostrar espacio requerido y permitir al usuario gestionar sólo recursos oficiales recuperables. Ninguna PWA puede prometer retención después de que el navegador/OS elimine datos del sitio; solicitar almacenamiento persistente cuando esté disponible y documentar su límite.

Exportaciones de rutina: incluir sólo definiciones necesarias y referencias oficiales con versión/hash, nunca la multimedia de todo el catálogo. Para receptores antiguos o offline sin esa versión, debe mantenerse el camino portable existente de definición/recurso necesario o una elección explícita, sin sustituir ejercicios por nombre. Esto requiere ampliar y probar compatibilidad antes de activar el canal en producción.

## Pruebas realizadas y aceptación pendiente

Implementado y probado localmente: validación de identidades/metadatos privados/cálculos, GIF con dos cuadros conservado byte a byte, deduplicación, respaldo antes de guardar, fallo de recurso ausente/corrupto con conservación del último JSON, reintento, paquete inmutable no publicado, rechazo local sin token/Host/Origin y rechazo de edición desactualizada. El servidor carece deliberadamente de endpoint de publicación. Ver `tools/catalog/core.test.mjs`.

La prueba de acceso local rechazada **no equivale** a rechazar una publicación remota no autorizada. Esa prueba requiere el canal y sus controles reales.

Pendiente de autorización e implementación del canal: crear ejercicio oficial con GIF → publicar → detectar desde otro dispositivo → actualizar → abrir → cerrar/reabrir offline; reemplazar imagen y conservar referencia anterior; interrupción, cuota, reintento idempotente; revocar/rechazar firma/equipo no autorizado en el servicio y el cliente; contraste de esquema nuevo incompatible; portabilidad con clientes anteriores y conservación de sesión/historial/personalización. Verificación física de iPhone/Safari/PWA requiere un iPhone disponible; Playwright WebKit sólo sería evidencia emulada. El editor local de Windows y las comprobaciones de reportes no prueban ese recorrido remoto.
