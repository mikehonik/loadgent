# DarnelCube 3D

Optimizador 3D de carga de contenedores y pallets. App React con motor en Web Worker: `src/motor/` (motor, corrida, reporte), `src/archivos/` (Excel de maestro, pedido y resultados), `src/ui/` y `src/visor/` (interfaz y visor 3D), `src/App.jsx` (estado y armado de pantallas).

- `npm run dev` — app en el navegador
- `npm run build` — build de producción en `dist/`
- `npm test` — tests con Vitest
- `npm run html` — un solo archivo `dist/DarnelCube3D.html` que se abre sin servidor (motor incrustado)

`datos/` tiene el maestro y la plantilla de carga de ejemplo; el maestro trae la hoja `Conversiones` con equivalencias de unidad (millares, tarimas, kilos) para los SKUs de ejemplo. `referencia/` guarda el build compilado 1.0 (histórico: todo lo que tenía ya está en este fuente) y ejemplos de salida.

Versión visible: `package.json` + novedades en `src/version.js`. Cómo publicar y subir la versión: `GUIA_PUBLICAR.md`.
