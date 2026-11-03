# Diseño de Interacciones: Cursor

Proyecto estudiantil del curso **Interacción y Render Web Avanzado**, impartido por [Andrew Alvarado](https://andrew.studio/) en el tercer semestre de la licenciatura en Computación Creativa en [CENTRO](https://centro.edu.mx/).

Tres composiciones interactivas hechas con Three.js y WebGPU, pensadas para explorarse con el cursor.

## Composiciones

| Pieza             | Ruta           | Descripción                                                             |
| ----------------- | -------------- | ----------------------------------------------------------------------- |
| Hero 3D — Cúspide | [`/01`](./01/) | Hero con elementos geométricos y posprocesado de risografía.            |
| Póster — Vértigo  | [`/02`](./02/) | Póster editorial a partir de la película _Vértigo_ de Alfred Hitchcock. |
| Personaje — Cubi  | [`/03`](./03/) | Cubo de vidrio con cara y grilla fluida; sigue y reacciona al cursor.   |

El índice vive en la raíz y enlaza las tres piezas.

## Requisitos

- Node.js 20 o superior
- Un navegador con [WebGPU](https://caniuse.com/webgpu) (Chrome o Edge recientes)

## Desarrollo

```bash
npm install
npm run dev
```

Vite sirve el sitio en `http://localhost:5173/`.

- `npm run build` genera la versión de producción en `dist/`
- `npm run preview` sirve esa build

Cada escena acepta `#debug` en la URL para abrir el inspector.

## Stack

- [Vite](https://vite.dev/) 8 (MPA)
- [Three.js](https://threejs.org/) r186 con WebGPURenderer y TSL
- [GSAP](https://gsap.com/) para movimiento de interfaz

## Licencia

El código se distribuye bajo la [licencia MIT](./LICENSE).
