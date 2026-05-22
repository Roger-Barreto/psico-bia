import path from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { jsonDbPlugin } from "./vite-plugin-json-db"

export default defineConfig({
  plugins: [react(), jsonDbPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    strictPort: true,
  },
})
