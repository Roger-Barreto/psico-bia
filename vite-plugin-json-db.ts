import type { Plugin } from "vite"

export function jsonDbPlugin(): Plugin {
  return {
    name: "json-db",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next()
        try {
          const { handleApi } = await server.ssrLoadModule("/server/routes.ts")
          const host = req.headers.host ?? "localhost"
          const url = new URL(req.url, `http://${host}`)
          await handleApi(req, res, url)
        } catch (err) {
          console.error("[json-db]", err)
          res.statusCode = 500
          res.setHeader("Content-Type", "application/json; charset=utf-8")
          res.end(
            JSON.stringify({
              error: "internal",
              message: err instanceof Error ? err.message : String(err),
            }),
          )
        }
      })
    },
  }
}
