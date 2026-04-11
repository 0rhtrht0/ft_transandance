import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

export default defineConfig({
    server: {
        allowedHosts: true
    },
    plugins: [vue()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')
        }
    },
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: "./src/tests/setup.js",
        include: ["src/tests/**/*.test.js"],
        exclude: ["**/tests/e2e/**", "**/node_modules/**"]
    }
});
