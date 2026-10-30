/// <reference types="vitest/config" />
import { defineConfig } from "vite"
import { configDefaults } from "vitest/config"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test-setup.ts",
    fileParallelism: false,
    exclude: [...configDefaults.exclude, ".worktrees/**"], // worktree copies fail when run from here

    css: { include: [/tokens\.css/] }, // tokens.test reads tokens.css via ?raw
  },
})
