// a janela principal: abre o site, lembra tamanho e posição, e decide o que abre aqui dentro
// (o site e o login do Discord) e o que vai pro navegador (qualquer outro link)
import { app, BrowserWindow, clipboard, Menu, screen, shell, type MenuItemConstructorOptions } from "electron";
import fs from "node:fs";
import path from "node:path";
import { ASSETS, ehDoSite } from "./config";

type Estado = { x?: number; y?: number; largura: number; altura: number; maximizada: boolean };
const PADRAO: Estado = { largura: 1400, altura: 900, maximizada: false };

const arquivoEstado = () => path.join(app.getPath("userData"), "janela.json");

function lerEstado(): Estado {
    try {
        const e = { ...PADRAO, ...JSON.parse(fs.readFileSync(arquivoEstado(), "utf8")) } as Estado;
        // o monitor onde ela estava pode ter sido desligado: aí abre centralizada no principal
        if (e.x !== undefined && e.y !== undefined) {
            const { x, y } = e;
            const visivel = screen.getAllDisplays().some(({ workArea: a }) =>
                x < a.x + a.width - 100 && x + e.largura > a.x + 100 && y >= a.y && y < a.y + a.height - 100);
            if (!visivel) return { ...e, x: undefined, y: undefined };
        }
        return e;
    } catch {
        return PADRAO;
    }
}

function salvarEstado(janela: BrowserWindow) {
    if (janela.isDestroyed() || janela.isMinimized() || janela.isFullScreen()) return;
    const { x, y, width, height } = janela.getNormalBounds();
    const estado: Estado = { x, y, largura: width, altura: height, maximizada: janela.isMaximized() };
    try {
        fs.writeFileSync(arquivoEstado(), JSON.stringify(estado));
    } catch (err) {
        console.error("[janela] não deu pra salvar o tamanho", err);
    }
}

// o login acontece dentro da janela (o cookie fica no app), então o Discord pode abrir aqui
const DISCORD = new Set(["discord.com", "www.discord.com", "canary.discord.com", "ptb.discord.com"]);
function podeAbrirAqui(url: string) {
    if (ehDoSite(url)) return true;
    try {
        const u = new URL(url);
        return u.protocol === "https:" && DISCORD.has(u.hostname);
    } catch {
        return false;
    }
}

export function abrirNoNavegador(url: string) {
    try {
        const { protocol } = new URL(url);
        if (protocol === "https:" || protocol === "http:" || protocol === "mailto:") void shell.openExternal(url);
    } catch {
        // endereço inválido: ignora
    }
}

// botão direito: o Electron não tem menu nenhum por padrão (nem copiar/colar)
function menuDeContexto(janela: BrowserWindow) {
    janela.webContents.on("context-menu", (_e, p) => {
        const itens: MenuItemConstructorOptions[] = [];
        for (const sugestao of p.dictionarySuggestions.slice(0, 5)) {
            itens.push({ label: sugestao, click: () => janela.webContents.replaceMisspelling(sugestao) });
        }
        if (p.misspelledWord) {
            itens.push(
                { label: "Adicionar ao dicionário", click: () => janela.webContents.session.addWordToSpellCheckerDictionary(p.misspelledWord) },
                { type: "separator" },
            );
        }
        if (p.linkURL) {
            itens.push(
                { label: "Abrir link no navegador", click: () => abrirNoNavegador(p.linkURL) },
                { label: "Copiar link", click: () => clipboard.writeText(p.linkURL) },
                { type: "separator" },
            );
        }
        if (p.mediaType === "image" && p.srcURL) {
            itens.push(
                { label: "Copiar imagem", click: () => janela.webContents.copyImageAt(p.x, p.y) },
                { label: "Salvar imagem como…", click: () => janela.webContents.downloadURL(p.srcURL) },
                { type: "separator" },
            );
        }
        if (p.isEditable) {
            itens.push(
                { role: "cut", label: "Recortar", enabled: p.editFlags.canCut },
                { role: "copy", label: "Copiar", enabled: p.editFlags.canCopy },
                { role: "paste", label: "Colar", enabled: p.editFlags.canPaste },
                { role: "selectAll", label: "Selecionar tudo" },
            );
        } else if (p.selectionText.trim()) {
            itens.push({ role: "copy", label: "Copiar" });
        }
        while (itens.at(-1)?.type === "separator") itens.pop();
        if (itens.length > 0) Menu.buildFromTemplate(itens).popup({ window: janela });
    });
}

export function criarJanela(inicial: string, oculta: boolean) {
    const estado = lerEstado();
    const janela = new BrowserWindow({
        x: estado.x,
        y: estado.y,
        width: estado.largura,
        height: estado.altura,
        minWidth: 940,
        minHeight: 560,
        show: false,
        title: "Liberdade",
        backgroundColor: "#09090b",
        // Windows e macOS pegam o ícone do executável; no Linux precisa dizer
        icon: process.platform === "linux" ? path.join(ASSETS, "icone.png") : undefined,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
            spellcheck: true,
        },
    });
    // macOS usa o corretor do sistema; nos outros, português
    if (process.platform !== "darwin") janela.webContents.session.setSpellCheckerLanguages(["pt-BR", "en-US"]);

    janela.once("ready-to-show", () => {
        if (estado.maximizada) janela.maximize();
        if (!oculta) janela.show();
    });

    let salvar: NodeJS.Timeout | undefined;
    const salvarDepois = () => {
        clearTimeout(salvar);
        salvar = setTimeout(() => salvarEstado(janela), 500);
    };
    janela.on("resize", salvarDepois);
    janela.on("move", salvarDepois);
    janela.on("close", () => salvarEstado(janela));

    // links com target=_blank e window.open: sempre no navegador
    janela.webContents.setWindowOpenHandler(({ url }) => {
        abrirNoNavegador(url);
        return { action: "deny" };
    });
    janela.webContents.on("will-navigate", (e) => {
        if (podeAbrirAqui(e.url)) return;
        e.preventDefault();
        abrirNoNavegador(e.url);
    });

    // sem internet ou servidor fora: página de "sem conexão" que tenta de novo sozinha
    janela.webContents.on("did-fail-load", (_e, codigo, _descricao, url, principal) => {
        // -3 = ABORTED: a navegação só foi trocada por outra
        if (!principal || codigo === -3 || !ehDoSite(url)) return;
        void janela.loadFile(path.join(__dirname, "offline.html"), { query: { site: url } });
    });

    menuDeContexto(janela);
    void janela.loadURL(inicial);
    return janela;
}
