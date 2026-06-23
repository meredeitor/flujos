# Flujos SGI

Version: 0.1.5

PWA para crear diagramas de flujo del sistema de gestion de calidad.

## Como abrirla

Desde esta carpeta puedes abrir `index.html` directamente para editar diagramas. Para guardar y abrir registros en Firebase necesitas conexion a internet y permisos de Firestore configurados.

Para probarla como PWA instalable, sirve la carpeta por HTTP:

```powershell
cd "C:\Users\gerente.sgi\Documents\Codex\2026-06-23\es\outputs\diagrama-flujo-pwa"
python -m http.server 4173 --bind 127.0.0.1
```

Despues abre:

```text
http://127.0.0.1:4173/index.html
```

## Funciones incluidas

- Figuras basicas: inicio/fin, proceso, decision, documento y cuadro de texto transparente.
- Conexiones con flechas visibles entre actividades, con puntas para indicar direccion de flujo.
- Seleccion multiple por area, Shift/Ctrl + clic, copiar, pegar y duplicar grupos de figuras.
- Copia como imagen PNG al portapapeles para pegar en Excel o PowerPoint cuando el navegador lo permita.
- Zoom de la zona de trabajo con botones, encaje automatico, pantalla completa y Ctrl + rueda del mouse.
- Zona de trabajo ampliada para diagramas grandes y desplazamiento arrastrando el fondo del lienzo.
- Modo pantalla completa para presentar el diagrama desde el area de trabajo.
- Edicion de texto, responsable y tipo de figura.
- Plantillas para auditoria interna y gestion de no conformidad.
- Guardado automatico en el navegador.
- Exportacion a SVG para insertar en documentos o imprimir.
- Guardado y apertura de registros en Firebase, con guardado local como respaldo automatico.
- `manifest.json` y `sw.js` para instalacion y uso offline cuando se sirve por HTTP/HTTPS.

## Copiar y pegar

- Usa `Seleccionar area` y arrastra un recuadro para seleccionar una parte del flujo.
- Usa `Copiar` y `Pegar` para duplicar esa seleccion dentro de la app.
- Usa `Duplicar` para copiar y pegar en un solo paso.
- Usa `Copiar imagen` para preparar un PNG que se puede pegar en Excel o PowerPoint.
- Tambien puedes usar `Ctrl+C`, `Ctrl+V` y `Ctrl+D` dentro del editor.

## Nota PWA

Los navegadores no permiten registrar service workers desde `file://`. Para que funcione el modo offline instalable, abre la app desde `http://127.0.0.1:4173` o publicala en cualquier hosting estatico con HTTPS.
