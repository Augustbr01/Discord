// som da tela no Linux. O Chromium só captura o som do sistema no Windows, então aqui o venmic
// (o mesmo do Vesktop) cria no PipeWire um microfone virtual, "vencord-screen-share", e liga nele
// só o programa escolhido. O site pega esse microfone e junta com a tela (ver preload.ts).
// O som do próprio Liberdade nunca entra: senão os outros se ouviriam de volta
import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { CANAIS, type EscolhaAudio } from "./canais";
import { ehDoSite } from "./config";

type Venmic = typeof import("@vencord/venmic");
type No = Record<string, string>;

let venmic: InstanceType<Venmic["PatchBay"]> | null | undefined;

function patchBay() {
    if (venmic !== undefined) return venmic;
    venmic = null;
    if (process.platform !== "linux") return venmic;
    try {
        // fica fora do bundle (é binário nativo) e só existe no Linux
        const { PatchBay } = require("@vencord/venmic") as Venmic;
        if (PatchBay.hasPipeWire()) venmic = new PatchBay();
        else console.warn("[audio] sem PipeWire: a tela vai sem som");
    } catch (err) {
        console.error("[audio] não deu pra carregar o venmic", err);
    }
    return venmic;
}

export const audioDisponivel = () => patchBay() !== null;

// o processo que toca o som do Liberdade (as vozes da chamada)
function nosDoApp(): No[] {
    const pid = app.getAppMetrics().find((p) => p.name === "Audio Service")?.pid;
    return [{ "application.name": app.getName() }, ...(pid ? [{ "application.process.id": String(pid) }] : [])];
}
const ehDoApp = (no: No) => nosDoApp().some((n) => Object.entries(n).every(([k, v]) => no[k] === v));

const nomeDoNo = (no: No) => no["application.name"] || no["node.name"] || "";

// programas tocando som agora (cada um pode ter várias saídas: aparece uma vez)
function listarProgramas() {
    const nomes = new Set<string>();
    for (const no of patchBay()?.list() ?? []) {
        if (no["media.class"] !== "Stream/Output/Audio" || ehDoApp(no)) continue;
        const nome = nomeDoNo(no);
        if (nome) nomes.add(nome);
    }
    return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function ligar(escolha: EscolhaAudio) {
    const pb = patchBay();
    if (!pb || escolha.tipo === "nenhum") return false;
    // microfones e outras gravações não entram, nem o som do Liberdade
    const exclude: No[] = [...nosDoApp(), { "media.class": "Stream/Input/Audio" }];
    const include: No[] = escolha.tipo === "programa" ? [{ "application.name": escolha.nome }] : [];
    try {
        return pb.link({ include, exclude, ignore_devices: true, only_speakers: false, mute: false });
    } catch (err) {
        console.error("[audio] não deu pra ligar o microfone virtual", err);
        return false;
    }
}

export function pararAudio() {
    try {
        patchBay()?.unlink();
    } catch (err) {
        console.error("[audio] não deu pra desligar o microfone virtual", err);
    }
}

// a tela que está saindo agora leva o microfone virtual? O site pergunta uma vez, logo depois do getDisplayMedia
let entregar = false;
// o último programa escolhido já vem marcado da próxima vez
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
    pararAudio();
    entregar = false;
    const escolha = await perguntar(pai);
    if (escolha.tipo !== "nenhum") ultima = escolha;
    entregar = ligar(escolha);
}

function valida(escolha: unknown): EscolhaAudio {
    const e = escolha as Partial<{ tipo: string; nome: unknown }> | null;
    if (e?.tipo === "programa" && typeof e.nome === "string") return { tipo: "programa", nome: e.nome };
    if (e?.tipo === "tudo") return { tipo: "tudo" };
    return { tipo: "nenhum" };
}

export function configurarAudioTela() {
    ipcMain.handle(CANAIS.programas, (e) => {
        if (!aberto || e.sender !== aberto.janela.webContents) return { programas: [], ultima };
        return { programas: listarProgramas(), ultima };
    });
    ipcMain.on(CANAIS.escolherAudio, (e, escolha: unknown) => {
        if (!aberto || e.sender !== aberto.janela.webContents) return;
        aberto.responder(valida(escolha));
    });
    ipcMain.handle(CANAIS.audioDaTela, (e) => {
        if (!ehDoSite(e.senderFrame?.url)) return false;
        const sim = entregar;
        entregar = false;
        return sim;
    });
    ipcMain.on(CANAIS.pararAudio, (e) => {
        if (ehDoSite(e.senderFrame?.url)) pararAudio();
    });
    app.on("will-quit", pararAudio);
}
