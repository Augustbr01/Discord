// ícone na bandeja (fechar a janela deixa o app rodando, com a chamada junto), contador de não
// lidas no ícone do app e o estado do microfone/áudio pra alternar sem abrir a janela
import { app, BrowserWindow, Menu, nativeImage, Tray, type MenuItemConstructorOptions } from "electron";
import path from "node:path";
import type { Atalho, EstadoVoz } from "./canais";
import { ASSETS } from "./config";
import { definirInicioAutomatico, inicioAutomaticoLigado } from "./inicioAutomatico";

type Acoes = {
    mostrar: () => void;
    sair: () => void;
    atalho: (atalho: Atalho) => void;
};

const MAC = process.platform === "darwin";
const imagem = (nome: string) => nativeImage.createFromPath(path.join(ASSETS, nome));

let bandeja: Tray | null = null;
let janela: BrowserWindow | null = null;
let acoes: Acoes | null = null;
let naoLidos = 0;
let voz: EstadoVoz = { conectado: false, mic: false, surdo: false };

function iconeBandeja() {
    // macOS: imagem "template" (preta com transparência), o sistema pinta conforme o tema
    if (MAC) {
        const i = imagem("bandejaTemplate.png");
        i.setTemplateImage(true);
        return i;
    }
    return imagem(naoLidos > 0 ? "bandeja-aviso.png" : "bandeja.png");
}

function montarMenu() {
    if (!bandeja || !acoes) return;
    const a = acoes;
    const itens: MenuItemConstructorOptions[] = [
        { label: "Abrir o Liberdade", click: a.mostrar },
        { type: "separator" },
    ];
    if (voz.conectado) {
        itens.push(
            { label: "Microfone", type: "checkbox", checked: voz.mic, accelerator: "CommandOrControl+Shift+M", click: () => a.atalho("mic") },
            { label: "Áudio", type: "checkbox", checked: !voz.surdo, accelerator: "CommandOrControl+Shift+D", click: () => a.atalho("surdo") },
            { type: "separator" },
        );
    }
    itens.push(
        {
            label: "Abrir ao iniciar o sistema",
            type: "checkbox",
            checked: inicioAutomaticoLigado(),
            click: (item) => definirInicioAutomatico(item.checked),
        },
        { type: "separator" },
        { label: "Sair", click: a.sair },
    );
    // no Linux (AppIndicator) o menu só muda se for trocado inteiro
    bandeja.setContextMenu(Menu.buildFromTemplate(itens));
    bandeja.setToolTip(naoLidos > 0 ? `Liberdade (${naoLidos} não lidas)` : "Liberdade");
}

export function criarBandeja(principal: BrowserWindow, novasAcoes: Acoes) {
    janela = principal;
    acoes = novasAcoes;
    bandeja = new Tray(iconeBandeja());
    // Windows e Linux: clicar no ícone abre a janela (no macOS o clique abre o menu)
    if (!MAC) bandeja.on("click", novasAcoes.mostrar);
    montarMenu();
    // voltou pra janela: para de piscar na barra de tarefas
    principal.on("focus", () => principal.flashFrame(false));
}

export function definirNaoLidos(total: number) {
    const anterior = naoLidos;
    naoLidos = total;
    // dock do macOS e lançadores do Linux que mostram contador (Unity, KDE, Dash to Dock)
    app.setBadgeCount(total);
    if (process.platform === "win32" && janela) {
        janela.setOverlayIcon(total > 0 ? imagem("ponto.png") : null, total > 0 ? `${total} não lidas` : "");
    }
    // chegou mensagem com a janela em segundo plano: chama atenção sem roubar o foco
    if (total > anterior && janela && !janela.isFocused()) {
        if (MAC) app.dock?.bounce("informational");
        else janela.flashFrame(true);
    }
    bandeja?.setImage(iconeBandeja());
    montarMenu();
}

export function definirVoz(estado: EstadoVoz) {
    voz = estado;
    montarMenu();
}
