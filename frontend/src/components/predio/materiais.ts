// Cores do prédio (as mesmas do app) e os textos 3D desenhados em canvas, com as fontes do app.
import { CanvasTexture, SRGBColorSpace } from "three";
import { iniciais, matiz } from "../../lib/util";

export const COR = {
    casca: "#012329",
    cascaFunda: "#00191e",
    piso: "#0b2f36",
    pisoSala: "#0e353c",
    parede: "#1c3136",
    paredeSala: "#20383d",
    teto: "#06262c",
    moldura: "#2b4045",
    vidro: "#8fd6dc",
    elevador: "#3a5257",
    portaElevador: "#9fb3b6",
    cadeira: "#2c454a",
    tapete: "#5a3f1a",
    luz: "#ffe1ad",
    manga: "#ffb846",
    texto: "#f4f0e7",
    texto2: "#b6c8cb",
    texto3: "#8da3a7",
};

const FONTE_TITULO = '"Bricolage Grotesque Variable", "Onest Variable", system-ui, sans-serif';
const FONTE = '"Onest Variable", system-ui, sans-serif';

// OKLCH → hex (o mesmo espaço de cor do CSS, pra pessoa ter o mesmo tom no 2D e no 3D)
export function oklchHex(l: number, c: number, h: number) {
    const a = c * Math.cos((h * Math.PI) / 180);
    const b = c * Math.sin((h * Math.PI) / 180);
    const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const linear = [
        4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
        -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
        -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
    ];
    return (
        "#" +
        linear
            .map((v) => {
                const x = Math.min(1, Math.max(0, v));
                const srgb = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
                return Math.round(srgb * 255).toString(16).padStart(2, "0");
            })
            .join("")
    );
}

export function coresPessoa(nome: string) {
    const h = matiz(nome);
    return { corpo: oklchHex(0.5, 0.1, h), cabeca: oklchHex(0.78, 0.07, h), avatar: oklchHex(0.46, 0.09, h) };
}

function textura(largura: number, altura: number, desenhar: (ctx: CanvasRenderingContext2D) => void) {
    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext("2d")!;
    desenhar(ctx);
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    return t;
}

function caixaArredondada(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
}

function cortar(ctx: CanvasRenderingContext2D, texto: string, max: number) {
    if (ctx.measureText(texto).width <= max) return texto;
    let t = texto;
    while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
    return `${t}…`;
}

// etiqueta com o nome em cima da cabeça
export function texturaNome(nome: string, falando: boolean) {
    return textura(512, 128, (ctx) => {
        ctx.font = `600 44px ${FONTE}`;
        const texto = cortar(ctx, nome, 360);
        const w = Math.min(500, ctx.measureText(texto).width + 140);
        const x = (512 - w) / 2;
        caixaArredondada(ctx, x, 14, w, 100, 50);
        ctx.fillStyle = falando ? COR.manga : "rgba(0, 25, 30, 0.86)";
        ctx.fill();
        ctx.fillStyle = coresPessoa(nome).avatar;
        ctx.beginPath();
        ctx.arc(x + 52, 64, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = COR.texto;
        ctx.font = `700 26px ${FONTE}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(iniciais(nome), x + 52, 66);
        ctx.textAlign = "left";
        ctx.font = `600 44px ${FONTE}`;
        ctx.fillStyle = falando ? "#331b06" : COR.texto;
        ctx.fillText(texto, x + 100, 66);
    });
}

// placa em cima da porta de cada sala
export function texturaPlaca(nome: string, pessoas: number, voceAqui: boolean) {
    return textura(1024, 320, (ctx) => {
        caixaArredondada(ctx, 8, 8, 1008, 304, 40);
        ctx.fillStyle = COR.cascaFunda;
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = pessoas > 0 ? COR.manga : COR.moldura;
        ctx.stroke();
        ctx.fillStyle = COR.texto;
        ctx.font = `700 120px ${FONTE_TITULO}`;
        ctx.textBaseline = "alphabetic";
        ctx.fillText(cortar(ctx, nome, 920), 56, 160);
        ctx.font = `600 64px ${FONTE}`;
        ctx.fillStyle = pessoas > 0 ? COR.manga : COR.texto3;
        const rotulo = voceAqui ? "Você está aqui" : pessoas === 0 ? "Vazia, pode entrar" : pessoas === 1 ? "1 pessoa" : `${pessoas} pessoas`;
        ctx.fillText(rotulo, 56, 262);
    });
}

// um canal de texto no mural
export function texturaMural(nome: string, destacado: boolean) {
    return textura(512, 360, (ctx) => {
        caixaArredondada(ctx, 6, 6, 500, 348, 36);
        ctx.fillStyle = destacado ? COR.manga : "#e9e3d6";
        ctx.fill();
        ctx.fillStyle = destacado ? "#331b06" : "#012329";
        ctx.font = `700 54px ${FONTE_TITULO}`;
        ctx.fillText("#", 40, 96);
        ctx.font = `700 58px ${FONTE_TITULO}`;
        ctx.fillText(cortar(ctx, nome, 400), 82, 96);
        ctx.font = `500 34px ${FONTE}`;
        ctx.fillStyle = destacado ? "#331b06" : "#38555b";
        ctx.fillText(destacado ? "Abrir conversa (E)" : "Canal de texto", 40, 300);
    });
}

// quadro do andar, na parede em frente ao mural
export function texturaQuadro(andar: number, servidor: string, salas: { nome: string; pessoas: number }[]) {
    return textura(1024, 1024, (ctx) => {
        caixaArredondada(ctx, 8, 8, 1008, 1008, 48);
        ctx.fillStyle = COR.cascaFunda;
        ctx.fill();
        ctx.fillStyle = COR.manga;
        ctx.font = `700 64px ${FONTE}`;
        ctx.fillText(`${andar}º andar`, 64, 130);
        ctx.fillStyle = COR.texto;
        ctx.font = `700 104px ${FONTE_TITULO}`;
        ctx.fillText(cortar(ctx, servidor, 900), 64, 250);
        ctx.font = `600 46px ${FONTE}`;
        ctx.fillStyle = COR.texto3;
        ctx.fillText("Salas deste andar", 64, 360);
        salas.slice(0, 8).forEach((s, i) => {
            const y = 450 + i * 74;
            ctx.fillStyle = COR.texto;
            ctx.font = `600 52px ${FONTE}`;
            ctx.fillText(cortar(ctx, s.nome, 640), 64, y);
            ctx.fillStyle = s.pessoas > 0 ? COR.manga : COR.texto3;
            ctx.textAlign = "right";
            ctx.fillText(s.pessoas > 0 ? `${s.pessoas}` : "vazia", 960, y);
            ctx.textAlign = "left";
        });
    });
}

// texto solto numa parede (ex.: título do mural)
export function texturaRotulo(texto: string) {
    return textura(1024, 160, (ctx) => {
        ctx.fillStyle = COR.texto2;
        ctx.font = `700 92px ${FONTE_TITULO}`;
        ctx.textBaseline = "middle";
        ctx.fillText(cortar(ctx, texto, 1000), 8, 84);
    });
}

// painel de botões dentro do elevador
export function texturaPainelElevador(andar: number) {
    return textura(256, 512, (ctx) => {
        caixaArredondada(ctx, 8, 8, 240, 496, 28);
        ctx.fillStyle = "#1a2a2d";
        ctx.fill();
        ctx.fillStyle = COR.manga;
        ctx.font = `700 88px ${FONTE_TITULO}`;
        ctx.textAlign = "center";
        ctx.fillText(String(andar), 128, 130);
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.arc(128, 230 + i * 70, 24, 0, Math.PI * 2);
            ctx.fillStyle = i === 0 ? COR.manga : "#3a5257";
            ctx.fill();
        }
    });
}
