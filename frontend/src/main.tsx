import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/chat.css";
import "./styles/chamada.css";
import "./styles/telas.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
