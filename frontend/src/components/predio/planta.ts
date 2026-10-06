// A planta de um andar, calculada a partir dos canais do servidor.
// Tudo em metros. A câmera olha pra -z: o elevador fica atrás (z > 2) e o corredor
// segue pra frente (z negativo), com as salas de voz alternando esquerda e direita.
//
//           z = 4.8  ┌──────┐
//                    │ elev │
//           z = 2    ├─┐  ┌─┤        mural (canais de texto) na parede esquerda,
//                 mural│  │quadro    quadro do andar na direita, logo na saída do elevador
//           z = -2 ┌───┘  └───┐
//                  │ sala │ sala │   salas de 8 x 8 m, porta de vidro pro corredor
//                  └───┐  ┌───┘
//                     ...
import type { Canal } from "../../api";

export const PE_DIREITO = 3;
export const ESPESSURA = 0.2;
const MEIO_CORREDOR = 2;
const SALA = 8;
const PASSO = 9.5;
const MEIA_PORTA = 1.1;
const ELEVADOR = { meiaLargura: 1.2, frente: 2, fundo: 4.8 };

export type Parede = {
    cx: number;
    cz: number;
    w: number; // em x
    d: number; // em z
    vidro?: boolean;
};

export type SalaPlanta = {
    canal: Canal;
    lado: -1 | 1;
    cx: number;
    cz: number;
};

export type PainelMural = {
    canal: Canal;
    z: number;
    y: number;
    largura: number;
    altura: number;
};

export type Planta = {
    paredes: Parede[];
    salas: SalaPlanta[];
    mural: PainelMural[];
    // onde o corredor termina (z negativo)
    fim: number;
};

export const ELEVADOR_PLANTA = ELEVADOR;
export const NASCER = { x: 0, z: 3.7 };

// parede ao longo de z (fica num x fixo)
function paredeX(x: number, z1: number, z2: number, vidro = false): Parede {
    return { cx: x, cz: (z1 + z2) / 2, w: ESPESSURA, d: Math.abs(z2 - z1), vidro };
}

// parede ao longo de x (fica num z fixo)
function paredeZ(z: number, x1: number, x2: number): Parede {
    return { cx: (x1 + x2) / 2, cz: z, w: Math.abs(x2 - x1), d: ESPESSURA };
}

export function montarPlanta(canais: Canal[]): Planta {
    const salasVoz = canais.filter((c) => c.tipo === "VOZ");
    const textos = canais.filter((c) => c.tipo === "TEXTO");

    const salas: SalaPlanta[] = salasVoz.map((canal, i) => {
        const lado = i % 2 === 0 ? -1 : 1;
        const cz = -(6 + Math.floor(i / 2) * PASSO);
        return { canal, lado, cx: lado * (MEIO_CORREDOR + SALA / 2), cz };
    });

    const fileiras = Math.ceil(salasVoz.length / 2);
    const fim = fileiras > 0 ? -(14 + (fileiras - 1) * PASSO) : -9;

    const paredes: Parede[] = [];
    const { meiaLargura, frente, fundo } = ELEVADOR;

    // elevador: fundo, laterais e a parede da frente em volta da porta
    paredes.push(paredeZ(fundo, -meiaLargura, meiaLargura));
    paredes.push(paredeX(-meiaLargura, frente, fundo));
    paredes.push(paredeX(meiaLargura, frente, fundo));
    paredes.push(paredeZ(frente, -MEIO_CORREDOR, -meiaLargura));
    paredes.push(paredeZ(frente, meiaLargura, MEIO_CORREDOR));

    // fim do corredor
    paredes.push(paredeZ(fim, -MEIO_CORREDOR, MEIO_CORREDOR));

    // paredes do corredor: sólidas entre as salas, de vidro na frente de cada sala (com a porta no meio)
    for (const lado of [-1, 1] as const) {
        const x = lado * MEIO_CORREDOR;
        const daqui = salas.filter((s) => s.lado === lado).sort((a, b) => b.cz - a.cz);
        let z = frente;
        for (const s of daqui) {
            const topo = s.cz + SALA / 2;
            const base = s.cz - SALA / 2;
            if (z > topo) paredes.push(paredeX(x, z, topo));
            paredes.push(paredeX(x, topo, s.cz + MEIA_PORTA, true));
            paredes.push(paredeX(x, s.cz - MEIA_PORTA, base, true));
            z = base;
        }
        if (z > fim) paredes.push(paredeX(x, z, fim));
    }

    // as salas: parede do fundo e as duas laterais
    for (const s of salas) {
        const perto = s.lado * MEIO_CORREDOR;
        const longe = s.lado * (MEIO_CORREDOR + SALA);
        paredes.push(paredeX(longe, s.cz - SALA / 2, s.cz + SALA / 2));
        paredes.push(paredeZ(s.cz + SALA / 2, Math.min(perto, longe), Math.max(perto, longe)));
        paredes.push(paredeZ(s.cz - SALA / 2, Math.min(perto, longe), Math.max(perto, longe)));
    }

    // mural: os canais de texto como quadros na parede esquerda, entre o elevador e a primeira sala
    const colunas = Math.min(3, Math.max(1, textos.length));
    const largura = (3.4 - (colunas - 1) * 0.16) / colunas;
    const mural: PainelMural[] = textos.slice(0, 6).map((canal, i) => {
        const coluna = i % colunas;
        const linha = Math.floor(i / colunas);
        return {
            canal,
            z: 1.7 - largura / 2 - coluna * (largura + 0.16),
            y: 1.95 - linha * 0.86,
            largura,
            altura: 0.74,
        };
    });

    return { paredes, salas, mural, fim };
}

// a sala em que o ponto (x, z) está, se estiver dentro de alguma (já passou da porta)
export function salaEm(planta: Planta, x: number, z: number): SalaPlanta | null {
    for (const s of planta.salas) {
        const dentroX = s.lado < 0 ? x < -MEIO_CORREDOR - 0.15 : x > MEIO_CORREDOR + 0.15;
        if (dentroX && Math.abs(z - s.cz) < SALA / 2) return s;
    }
    return null;
}

export function dentroDoElevador(z: number) {
    return z > ELEVADOR.frente + 0.25;
}

// as portas do elevador, pra colisão enquanto estão fechadas
export const PORTA_ELEVADOR: Parede = paredeZ(ELEVADOR.frente, -ELEVADOR.meiaLargura, ELEVADOR.meiaLargura);
