import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/bricolage-grotesque/opsz.css";
import "@fontsource-variable/onest";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/chat.css";
import "./styles/chamada.css";
import "./styles/telas.css";
import App from "./App";

// ?demo no `npm run dev`: dados de exemplo no lugar do backend (fica ligado até fechar a aba).
// VITE_DEMO=1 no build gera uma versão só de demonstração (ex.: pra publicar como página estática).
// Fora desses dois casos, o import dinâmico some do build de produção.
function demoAtivo() {
    const pediu = new URLSearchParams(location.search).has("demo");
    try {
        if (pediu) sessionStorage.setItem("liberdade:demo", "1");
        return pediu || sessionStorage.getItem("liberdade:demo") === "1";
    } catch {
        return pediu;
    }
}

async function iniciar() {
    if (import.meta.env.VITE_DEMO === "1" || (import.meta.env.DEV && demoAtivo())) {
        const { instalar } = await import("./demo/mock");
        instalar();
    }

    createRoot(document.getElementById("root")!).render(
        <StrictMode>
            <App />
        </StrictMode>,
    );
}

iniciar();
