// Texturas desenhadas num <canvas> na hora: nada de arquivo pra baixar.
// As que não dependem de texto ficam em cache (uma só pra cena inteira).
import * as THREE from "three";

export const FONTE = '"Inter Variable", "Inter", system-ui, sans-serif';

// número pseudoaleatório estável: a mesma semente sempre desenha a mesma textura
function sorteio(semente: number) {
    let s = semente >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function tela(largura: number, altura: number) {
    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    return { canvas, ctx: canvas.getContext("2d")! };
}

function virarTextura(canvas: HTMLCanvasElement, repetir = false) {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}

const cache = new Map<string, THREE.Texture>();

function emCache(chave: string, criar: () => THREE.Texture) {
    let t = cache.get(chave);
    if (!t) {
        t = criar();
        cache.set(chave, t);
    }
    return t;
}

// a mesma imagem com outra repetição (pra cobrir pisos de tamanhos diferentes)
export function repetida(base: THREE.Texture, rx: number, rz: number) {
    const t = base.clone();
    t.repeat.set(rx, rz);
    t.needsUpdate = true;
    return t;
}

// tábuas de madeira: cada tábua com um tom um pouco diferente e veios finos
export function texturaMadeira() {
    return emCache("madeira", () => {
        const { canvas, ctx } = tela(1024, 1024);
        const r = sorteio(7);
        const tabuas = 8;
        const h = canvas.height / tabuas;
        for (let i = 0; i < tabuas; i++) {
            let x = -r() * 400;
            while (x < canvas.width) {
                const comp = 300 + r() * 380;
                const l = 30 + r() * 9;
                ctx.fillStyle = `hsl(${26 + r() * 6}, ${34 + r() * 10}%, ${l}%)`;
                ctx.fillRect(x, i * h, comp, h);
                for (let v = 0; v < 14; v++) {
                    ctx.strokeStyle = `rgba(30, 18, 10, ${0.05 + r() * 0.08})`;
                    ctx.lineWidth = 1 + r() * 2;
                    const y = i * h + r() * h;
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.bezierCurveTo(x + comp * 0.3, y + (r() - 0.5) * 10, x + comp * 0.7, y + (r() - 0.5) * 10, x + comp, y);
                    ctx.stroke();
                }
                ctx.fillStyle = "rgba(15, 9, 5, 0.55)";
                ctx.fillRect(x, i * h, 2, h);
                x += comp;
            }
            ctx.fillStyle = "rgba(15, 9, 5, 0.6)";
            ctx.fillRect(0, i * h, canvas.width, 2);
        }
        return virarTextura(canvas, true);
    });
}

// granilite: fundo claro com pedrinhas de várias cores
export function texturaPiso() {
    return emCache("piso", () => {
        const { canvas, ctx } = tela(1024, 1024);
        const r = sorteio(11);
        ctx.fillStyle = "#b9b4ad";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const cores = ["#8f8a83", "#d8d3cc", "#6f6a64", "#a3907c", "#c9c2b8", "#5a5651"];
        for (let i = 0; i < 2600; i++) {
            ctx.fillStyle = cores[Math.floor(r() * cores.length)];
            ctx.globalAlpha = 0.5 + r() * 0.5;
            const x = r() * canvas.width;
            const y = r() * canvas.height;
            const t = 1 + r() * (r() > 0.92 ? 9 : 3.5);
            ctx.beginPath();
            ctx.ellipse(x, y, t, t * (0.6 + r() * 0.4), r() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        // juntas das placas
        ctx.strokeStyle = "rgba(60, 56, 52, 0.35)";
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
        return virarTextura(canvas, true);
    });
}

// carpete: trama fina em cinza médio (a cor vem do material)
export function texturaCarpete() {
    return emCache("carpete", () => {
        const { canvas, ctx } = tela(256, 256);
        const r = sorteio(3);
        ctx.fillStyle = "#8c8a88";
        ctx.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 5000; i++) {
            ctx.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.12)";
            ctx.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1);
        }
        return virarTextura(canvas, true);
    });
}

// ripado acústico vertical em grafite (paredes de destaque do hall)
export function texturaRipado() {
    return emCache("ripado", () => {
        const { canvas, ctx } = tela(512, 256);
        const r = sorteio(5);
        ctx.fillStyle = "#08080a";
        ctx.fillRect(0, 0, 512, 256);
        const ripas = 16;
        const passo = 512 / ripas;
        for (let i = 0; i < ripas; i++) {
            ctx.fillStyle = `hsl(240, 8%, ${10 + r() * 2}%)`;
            ctx.fillRect(i * passo + passo * 0.18, 0, passo * 0.64, 256);
        }
        return virarTextura(canvas, true);
    });
}

// piso escuro semibrilho em placas grandes (hall, corredor e salas). A cor fina vem do material
export function texturaPisoEscuro() {
    return emCache("piso-escuro", () => {
        const { canvas, ctx } = tela(512, 512);
        const r = sorteio(19);
        ctx.fillStyle = "#c8c8cc";
        ctx.fillRect(0, 0, 512, 512);
        // variação leve de tom entre as placas (2 × 2 por repetição)
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 2; j++) {
                ctx.fillStyle = `rgba(0, 0, 0, ${0.04 + r() * 0.08})`;
                ctx.fillRect(i * 256, j * 256, 256, 256);
            }
        }
        for (let i = 0; i < 3000; i++) {
            ctx.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.07)";
            ctx.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2);
        }
        // juntas
        ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
        ctx.fillRect(0, 0, 512, 2);
        ctx.fillRect(0, 256, 512, 2);
        ctx.fillRect(0, 0, 2, 512);
        ctx.fillRect(256, 0, 2, 512);
        return virarTextura(canvas, true);
    });
}

// máscara (alphaMap) do brilho dos LEDs: some suave nas bordas, nunca um retângulo duro
export function texturaBrilho() {
    return emCache("brilho", () => {
        const { canvas, ctx } = tela(256, 256);
        const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
        g.addColorStop(0, "#fff");
        g.addColorStop(0.45, "#888");
        g.addColorStop(1, "#000");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 256, 256);
        return new THREE.CanvasTexture(canvas);
    });
}

// máscara da luz da sanca lavando a parede: forte em cima, some pra baixo e nas pontas
export function texturaLavagem() {
    return emCache("lavagem", () => {
        const { canvas, ctx } = tela(256, 256);
        const v = ctx.createLinearGradient(0, 0, 0, 256);
        v.addColorStop(0, "#fff");
        v.addColorStop(0.25, "#777");
        v.addColorStop(1, "#000");
        ctx.fillStyle = v;
        ctx.fillRect(0, 0, 256, 256);
        // escurece as pontas
        const h = ctx.createLinearGradient(0, 0, 256, 0);
        h.addColorStop(0, "rgba(0,0,0,1)");
        h.addColorStop(0.06, "rgba(0,0,0,0)");
        h.addColorStop(0.94, "rgba(0,0,0,0)");
        h.addColorStop(1, "rgba(0,0,0,1)");
        ctx.fillStyle = h;
        ctx.fillRect(0, 0, 256, 256);
        return new THREE.CanvasTexture(canvas);
    });
}

// céu de estrelas (fibra ótica) pro teto do cinema: pontinhos de luz sobre fundo transparente
export function texturaEstrelas() {
    return emCache("estrelas", () => {
        const { canvas, ctx } = tela(1024, 1024);
        const r = sorteio(23);
        for (let i = 0; i < 520; i++) {
            const x = r() * 1024;
            const y = r() * 1024;
            const raio = 0.8 + r() * r() * 2.6;
            const g = ctx.createRadialGradient(x, y, 0, x, y, raio * 2.2);
            const fria = r() > 0.6;
            g.addColorStop(0, fria ? "rgba(200, 220, 255, 1)" : "rgba(255, 255, 255, 1)");
            g.addColorStop(1, "rgba(255, 255, 255, 0)");
            ctx.globalAlpha = 0.35 + r() * 0.65;
            ctx.fillStyle = g;
            ctx.fillRect(x - raio * 3, y - raio * 3, raio * 6, raio * 6);
        }
        ctx.globalAlpha = 1;
        return virarTextura(canvas, true);
    });
}

// mancha de luz no chão, embaixo das luminárias (luz "pintada", sem custo de luz de verdade)
export function texturaLuz() {
    return emCache("luz", () => {
        const { canvas, ctx } = tela(256, 256);
        const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
        g.addColorStop(0, "rgba(226, 232, 255, 0.5)");
        g.addColorStop(0.45, "rgba(214, 222, 255, 0.18)");
        g.addColorStop(1, "rgba(214, 222, 255, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 256, 256);
        return virarTextura(canvas);
    });
}

// sombra suave embaixo de cada boneco
export function texturaSombra() {
    return emCache("sombra", () => {
        const { canvas, ctx } = tela(128, 128);
        const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        g.addColorStop(0, "rgba(0, 0, 0, 0.55)");
        g.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 128, 128);
        return virarTextura(canvas);
    });
}

// a cidade à noite, vista pelas janelas
export function texturaCidade(semente = 1) {
    return emCache(`cidade-${semente}`, () => {
        const { canvas, ctx } = tela(2048, 768);
        const r = sorteio(semente * 97);
        const ceu = ctx.createLinearGradient(0, 0, 0, 768);
        ceu.addColorStop(0, "#05060c");
        ceu.addColorStop(0.55, "#12152a");
        ceu.addColorStop(0.82, "#3a2a3f");
        ceu.addColorStop(1, "#6b4a45");
        ctx.fillStyle = ceu;
        ctx.fillRect(0, 0, 2048, 768);

        for (let i = 0; i < 160; i++) {
            ctx.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.6})`;
            ctx.fillRect(r() * 2048, r() * 360, 1.5, 1.5);
        }

        // duas camadas de prédios: a do fundo mais apagada
        for (const camada of [0, 1]) {
            let x = -20;
            while (x < 2048) {
                const larg = 60 + r() * 140;
                const alt = (camada === 0 ? 220 : 120) + r() * (camada === 0 ? 300 : 360);
                const topo = 768 - alt;
                ctx.fillStyle = camada === 0 ? "#0d0f1a" : "#07080d";
                ctx.fillRect(x, topo, larg, alt);
                const passoX = 12 + Math.floor(r() * 6);
                const passoY = 16 + Math.floor(r() * 6);
                for (let wy = topo + 10; wy < 760; wy += passoY) {
                    for (let wx = x + 6; wx < x + larg - 8; wx += passoX) {
                        if (r() > (camada === 0 ? 0.78 : 0.66)) {
                            const quente = r() > 0.3;
                            ctx.fillStyle = quente
                                ? `rgba(255, ${190 + r() * 50}, ${110 + r() * 60}, ${camada === 0 ? 0.45 : 0.85})`
                                : `rgba(170, 200, 255, ${camada === 0 ? 0.35 : 0.7})`;
                            ctx.fillRect(wx, wy, passoX * 0.5, passoY * 0.45);
                        }
                    }
                }
                x += larg + r() * 10;
            }
        }
        return virarTextura(canvas);
    });
}

type OpcoesTexto = {
    largura?: number;
    altura?: number;
    fundo?: string | null;
    cor?: string;
    tamanho?: number;
    peso?: number;
    alinhar?: CanvasTextAlign;
    raio?: number;
};

// placa com texto. Cada linha pode ter tamanho/cor próprios
export type LinhaTexto = { texto: string; tamanho?: number; cor?: string; peso?: number };

export function texturaTexto(linhas: (string | LinhaTexto)[], opcoes: OpcoesTexto = {}) {
    const { largura = 1024, altura = 256, fundo = null, cor = "#ededef", tamanho = 72, peso = 600, alinhar = "center", raio = 0 } = opcoes;
    const { canvas, ctx } = tela(largura, altura);

    if (fundo) {
        ctx.fillStyle = fundo;
        ctx.beginPath();
        ctx.roundRect(0, 0, largura, altura, raio);
        ctx.fill();
    }

    const itens = linhas.map((l) => (typeof l === "string" ? { texto: l } : l));
    const alturas = itens.map((l) => (l.tamanho ?? tamanho) * 1.25);
    const total = alturas.reduce((a, b) => a + b, 0);
    let y = (altura - total) / 2;
    const x = alinhar === "center" ? largura / 2 : alinhar === "left" ? largura * 0.06 : largura * 0.94;

    ctx.textAlign = alinhar;
    ctx.textBaseline = "middle";
    itens.forEach((l, i) => {
        const t = l.tamanho ?? tamanho;
        ctx.font = `${l.peso ?? peso} ${t}px ${FONTE}`;
        ctx.fillStyle = l.cor ?? cor;
        let texto = l.texto;
        // corta com reticências o que não couber
        const maximo = largura * 0.88;
        if (ctx.measureText(texto).width > maximo) {
            while (texto.length > 1 && ctx.measureText(`${texto}…`).width > maximo) texto = texto.slice(0, -1);
            texto = `${texto}…`;
        }
        ctx.fillText(texto, x, y + alturas[i] / 2);
        y += alturas[i];
    });

    return { textura: virarTextura(canvas), aspecto: largura / altura };
}

// crachá com o nome em cima do boneco
export function texturaCracha(nome: string) {
    const tamanho = 44;
    const medir = tela(1, 1).ctx;
    medir.font = `600 ${tamanho}px ${FONTE}`;
    const largura = Math.min(720, Math.ceil(medir.measureText(nome).width) + 56);
    return texturaTexto([nome], { largura, altura: 76, fundo: "rgba(9, 9, 11, 0.72)", tamanho, raio: 38 });
}

// avatar sem foto (ou com foto que não carregou): iniciais num círculo
export function texturaIniciais(iniciais: string, fundo: string) {
    const { canvas, ctx } = tela(256, 256);
    ctx.fillStyle = fundo;
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = "#ededef";
    ctx.font = `600 100px ${FONTE}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(iniciais, 128, 136);
    return virarTextura(canvas);
}

// carrega as fontes antes de desenhar texto no canvas (senão sai na fonte padrão)
export function carregarFontes() {
    if (typeof document === "undefined" || !document.fonts) return Promise.resolve();
    return Promise.all([500, 600, 700].map((p) => document.fonts.load(`${p} 48px ${FONTE}`)))
        .then(() => undefined)
        .catch(() => undefined);
}
