/// <reference types="vitest/config" />
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test-setup.ts",
    fileParallelism: false,
    css: { include: [/tokens\.css/] }, // tokens.test reads tokens.css via ?raw
  },
})
