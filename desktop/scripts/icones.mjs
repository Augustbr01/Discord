// gera os ícones (PNG) a partir do passarinho da marca (o Bird do lucide, o mesmo da tela de
// carregamento). Usa o sharp do backend (node_modules da raiz). Rodar de novo só se mudar o desenho
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const PASSARO = `
    <path d="M16 7h.01" />
    <path d="M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20" />
    <path d="m20 7 2 .5-2 .5" />
    <path d="M10 18v3" />
    <path d="M14 17.75V21" />
    <path d="M7 18a6 6 0 0 0 3.84-10.61" />`;

const tracos = (cor, largura) =>
    `fill="none" stroke="${cor}" stroke-width="${largura}" stroke-linecap="round" stroke-linejoin="round"`;

// ladrilho escuro com o pássaro claro (as cores do site); aviso = bolinha vermelha no canto
const ladrilho = (aviso = false) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <rect width="24" height="24" rx="5.4" fill="#09090b" />
    <g transform="translate(4.2 4.2) scale(0.65)" ${tracos("#ededef", 2)}>${PASSARO}</g>
    ${aviso ? `<circle cx="19.5" cy="4.5" r="4.5" fill="#e5484d" />` : ""}
</svg>`;

// macOS: só o pássaro em preto, o sistema pinta conforme o tema da barra
const template = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <g ${tracos("#000", 2)}>${PASSARO}</g>
</svg>`;

const ponto = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
    <circle cx="8" cy="8" r="7" fill="#e5484d" />
</svg>`;

const gerar = (svg, tamanho, destino) =>
    sharp(Buffer.from(svg), { density: 72 * Math.ceil(tamanho / 24) * 2 }).resize(tamanho, tamanho).png().toFile(destino);

// Linux: um por tamanho que o tema de ícones (hicolor) conhece. Só o de 1024 o GNOME não acha
const TAMANHOS_LINUX = [16, 24, 32, 48, 64, 128, 256, 512];

mkdirSync("assets", { recursive: true });
mkdirSync("build/icons", { recursive: true });
await Promise.all([
    ...TAMANHOS_LINUX.map((t) => gerar(ladrilho(), t, `build/icons/${t}x${t}.png`)),
    // electron-builder gera o .ico (Windows) e o .icns (macOS) a partir deste
    gerar(ladrilho(), 1024, "build/icon.png"),
    gerar(ladrilho(), 512, "assets/icone.png"),
    gerar(ladrilho(), 32, "assets/bandeja.png"),
    gerar(ladrilho(true), 32, "assets/bandeja-aviso.png"),
    gerar(template, 16, "assets/bandejaTemplate.png"),
    gerar(template, 32, "assets/bandejaTemplate@2x.png"),
    gerar(ponto, 16, "assets/ponto.png"),
]);
console.log("ícones gerados em build/ e assets/");
