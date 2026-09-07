# TGym

TGym es una aplicación privada de entrenamiento para Android y navegadores, disponible en español e inglés. Permite crear rutinas, registrar sesiones, consultar estadísticas y conservar copias de seguridad bajo el control del usuario.

## Funciones principales

- Rutinas semanales, planes guiados y sesiones libres.
- Rangos de repeticiones, RIR, top sets, back-off sets y calentamientos automáticos.
- Cronómetros de entrenamiento, descanso y ejercicios por tiempo.
- Historial, medidas corporales, IMC, InBody, progresión y calendarios de constancia.
- Conversión completa entre kg/lb y cm/in.
- Bloqueo mediante PIN y biometría en dispositivos compatibles.
- Importación, exportación y copias de seguridad en Google Drive.
- PWA instalable y aplicación nativa para Android.
- Comprobación automática de nuevas versiones publicadas en GitHub.

## Desarrollo

La aplicación principal está en `frontend`.

```bash
cd frontend
npm ci
npm test
npm run build
```

Las instrucciones de publicación están en [`frontend/docs/RELEASING.md`](frontend/docs/RELEASING.md).

## Privacidad

Los datos permanecen en el dispositivo salvo cuando el usuario decide exportarlos o activa una copia de seguridad en su propia cuenta de Google Drive.

## Licencia y atribución

TGym deriva de [openGym](https://gitlab.com/DuarteSantos8/opengym), creado por Duarte Santos, y se distribuye bajo la licencia [GNU AGPL v3](LICENSE). Se conserva el historial de Git para mantener la atribución del proyecto original.
