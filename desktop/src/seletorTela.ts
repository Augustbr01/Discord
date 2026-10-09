// compartilhar tela: o Electron não tem o seletor do Chrome, então o getDisplayMedia do site cai
// aqui e a gente mostra o nosso (seletor.html). No macOS 15+ vai o seletor do próprio sistema,
// e no Linux com Wayland quem escolhe é o portal do sistema (aí já vem uma fonte só)
import { BrowserWindow, desktopCapturer, ipcMain, session, type DesktopCapturerSource } from "electron";
import path from "node:path";
import { CANAIS, type FonteTela } from "./canais";
import { ehDoSite } from "./config";

const WAYLAND = process.platform === "linux" && (process.env.XDG_SESSION_TYPE === "wayland" || !!process.env.WAYLAND_DISPLAY);
// áudio do sistema junto com a tela: o Chromium só consegue no Windows
const AUDIO_DO_SISTEMA = process.platform === "win32";

// um seletor aberto por vez: o pedido que chega com um aberto é recusado
let aberto: { janela: BrowserWindow; fontes: FonteTela[]; comAudio: boolean; responder: (id: string | null) => void } | null = null;

function paraFonte(f: DesktopCapturerSource): FonteTela {
    return {
        id: f.id,
        nome: f.name,
        tipo: f.id.startsWith("screen:") ? "tela" : "janela",
        miniatura: f.thumbnail.toDataURL(),
        icone: f.appIcon && !f.appIcon.isEmpty() ? f.appIcon.toDataURL() : null,
    };
}

function escolherFonte(pai: BrowserWindow, fontes: DesktopCapturerSource[], comAudio: boolean) {
    return new Promise<DesktopCapturerSource | null>((resolver) => {
        const janela = new BrowserWindow({
            parent: pai,
            modal: true,
            width: 820,
            height: 600,
            minWidth: 520,
            minHeight: 420,
            show: false,
            title: "Compartilhar tela",
            backgroundColor: "#09090b",
            autoHideMenuBar: true,
            webPreferences: {
                preload: path.join(__dirname, "preloadSeletor.js"),
                contextIsolation: true,
                sandbox: true,
            },
        });
        janela.setMenuBarVisibility(false);

        let respondido = false;
        const responder = (id: string | null) => {
            if (respondido) return;
            respondido = true;
            aberto = null;
            resolver(fontes.find((f) => f.id === id) ?? null);
            if (!janela.isDestroyed()) janela.close();
        };
        aberto = { janela, fontes: fontes.map(paraFonte), comAudio, responder };
        // fechou no X: é o mesmo que cancelar
        janela.on("closed", () => responder(null));
        janela.once("ready-to-show", () => janela.show());
        void janela.loadFile(path.join(__dirname, "seletor.html"));
    });
}

export function configurarSeletorTela(principal: () => BrowserWindow | null) {
    ipcMain.handle(CANAIS.fontes, (e) => {
        if (!aberto || e.sender !== aberto.janela.webContents) return { fontes: [], comAudio: false };
        return { fontes: aberto.fontes, comAudio: aberto.comAudio };
    });
    ipcMain.on(CANAIS.escolher, (e, id: unknown) => {
        if (!aberto || e.sender !== aberto.janela.webContents) return;
        aberto.responder(typeof id === "string" ? id : null);
    });

    session.defaultSession.setDisplayMediaRequestHandler(
        async (pedido, responder) => {
            const pai = principal();
            if (!pai || aberto || !ehDoSite(pedido.frame?.url ?? pedido.securityOrigin)) return responder(null);
            try {
                const fontes = await desktopCapturer.getSources({
                    types: ["screen", "window"],
                    thumbnailSize: { width: 400, height: 225 },
                    fetchWindowIcons: true,
                });
                if (fontes.length === 0) return responder(null);
                const comAudio = pedido.audioRequested && AUDIO_DO_SISTEMA;
                const escolhida = WAYLAND && fontes.length === 1 ? fontes[0] : await escolherFonte(pai, fontes, comAudio);
                if (!escolhida) return responder(null);
                responder({ video: escolhida, audio: comAudio ? "loopback" : undefined });
            } catch (err) {
                console.error("[tela] não deu pra listar as fontes", err);
                responder(null);
            }
        },
        { useSystemPicker: true },
    );
}
