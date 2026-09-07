# Copia semanal privada de TGym en Google Drive

TGym puede conservar una única copia completa en la carpeta privada `appDataFolder` de Google Drive. El archivo no aparece entre los documentos normales del usuario y ninguna otra aplicación puede explorarlo.

## Activación gratuita

1. Crea un proyecto en Google Cloud y habilita **Google Drive API**.
2. Configura la pantalla de consentimiento OAuth para uso personal.
3. Para la PWA, crea un **ID de cliente OAuth de tipo Aplicación web** y añade como origen autorizado la dirección HTTPS donde está publicada TGym.
4. Para Android, crea un cliente OAuth de tipo **Android** con el paquete `app.framegym.mobile` y el SHA-1 `DA:1F:F0:9A:EF:28:E4:79:86:7D:20:64:19:FA:E0:37:4C:38:62:01`.
5. En TGym abre **Configuración → Copia en la nube** y pulsa **Guardar copia ahora**. Solo la PWA solicita pegar el ID público; Android usa Servicios de Google Play.

El ID de cliente no es una contraseña. No se debe introducir ni guardar ningún secreto de cliente en la aplicación.

## Funcionamiento

- La primera conexión solicita permiso únicamente para la carpeta privada de TGym.
- Android autoriza mediante la API nativa de Google Identity; no abre OAuth dentro del WebView.
- Se actualiza un solo archivo llamado `framegym-weekly-backup.json`, evitando llenar Drive con copias repetidas.
- Cada vez que TGym se abre o vuelve al primer plano, comprueba si han transcurrido siete días.
- Si Google no puede renovar la autorización sin interacción, la aplicación indica **Vuelve a conectar Google Drive**. Las PWA no pueden ejecutarse mientras están totalmente cerradas.
- **Guardar copia ahora** y **Restaurar la última copia de la nube** permiten actuar manualmente en cualquier momento.

También se puede establecer `VITE_GOOGLE_CLIENT_ID` durante la compilación para entregar el ID ya configurado a todos los usuarios de una instalación.
