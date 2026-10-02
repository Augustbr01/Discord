import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    server: {
        allowedHosts: ["liberdade.phelipedev.com.br"],
        // repassa /livekit/* pro Fastify, assim não precisa de CORS
        proxy: {
            "/livekit": "http://localhost:3000",
        },
    },
});
