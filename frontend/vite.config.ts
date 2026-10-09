import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    server: {
        // o `npm run dev` fica na 5174: a 5173 é a do site público (o preview, que o túnel usa),
        // assim parar/reiniciar o dev não derruba o site dos outros
        port: 5174,
        strictPort: true,
        // os dois sites públicos que rodam este código
        allowedHosts: ["liberdade.augustdev.com.br", "liberdade.phelipedev.com.br"],
        // repassa /api/* pro Fastify, assim não precisa de CORS.
        // ws: true também repassa o WebSocket do /api/gateway
        proxy: {
            "/api": { target: "http://localhost:3000", ws: true },
        },
    },
    // `npm run preview` serve o build (a pasta dist) na porta que o túnel da Cloudflare aponta.
    // Roda como serviço (liberdade-site.service): pra atualizar o site, só `npm run build`.
    // O proxy do /api e o allowedHosts vêm do `server` acima
    preview: {
        port: 5173,
        strictPort: true,
    },
});
