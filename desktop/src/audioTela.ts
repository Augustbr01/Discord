// som junto com a tela, de um programa só. O Chromium só captura o som do computador inteiro (e só
// no Windows), com as vozes da chamada junto: os outros se ouviriam de volta. Aqui você escolhe o
// programa e cada sistema captura do seu jeito (somLinux.ts, somWindows.ts); o preload junta o som
// na tela que o site recebe. O som do próprio Liberdade nunca entra
import { app, BrowserWindow, ipcMain, type WebContents } from "electron";
import path from "node:path";
import { CANAIS, type EscolhaAudio, type ModoAudio } from "./canais";
import { ehDoSite } from "./config";
import { somLinux } from "./somLinux";
import { somWindows } from "./somWindows";

const sistema = process.platform === "linux" ? somLinux : process.platform === "win32" ? somWindows : null;

// macOS: o som vem pelo próprio seletor do sistema
export const audioDisponivel = () => sistema?.disponivel() ?? false;

export function pararAudio() {
    sistema?.parar();
}

// a tela que está saindo agora leva som? O site pergunta uma vez, logo depois do getDisplayMedia
let entregar: ModoAudio | null = null;
// a última escolha já vem marcada da próxima vez (pelo nome: no Windows o pid muda)
let ultima: EscolhaAudio = { tipo: "tudo" };

let aberto: { janela: BrowserWindow; responder: (escolha: EscolhaAudio) => void } | null = null;

function perguntar(pai: BrowserWindow) {
    return new Promise<EscolhaAudio>((resolver) => {
        const janela = new BrowserWindow({
            parent: pai,
            modal: true,
            width: 440,
            height: 520,
            minWidth: 360,
            minHeight: 380,
            show: false,
            title: "Som da tela",
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
        const responder = (escolha: EscolhaAudio) => {
            if (respondido) return;
            respondido = true;
            aberto = null;
            resolver(escolha);
            if (!janela.isDestroyed()) janela.close();
        };
        aberto = { janela, responder };
        // fechou no X: a tela vai sem som
        janela.on("closed", () => responder({ tipo: "nenhum" }));
        janela.once("ready-to-show", () => janela.show());
        void janela.loadFile(path.join(__dirname, "seletorAudio.html"));
    });
}

// chamado pelo seletorTela depois de escolher a tela, quando o site pediu som
export async function escolherAudio(pai: BrowserWindow) {
    if (!sistema) return;
    pararAudio();
    entregar = null;
    const escolha = await perguntar(pai);
    if (escolha.tipo !== "nenhum") ultima = escolha;
    if (await sistema.ligar(escolha, pai.webContents)) entregar = sistema.modo;
}

function valida(escolha: unknown): EscolhaAudio {
    const e = escolha as Partial<{ tipo: string; id: unknown; nome: unknown }> | null;
    if (e?.tipo === "programa" && typeof e.id === "string" && typeof e.nome === "string") return { tipo: "programa", id: e.id, nome: e.nome };
    if (e?.tipo === "tudo" && sistema?.podeTudo) return { tipo: "tudo" };
    return { tipo: "nenhum" };
}

const doSeletor = (wc: WebContents) => !!aberto && wc === aberto.janela.webContents;

export function configurarAudioTela() {
    ipcMain.handle(CANAIS.programas, async (e) => {
        const base = { ultima, podeTudo: sistema?.podeTudo ?? false, rotulo: sistema?.rotulo ?? "" };
        if (!sistema || !doSeletor(e.sender)) return { ...base, programas: [] };
        return { ...base, programas: await sistema.listar() };
    });
    ipcMain.on(CANAIS.escolherAudio, (e, escolha: unknown) => {
        if (doSeletor(e.sender)) aberto?.responder(valida(escolha));
    });
    ipcMain.handle(CANAIS.audioDaTela, (e) => {
        if (!ehDoSite(e.senderFrame?.url)) return null;
        const modo = entregar;
        entregar = null;
        return modo;
    });
    ipcMain.on(CANAIS.pararAudio, (e) => {
        if (ehDoSite(e.senderFrame?.url)) pararAudio();
    });
    app.on("will-quit", pararAudio);
}
