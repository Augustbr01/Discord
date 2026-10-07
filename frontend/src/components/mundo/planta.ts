// Planta de um andar: tudo que é posição fica aqui (paredes, salas, móveis, colisão),
// gerado a partir dos canais do servidor. Os componentes 3D só desenham o que sai daqui.
//
// Eixos: x = esquerda/direita, z = frente/trás (andar pelo corredor = ir para -z), y = altura.
//
//            z = fim  ┌──┐
//     sala 2 (esq.)   │  │   sala 3 (dir.)
//     sala 0 (esq.)   │  │   sala 1 (dir.)
//            z = 0  ──┘  └──
//                  hall (quadros dos canais de texto nas paredes laterais)
//            z = H  ── elevador ──
//
// As salas entram no lado do corredor que estiver mais curto. Sala comum ocupa 8 m de
// corredor; cinema ocupa 16 m (telão no fundo, poltronas em degraus subindo pra trás).
import type { Canal, ModeloSala } from "../../api";

export type Ret = { x1: number; z1: number; x2: number; z2: number };
export type TipoParede = "parede" | "hall" | "metal";
// caixa de y = base até y = topo
export type Parede = Ret & { base: number; topo: number; tipo: TipoParede };
export type Ponto = { x: number; z: number };

export type TipoMovel = "sofa" | "mesa" | "planta" | "tapete" | "poltrona" | "torre" | "pedestal";
// rot: giro em torno de y (0 = o "frente" do móvel aponta para +z); y: altura do chão embaixo dele
export type Movel = Ponto & { tipo: TipoMovel; rot: number; cor?: string; raio?: number; y?: number };

// lugar pra sentar. y = altura do chão embaixo do assento; rot = pra onde olha quem senta
export type Assento = Ponto & { id: string; salaId: string | null; y: number; rot: number };

// piso elevado (degraus do cinema): dentro dele o chão fica na altura `topo`
export type Degrau = Ret & { topo: number };

// caixa de som do surround da sala. Ordem: frente esquerda, centro, frente direita,
// traseira esquerda, traseira direita (esquerda/direita de quem olha pra TV)
export type CaixaSom = Ponto & { y: number; tipo: "torre" | "barra" | "parede" | "oculta"; rot: number };

export type SalaPlanta = {
    canalId: string;
    modelo: ModeloSala;
    // -1 = à esquerda do corredor, 1 = à direita
    lado: -1 | 1;
    ret: Ret;
    centro: Ponto;
    porta: Ponto;
    // altura do teto
    altura: number;
    // TV (ou telão): centro, altura do centro e largura da tela
    tv: Ponto & { rot: number; y: number; largura: number };
    // assentos da sala, na ordem em que quem está pelo modo clássico vai ocupando
    assentos: Assento[];
    caixasSom: CaixaSom[];
    // o controle da sala: deitado na mesa de centro (sala comum) ou num pedestal (cinema)
    tablet: Ponto & { y: number; rot: number; inclinacao: number };
    // quem está pelo modo clássico e não coube nos assentos fica em pé aqui
    lugares: (Ponto & { rot: number })[];
    cor: string;
};

export type Quadro = Ponto & { canalId: string; rot: number };
export type Interativo = Ponto & { id: string; raio: number; tipo: "elevador" | "texto" | "tv" | "assento" | "tablet"; canalId?: string; assentoId?: string };

export type Planta = {
    paredes: Parede[];
    // pedaço de parede acima das portas: só desenho, não bloqueia
    vergas: Parede[];
    moveis: Movel[];
    colisao: Ret[];
    salas: SalaPlanta[];
    assentos: Assento[];
    degraus: Degrau[];
    quadros: Quadro[];
    interativos: Interativo[];
    hall: Ret;
    corredor: Ret;
    elevador: Ret;
    portaElevador: Ret;
    nascer: Ponto & { rot: number };
};

export const ESPESSURA = 0.2;
export const ALTURA = 3.2;
export const ALTURA_HALL = 4.2;
export const ALTURA_PORTA = 2.4;
export const ALTURA_ELEVADOR = 2.6;
export const ALTURA_CINEMA = 5;
export const RAIO_JOGADOR = 0.3;
// degrau mais alto que dá pra subir andando
export const DEGRAU_MAXIMO = 0.45;

const LARGURA = 10; // metade da largura do prédio
const CORREDOR = 2; // metade da largura do corredor
const VAGA = 8; // comprimento de uma sala comum ao longo do corredor
const VAGA_CINEMA = 16;
const FILAS_CINEMA = 5;
const POLTRONAS_POR_FILA = 9;
const FUNDO_FILA = 1.9; // profundidade de cada degrau
const ALTURA_DEGRAU = 0.32;
const PORTA = 1.8;
const ELEVADOR = 1.3; // metade da largura da cabine
const FUNDO_ELEVADOR = 2.4;
const QUADROS_POR_PAREDE = 4;
const ESPACO_QUADRO = 2.6;

// tons sóbrios pros detalhes de cada sala (tapete, painel atrás da TV)
const CORES_SALA = ["#a0644a", "#6f8466", "#56708a", "#a88a4f", "#7d5e7a", "#4f7f7c"];

const e = ESPESSURA / 2;

// parede ao longo de x (em z fixo), com vãos [x1, x2] abertos nela
function paredeX(z: number, x1: number, x2: number, topo: number, tipo: TipoParede, vaos: [number, number][] = []): Parede[] {
    const pedacos: Parede[] = [];
    let inicio = x1;
    for (const [a, b] of [...vaos].sort((p, q) => p[0] - q[0])) {
        if (a > inicio) pedacos.push({ x1: inicio, x2: a, z1: z - e, z2: z + e, base: 0, topo, tipo });
        inicio = Math.max(inicio, b);
    }
    if (x2 > inicio) pedacos.push({ x1: inicio, x2, z1: z - e, z2: z + e, base: 0, topo, tipo });
    return pedacos;
}

// parede ao longo de z (em x fixo)
function paredeZ(x: number, z1: number, z2: number, topo: number, tipo: TipoParede, vaos: [number, number][] = []): Parede[] {
    return paredeX(0, z1, z2, topo, tipo, vaos).map((p) => ({ ...p, x1: x - e, x2: x + e, z1: p.x1, z2: p.x2 }));
}

function hashTexto(texto: string) {
    let h = 2166136261;
    for (let i = 0; i < texto.length; i++) {
        h ^= texto.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

// o quanto um móvel ocupa no chão (pra colisão)
function areaMovel(m: Movel): Ret | null {
    const meia = (largura: number, fundo: number): Ret => {
        // só giros de 90°: troca largura e fundo quando o móvel está de lado
        const deLado = Math.abs(Math.sin(m.rot)) > 0.5;
        const [lx, lz] = deLado ? [fundo, largura] : [largura, fundo];
        return { x1: m.x - lx / 2, x2: m.x + lx / 2, z1: m.z - lz / 2, z2: m.z + lz / 2 };
    };
    if (m.tipo === "sofa") return meia(2.4, 0.95);
    if (m.tipo === "mesa") return meia(1.2, 1.2);
    if (m.tipo === "planta") return meia(0.6, 0.6);
    if (m.tipo === "torre" || m.tipo === "pedestal") return meia(0.4, 0.4);
    // poltronas do cinema: a fileira inteira bloqueia junto (ver salaCinema)
    return null;
}

// leva um ponto do espaço do móvel (lx, lz) pro andar
function doMovel(m: Ponto & { rot: number }, lx: number, lz: number): Ponto {
    const c = Math.cos(m.rot);
    const s = Math.sin(m.rot);
    return { x: m.x + lx * c + lz * s, z: m.z - lx * s + lz * c };
}

// os três lugares de um sofá; quem senta olha pra frente do sofá
function assentosDoSofa(m: Movel, salaId: string | null, prefixo: string): Assento[] {
    return [0, -0.65, 0.65].map((lx, i) => ({ ...doMovel(m, lx, 0.05), id: `${prefixo}:${i}`, salaId, y: 0, rot: m.rot + Math.PI }));
}

// altura do chão num ponto (só muda nos degraus do cinema)
export function alturaChao(degraus: Degrau[], p: Ponto) {
    let h = 0;
    for (const d of degraus) if (dentro(d, p) && d.topo > h) h = d.topo;
    return h;
}

export function dentro(r: Ret, p: Ponto, folga = 0) {
    return p.x > r.x1 - folga && p.x < r.x2 + folga && p.z > r.z1 - folga && p.z < r.z2 + folga;
}

export function gerarPlanta(canais: Pick<Canal, "id" | "tipo" | "modelo">[]): Planta {
    const voz = canais.filter((c) => c.tipo === "VOZ");
    const texto = canais.filter((c) => c.tipo === "TEXTO");

    // o hall cresce se tiver mais canais de texto do que cabe nas paredes
    const porParede = Math.max(QUADROS_POR_PAREDE, Math.ceil(texto.length / 2));
    const H = Math.max(12, porParede * ESPACO_QUADRO + 2);

    const paredes: Parede[] = [];
    const vergas: Parede[] = [];
    const moveis: Movel[] = [];
    const degraus: Degrau[] = [];
    const colisaoExtra: Ret[] = [];

    // ---------- hall ----------
    paredes.push(...paredeX(H, -LARGURA, LARGURA, ALTURA_HALL, "hall", [[-1.1, 1.1]]));
    vergas.push({ x1: -1.1, x2: 1.1, z1: H - e, z2: H + e, base: ALTURA_ELEVADOR - 0.2, topo: ALTURA_HALL, tipo: "hall" });
    paredes.push(...paredeZ(-LARGURA, 0, H, ALTURA_HALL, "hall"));
    paredes.push(...paredeZ(LARGURA, 0, H, ALTURA_HALL, "hall"));
    paredes.push(...paredeX(0, -LARGURA, LARGURA, ALTURA_HALL, "hall", [[-CORREDOR, CORREDOR]]));
    vergas.push({ x1: -CORREDOR, x2: CORREDOR, z1: -e, z2: e, base: ALTURA, topo: ALTURA_HALL, tipo: "hall" });

    // ---------- elevador (cabine atrás da parede do fundo do hall) ----------
    paredes.push(...paredeZ(-ELEVADOR, H, H + FUNDO_ELEVADOR, ALTURA_ELEVADOR, "metal"));
    paredes.push(...paredeZ(ELEVADOR, H, H + FUNDO_ELEVADOR, ALTURA_ELEVADOR, "metal"));
    paredes.push(...paredeX(H + FUNDO_ELEVADOR, -ELEVADOR, ELEVADOR, ALTURA_ELEVADOR, "metal"));

    // ---------- salas de voz: cada uma no lado do corredor que estiver mais curto ----------
    // quanto de corredor cada lado já usou, e a altura da última parede de cada lado
    // (o cinema é mais alto e precisa completar a parede que divide com a sala anterior)
    const usado = { [-1]: 0, [1]: 0 } as Record<-1 | 1, number>;
    const alturaAnterior = { [-1]: ALTURA_HALL, [1]: ALTURA_HALL } as Record<-1 | 1, number>;

    const salas: SalaPlanta[] = voz.map((canal) => {
        const lado: -1 | 1 = usado[1] < usado[-1] ? 1 : -1;
        const cinema = canal.modelo === "CINEMA";
        const comprimento = cinema ? VAGA_CINEMA : VAGA;
        const altura = cinema ? ALTURA_CINEMA : ALTURA;
        const zPerto = -usado[lado];
        const zLonge = zPerto - comprimento;
        usado[lado] += comprimento;

        const xFora = lado * LARGURA;
        const xMin = Math.min(lado * CORREDOR, xFora);
        const xMax = Math.max(lado * CORREDOR, xFora);

        paredes.push(...paredeZ(xFora, zLonge, zPerto, altura, "parede"));
        paredes.push(...paredeX(zLonge, xMin, xMax, altura, "parede"));
        // parede mais alta que a vizinha: completa por cima (só desenho)
        if (altura > alturaAnterior[lado]) {
            vergas.push({ x1: xMin, x2: xMax, z1: zPerto - e, z2: zPerto + e, base: alturaAnterior[lado], topo: altura, tipo: "parede" });
        }
        if (altura > ALTURA) {
            vergas.push({ x1: lado * CORREDOR - e, x2: lado * CORREDOR + e, z1: zLonge, z2: zPerto, base: ALTURA, topo: altura, tipo: "parede" });
        }
        alturaAnterior[lado] = altura;

        const base = {
            canalId: canal.id,
            lado,
            ret: { x1: xMin + e, x2: xMax - e, z1: zLonge + e, z2: zPerto - e },
            altura,
            cor: CORES_SALA[hashTexto(canal.id) % CORES_SALA.length],
        };
        return cinema
            ? salaCinema(base, zLonge, zPerto, moveis, degraus, colisaoExtra)
            : salaComum(base, zLonge, zPerto, moveis);
    });
    const fim = -Math.max(VAGA, usado[-1], usado[1]) - 2;

    // ---------- corredor, com as portas das salas ----------
    const portas = (lado: number) =>
        salas.filter((s) => s.lado === lado).map((s): [number, number] => [s.porta.z - PORTA / 2, s.porta.z + PORTA / 2]);
    paredes.push(...paredeZ(-CORREDOR, fim, 0, ALTURA, "parede", portas(-1)));
    paredes.push(...paredeZ(CORREDOR, fim, 0, ALTURA, "parede", portas(1)));
    paredes.push(...paredeX(fim, -CORREDOR, CORREDOR, ALTURA, "parede"));
    for (const s of salas) {
        vergas.push({
            x1: s.porta.x - e, x2: s.porta.x + e, z1: s.porta.z - PORTA / 2, z2: s.porta.z + PORTA / 2,
            base: ALTURA_PORTA, topo: ALTURA, tipo: "parede",
        });
    }

    // ---------- canais de texto: quadros nas paredes laterais do hall ----------
    const quadros: Quadro[] = texto.map((canal, i) => {
        const lado = i < porParede ? -1 : 1;
        const n = i % porParede;
        return {
            canalId: canal.id,
            x: lado * (LARGURA - e - 0.03),
            z: H - 2.2 - n * ESPACO_QUADRO,
            rot: lado < 0 ? Math.PI / 2 : -Math.PI / 2,
        };
    });

    // ---------- móveis do hall ----------
    const zLounge = H / 2;
    moveis.push(
        { tipo: "tapete", x: 5.6, z: zLounge, rot: 0, cor: "#3b3631", raio: 3 },
        { tipo: "mesa", x: 5.6, z: zLounge, rot: 0 },
        { tipo: "sofa", x: 5.6, z: zLounge - 2.1, rot: 0, cor: "#8c7b6b" },
        { tipo: "sofa", x: 5.6, z: zLounge + 2.1, rot: Math.PI, cor: "#8c7b6b" },
        { tipo: "planta", x: -2.1, z: H - 0.7, rot: 0 },
        { tipo: "planta", x: 2.1, z: H - 0.7, rot: 0 },
        { tipo: "planta", x: -LARGURA + 0.7, z: 0.8, rot: 0 },
        { tipo: "planta", x: LARGURA - 0.7, z: 0.8, rot: 0 },
        { tipo: "planta", x: LARGURA - 0.7, z: H - 0.8, rot: 0 },
    );
    if (texto.length <= porParede) moveis.push({ tipo: "planta", x: -LARGURA + 0.7, z: H - 0.8, rot: 0 });

    // os sofás do hall também dão pra sentar
    const assentos: Assento[] = [
        ...salas.flatMap((s) => s.assentos),
        ...moveis.filter((m) => m.tipo === "sofa" && dentro({ x1: -LARGURA, x2: LARGURA, z1: 0, z2: H }, m))
            .flatMap((m, i) => assentosDoSofa(m, null, `hall:${i}`)),
    ];

    const interativos: Interativo[] = [
        { id: "elevador", tipo: "elevador", x: 0, z: H + 0.3, raio: 1.9 },
        ...quadros.map((q): Interativo => ({
            id: `texto-${q.canalId}`,
            tipo: "texto",
            canalId: q.canalId,
            x: q.x + (q.x < 0 ? 1 : -1),
            z: q.z,
            raio: 1.6,
        })),
        // TV de cada sala: controla o YouTube junto (só quem está na call daquela sala).
        // Vale de quase toda a metade da sala do lado da TV (no cinema, da sala toda), olhando pra ela
        ...salas.map((s): Interativo => {
            // a tela olha pra (sen rot, cos rot); o ponto fica um pouco à frente dela
            const recuo = s.modelo === "CINEMA" ? 8 : 2.4;
            return {
                id: `tv-${s.canalId}`,
                tipo: "tv",
                canalId: s.canalId,
                x: s.tv.x + Math.sin(s.tv.rot) * recuo,
                z: s.tv.z + Math.cos(s.tv.rot) * recuo,
                raio: s.modelo === "CINEMA" ? 9 : 4,
            };
        }),
        ...assentos.map((a): Interativo => ({ id: `assento-${a.id}`, tipo: "assento", assentoId: a.id, x: a.x, z: a.z, raio: 1.15 })),
        ...salas.map((s): Interativo => ({ id: `tablet-${s.canalId}`, tipo: "tablet", canalId: s.canalId, x: s.tablet.x, z: s.tablet.z, raio: 1.5 })),
    ];

    const colisao: Ret[] = [
        ...paredes,
        ...moveis.map(areaMovel).filter((r): r is Ret => r !== null),
        ...colisaoExtra,
    ];

    return {
        paredes,
        vergas,
        moveis,
        colisao,
        salas,
        assentos,
        degraus,
        quadros,
        interativos,
        hall: { x1: -LARGURA, x2: LARGURA, z1: 0, z2: H },
        corredor: { x1: -CORREDOR, x2: CORREDOR, z1: fim, z2: 0 },
        elevador: { x1: -ELEVADOR, x2: ELEVADOR, z1: H, z2: H + FUNDO_ELEVADOR },
        portaElevador: { x1: -1.1, x2: 1.1, z1: H - 0.06, z2: H + 0.06 },
        nascer: { x: 0, z: H + FUNDO_ELEVADOR / 2 + 0.1, rot: 0 },
    };
}

type BaseSala = Pick<SalaPlanta, "canalId" | "lado" | "ret" | "altura" | "cor">;

// sala comum: dois sofás de frente um pro outro, mesa no meio e a TV na parede de fora
function salaComum(base: BaseSala, zLonge: number, zPerto: number, moveis: Movel[]): SalaPlanta {
    const { lado, canalId, cor } = base;
    const zc = (zPerto + zLonge) / 2;
    const xc = lado * (CORREDOR + LARGURA) / 2;
    const xFora = lado * LARGURA;
    const xMovel = xc + lado * 0.2;

    const sofas: Movel[] = [
        { tipo: "sofa", x: xMovel, z: zc - 3.0, rot: 0, cor },
        { tipo: "sofa", x: xMovel, z: zc + 3.0, rot: Math.PI, cor },
    ];
    moveis.push(
        { tipo: "tapete", x: xc, z: zc, rot: 0, cor, raio: 2.6 },
        { tipo: "mesa", x: xc, z: zc, rot: 0 },
        ...sofas,
        { tipo: "planta", x: xFora - lado * 0.7, z: zc - 3.3, rot: 0 },
        { tipo: "planta", x: xFora - lado * 0.7, z: zc + 3.3, rot: 0 },
        { tipo: "planta", x: lado * (CORREDOR + 0.6), z: zc + 3.3, rot: 0 },
    );

    // lugares em pé em volta da mesa, olhando pro centro, começando pelo lado da TV
    // (de frente pra quem entra). Passou de 8 pessoas, abre uma roda maior
    const lugares = Array.from({ length: 16 }, (_, n) => {
        const roda = n < 8 ? 0 : 1;
        const k = n % 8;
        const angulo = (lado > 0 ? 0 : Math.PI) + roda * (Math.PI / 9) + (k % 2 === 0 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 4.5);
        const raio = roda === 0 ? 1.7 : 2.5;
        const x = xc + Math.cos(angulo) * raio;
        const z = zc + Math.sin(angulo) * raio;
        // rot de quem olha de (x, z) para o centro
        return { x, z, rot: Math.atan2(x - xc, z - zc) };
    });

    // os dois sofás intercalados: o meio de cada um primeiro, depois as pontas
    const [a, b] = sofas.map((m, i) => assentosDoSofa(m, canalId, `${canalId}:${i}`));
    const assentos = [0, 1, 2].flatMap((i) => [a[i], b[i]]);

    // surround: torres dos lados da TV, barra embaixo dela e duas caixas na parede do corredor.
    // Quem olha pra TV olha pra +lado (em x); a direita dessa pessoa fica em +lado (em z)
    const xTv = xFora - lado * (e + 0.26);
    const virada = -lado * Math.PI / 2; // de frente pra sala, como a TV
    const caixasSom: CaixaSom[] = [
        { x: xTv - lado * 0.8, y: 1.0, z: zc - lado * 2.2, tipo: "torre", rot: virada },
        { x: xTv + Math.sin(virada) * 0.08, y: 0.45, z: zc + Math.cos(virada) * 0.08, tipo: "barra", rot: virada },
        { x: xTv - lado * 0.8, y: 1.0, z: zc + lado * 2.2, tipo: "torre", rot: virada },
        { x: lado * (CORREDOR + 0.7), y: 2.35, z: zc - lado * 3.6, tipo: "parede", rot: lado * Math.PI / 2 },
        { x: lado * (CORREDOR + 0.7), y: 2.35, z: zc + lado * 3.6, tipo: "parede", rot: lado * Math.PI / 2 },
    ];
    moveis.push(
        { tipo: "torre", x: caixasSom[0].x, z: caixasSom[0].z, rot: virada },
        { tipo: "torre", x: caixasSom[2].x, z: caixasSom[2].z, rot: virada },
    );

    return {
        ...base,
        modelo: "PADRAO",
        centro: { x: xc, z: zc },
        porta: { x: lado * CORREDOR, z: zc },
        tv: { x: xTv, z: zc, rot: virada, y: 1.75, largura: 4.0 },
        assentos,
        caixasSom,
        tablet: { x: xc, y: 0.49, z: zc, rot: virada, inclinacao: -Math.PI / 2 },
        lugares,
    };
}

// cinema: telão na parede do fundo (zLonge), porta perto dele, e fileiras de poltronas
// em degraus subindo até o fundo. O corredor lateral (do lado da porta) vira escada
function salaCinema(base: BaseSala, zLonge: number, zPerto: number, moveis: Movel[], degraus: Degrau[], colisao: Ret[]): SalaPlanta {
    const { lado, canalId, ret } = base;
    const xc = lado * (CORREDOR + LARGURA) / 2;
    const zFilas = zLonge + 5; // começo dos degraus: 5 m de chão livre na frente do telão

    const assentos: Assento[] = [];
    for (let fila = 0; fila < FILAS_CINEMA; fila++) {
        const z1 = zFilas + fila * FUNDO_FILA;
        const ultima = fila === FILAS_CINEMA - 1;
        const topo = (fila + 1) * ALTURA_DEGRAU;
        degraus.push({ x1: ret.x1, x2: ret.x2, z1, z2: ultima ? ret.z2 : z1 + FUNDO_FILA, topo });

        // poltronas no fundo do degrau (na frente fica o espaço das pernas), olhando pro telão
        const zPoltrona = z1 + 1.3;
        for (let k = 0; k < POLTRONAS_POR_FILA; k++) {
            const x = lado * (CORREDOR + 1.6 + k * 0.72);
            moveis.push({ tipo: "poltrona", x, z: zPoltrona, rot: Math.PI, y: topo, cor: "#7a1f24" });
            assentos.push({ id: `${canalId}:${fila}:${k}`, salaId: canalId, x, z: zPoltrona, y: topo, rot: 0 });
        }
        // a fileira bloqueia inteira; entra-se pelo espaço das pernas, vindo do corredor lateral
        const xs = [lado * (CORREDOR + 1.25), lado * (CORREDOR + 1.6 + (POLTRONAS_POR_FILA - 1) * 0.72 + 0.4)];
        colisao.push({ x1: Math.min(...xs), x2: Math.max(...xs), z1: zPoltrona - 0.32, z2: zPoltrona + 0.38 });
    }

    // ordem de ocupação de quem está pelo modo clássico: fileiras do meio e poltronas do centro primeiro
    const meio = (POLTRONAS_POR_FILA - 1) / 2;
    const ordemFila = [2, 1, 3, 0, 4];
    assentos.sort((p, q) => {
        const [, fp, kp] = p.id.split(":").map(Number);
        const [, fq, kq] = q.id.split(":").map(Number);
        return ordemFila.indexOf(fp) - ordemFila.indexOf(fq) || Math.abs(kp - meio) - Math.abs(kq - meio);
    });

    // surround: as da frente atrás do telão (como num cinema), as traseiras nas paredes laterais.
    // Quem olha pro telão olha pra -z; a direita dessa pessoa é +x
    const zFundo = ret.z2 - 4;
    const caixasSom: CaixaSom[] = [
        { x: xc - 2.4, y: 2.6, z: zLonge + 0.5, tipo: "oculta", rot: 0 },
        { x: xc, y: 2.6, z: zLonge + 0.5, tipo: "oculta", rot: 0 },
        { x: xc + 2.4, y: 2.6, z: zLonge + 0.5, tipo: "oculta", rot: 0 },
        { x: ret.x1 + 0.16, y: 3.4, z: zFundo, tipo: "parede", rot: Math.PI / 2 },
        { x: ret.x2 - 0.16, y: 3.4, z: zFundo, tipo: "parede", rot: -Math.PI / 2 },
    ];
    const pedestal = { x: lado * (CORREDOR + 1.3), z: zLonge + 3.7 };
    moveis.push({ tipo: "pedestal", x: pedestal.x, z: pedestal.z, rot: 0 });

    return {
        ...base,
        modelo: "CINEMA",
        caixasSom,
        // em cima do pedestal, inclinado pra quem chega pela porta
        tablet: { x: pedestal.x, y: 1.08, z: pedestal.z, rot: -lado * Math.PI / 2, inclinacao: -0.6 },
        centro: { x: xc, z: (zLonge + zPerto) / 2 },
        porta: { x: lado * CORREDOR, z: zLonge + 2.2 },
        tv: { x: xc, z: zLonge + e + 0.06, rot: 0, y: 2.75, largura: 7.1 },
        assentos,
        // não coube nas 45 poltronas: em pé na frente do telão
        lugares: Array.from({ length: 12 }, (_, n) => ({ x: xc + (n % 6 - 2.5) * 1.1, z: zLonge + 2.8 + Math.floor(n / 6) * 1.1, rot: 0 })),
    };
}

// onde a pessoa aparece ao abrir o 3D já numa call deste andar: logo depois da porta da sala
export function nascerNaSala(sala: SalaPlanta): Ponto & { rot: number } {
    return { x: sala.porta.x + sala.lado * 1.4, z: sala.porta.z, rot: -sala.lado * Math.PI / 2 };
}

// empurra um círculo (o jogador) pra fora das caixas. Um eixo de cada vez pra deslizar nas paredes.
// podePisar: chão alto demais (degrau acima do que dá pra subir) também bloqueia
export function moverComColisao(de: Ponto, para: Ponto, caixas: Ret[], raio = RAIO_JOGADOR, podePisar?: (p: Ponto) => boolean): Ponto {
    const bate = (x: number, z: number) =>
        caixas.some((c) => x > c.x1 - raio && x < c.x2 + raio && z > c.z1 - raio && z < c.z2 + raio) ||
        (podePisar !== undefined && !podePisar({ x, z }));

    // já estava dentro de algo (ex.: levantou num lugar apertado): deixa sair
    if (bate(de.x, de.z)) return para;

    let x = de.x;
    let z = de.z;
    if (!bate(para.x, z)) x = para.x;
    if (!bate(x, para.z)) z = para.z;
    return { x, z };
}

// cabe um jogador em pé aqui?
export function pontoLivre(caixas: Ret[], p: Ponto, raio = RAIO_JOGADOR) {
    return !caixas.some((c) => p.x > c.x1 - raio && p.x < c.x2 + raio && p.z > c.z1 - raio && p.z < c.z2 + raio);
}
