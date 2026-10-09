// app desktop do Liberdade: uma janela com o site dentro, mais o que só um app consegue
// (bandeja, atalhos globais, contador no ícone, seletor de tela, links liberdade://, abrir com o sistema)
import { app, BrowserWindow, ipcMain, Menu, session, type IpcMainEvent, type MenuItemConstructorOptions } from "electron";
import { liberarAtalhos, registrarAtalhos } from "./atalhos";
import { configurarAudioTela } from "./audioTela";
import { criarBandeja, definirNaoLidos, definirVoz } from "./bandeja";
import { CANAIS, type Atalho } from "./canais";
import { ehDoSite, ID_APP, PROTOCOLO, SITE } from "./config";
import { abriuOculto } from "./inicioAutomatico";
import { criarJanela } from "./janela";
import { configurarSeletorTela } from "./seletorTela";

// Wayland: atalho global só pelo portal do sistema
if (process.platform === "linux") app.commandLine.appendSwitch("enable-features", "GlobalShortcutsPortal");
// user-agent de Chrome comum: com "Electron/" nele, o login do Discord acha que está no app
// desktop do próprio Discord e tenta usar as APIs nativas dele
app.userAgentFallback = app.userAgentFallback.replace(/ (Electron|liberdade-desktop|Liberdade)\/\S+/g, "");
// Windows: sem isso as notificações e o ícone na barra de tarefas saem com o nome do electron.exe
if (process.platform === "win32") app.setAppUserModelId(ID_APP);

let janela: BrowserWindow | null = null;
let saindo = false;
// link liberdade:// que chegou antes da janela existir (no macOS o open-url vem antes do ready)
let linkPendente: string | null = null;

// liberdade://convite/<id> → a página de convite do site (ela guarda o convite e entra no servidor)
function enderecoDoLink(link: string) {
    try {
        const u = new URL(link);
        const id = u.pathname.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
        if (u.protocol === `${PROTOCOLO}:` && u.hostname === "convite" && id) return `${SITE}/convite/${id}`;
    } catch {
        // link quebrado: ignora
    }
    return null;
}

const linkNosArgs = (argv: string[]) => argv.find((a) => a.startsWith(`${PROTOCOLO}://`)) ?? null;

function mostrar() {
    if (!janela) return;
    if (janela.isMinimized()) janela.restore();
    janela.show();
    janela.focus();
}

function abrirLink(link: string | null) {
    const endereco = link && enderecoDoLink(link);
    if (!endereco) return;
    if (!janela) {
        linkPendente = link;
        return;
    }
    void janela.loadURL(endereco);
    mostrar();
}

function sair() {
    saindo = true;
    app.quit();
}

function dispararAtalho(atalho: Atalho) {
    janela?.webContents.send(CANAIS.atalho, atalho);
}

// o mínimo pra copiar/colar, recarregar e zoom funcionarem (no Windows/Linux fica escondido, aparece no Alt)
function montarMenuDoApp() {
    const mac = process.platform === "darwin";
    const modelo: MenuItemConstructorOptions[] = [
        ...(mac ? [{ role: "appMenu" as const }] : [{ label: "Liberdade", submenu: [{ label: "Sair", accelerator: "Ctrl+Q", click: sair }] }]),
        {
            label: "Editar",
            submenu: [
                { role: "undo", label: "Desfazer" },
                { role: "redo", label: "Refazer" },
                { type: "separator" },
                { role: "cut", label: "Recortar" },
                { role: "copy", label: "Copiar" },
                { role: "paste", label: "Colar" },
                { role: "selectAll", label: "Selecionar tudo" },
            ],
        },
        {
            label: "Exibir",
            submenu: [
                { role: "reload", label: "Recarregar" },
                { role: "toggleDevTools", label: "Ferramentas do desenvolvedor" },
                { type: "separator" },
                { role: "resetZoom", label: "Tamanho original" },
                { role: "zoomIn", label: "Aumentar" },
                { role: "zoomOut", label: "Diminuir" },
                { type: "separator" },
                { role: "togglefullscreen", label: "Tela cheia" },
            ],
        },
        ...(mac ? [{ role: "windowMenu" as const }] : []),
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(modelo));
}

// o que o site pode pedir: microfone/câmera, travar o mouse (mundo 3D), tela cheia, notificação
// e copiar (link de convite). Só o site: o login do Discord e iframes de fora não pedem nada.
// Tela cheia e copiar valem pra qualquer um (o player do YouTube usa)
const PERMISSOES_DO_SITE = new Set(["media", "display-capture", "pointerLock", "keyboardLock", "notifications", "speaker-selection", "screen-wake-lock"]);
const PERMISSOES_DE_TODOS = new Set(["fullscreen", "clipboard-sanitized-write"]);
const permitida = (permissao: string, origem: string | undefined) =>
    PERMISSOES_DE_TODOS.has(permissao) || (PERMISSOES_DO_SITE.has(permissao) && ehDoSite(origem));

function configurarPermissoes() {
    session.defaultSession.setPermissionRequestHandler((wc, permissao, responder, detalhes) =>
        responder(permitida(permissao, detalhes.requestingUrl || wc.getURL())));
    session.defaultSession.setPermissionCheckHandler((_wc, permissao, origem) => permitida(permissao, origem));
}

// mensagens do site: só valem se vierem do site (não do login do Discord, que roda na mesma janela)
function doSite(e: IpcMainEvent) {
    return ehDoSite(e.senderFrame?.url);
}

function configurarPonte() {
    ipcMain.on(CANAIS.naoLidos, (e, total: unknown) => {
        if (!doSite(e) || typeof total !== "number" || !Number.isFinite(total)) return;
        definirNaoLidos(Math.max(0, Math.floor(total)));
    });
    ipcMain.on(CANAIS.voz, (e, estado: unknown) => {
        if (!doSite(e) || typeof estado !== "object" || !estado) return;
        const { conectado, mic, surdo } = estado as Record<string, unknown>;
        definirVoz({ conectado: conectado === true, mic: mic === true, surdo: surdo === true });
    });
}

function iniciar() {
    // links liberdade://: no Windows e no Linux chegam como argumento (aqui ou numa segunda instância),
    // no macOS pelo open-url
    if (app.isPackaged) app.setAsDefaultProtocolClient(PROTOCOLO);
    linkPendente = linkNosArgs(process.argv);
    app.on("open-url", (e, link) => {
        e.preventDefault();
        abrirLink(link);
    });
    // abriu de novo (atalho, link de convite): traz a que já está aberta
    app.on("second-instance", (_e, argv) => {
        mostrar();
        abrirLink(linkNosArgs(argv));
    });

    app.whenReady().then(() => {
        montarMenuDoApp();
        configurarPermissoes();
        configurarPonte();
        configurarSeletorTela(() => janela);
        configurarAudioTela();

        const inicial = (linkPendente && enderecoDoLink(linkPendente)) ?? SITE;
        linkPendente = null;
        janela = criarJanela(inicial, abriuOculto());

        // fechar a janela só esconde: a chamada continua e o app fica na bandeja
        janela.on("close", (e) => {
            if (saindo) return;
            e.preventDefault();
            janela?.hide();
        });

        criarBandeja(janela, { mostrar, sair, atalho: dispararAtalho });
        registrarAtalhos(dispararAtalho);
    });

    // macOS: clicar no ícone do dock com a janela escondida
    app.on("activate", mostrar);
    // Cmd+Q, "Sair" da bandeja, desligar o computador: aí fecha de verdade
    app.on("before-quit", () => {
        saindo = true;
    });
    app.on("will-quit", liberarAtalhos);
}

// uma instância só: a segunda avisa a primeira (second-instance) e fecha
if (app.requestSingleInstanceLock()) iniciar();
else app.quit();
