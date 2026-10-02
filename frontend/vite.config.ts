import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    server: {
        allowedHosts: ["liberdade.phelipedev.com.br"],
        // repassa /api/* pro Fastify, assim não precisa de CORS
        proxy: {
            "/api": "http://localhost:3000",
        },
    },
});
