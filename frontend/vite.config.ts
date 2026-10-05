import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    server: {
        allowedHosts: ["liberdade.phelipedev.com.br"],
        // repassa /api/* pro Fastify, assim não precisa de CORS.
        // ws: true também repassa o WebSocket do /api/gateway
        proxy: {
            "/api": { target: "http://localhost:3000", ws: true },
        },
    },
});
