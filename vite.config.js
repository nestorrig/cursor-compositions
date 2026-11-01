import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const root = fileURLToPath(new URL('.', import.meta.url))

function sceneRoutes() {
  const rewrite = (req, _res, next) => {
    const url = req.url ?? ''
    const queryIndex = url.indexOf('?')
    const path = queryIndex === -1 ? url : url.slice(0, queryIndex)
    const search = queryIndex === -1 ? '' : url.slice(queryIndex)

    if (path === '/01' || path === '/02' || path === '/03') {
      req.url = `${path}/${search}`
    }

    next()
  }

  return {
    name: 'scene-routes',
    configureServer(server) {
      server.middlewares.use(rewrite)
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite)
    },
  }
}

export default defineConfig({
  base: './',
  appType: 'mpa',
  plugins: [sceneRoutes()],
  build: {
    rollupOptions: {
      input: {
        index: resolve(root, 'index.html'),
        '01': resolve(root, '01/index.html'),
        '02': resolve(root, '02/index.html'),
        '03': resolve(root, '03/index.html'),
      },
    },
  },
})
