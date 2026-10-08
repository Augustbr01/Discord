// Colisão do andar: cada parede, degrau e móvel é um SÓLIDO no formato de verdade — uma caixa
// girada no ângulo do móvel, ou um cilindro (mesas hexagonais, puffs, vasos) — e com altura
// (de y = base até y = topo). O jogador é um cilindro em pé: raio RAIO_JOGADOR, dos pés até a
// cabeça (ALTURA_CORPO, ou ALTURA_AGACHADO).
//
// - um sólido bloqueia se a parte de cima dele está acima do que dá pra subir andando
//   (pés + DEGRAU_MAXIMO) e a de baixo está abaixo da cabeça: dá pra passar agachado por baixo
//   de uma prateleira alta, e pular por cima (ou subir em cima) de mesa, sofá e rack;
// - o chão num ponto é o topo mais alto embaixo de você que você alcança (degrau, ou o móvel
//   em que aterrissou);
// - ao andar, o jogador é empurrado pra fora do que bateu, na direção da superfície: desliza
//   ao longo de qualquer parede ou móvel, inclusive os girados (o sofá em V).
import type { Ponto, Ret } from "./planta";

const U = 0.0254; // 1 unidade do CS
export const RAIO_JOGADOR = 0.3;
export const ALTURA_CORPO = 72 * U; // 1,83 m, como no CS
export const ALTURA_AGACHADO = 54 * U; // 1,37 m
export const ALTURA_DEITADO = 0.5;
// degrau mais alto que dá pra subir andando (um pouco abaixo do tampo de uma mesa)
export const DEGRAU_MAXIMO = 0.45;
// dá pra ficar em pé com o centro até este tanto pra fora da beirada de um móvel
const APOIO = 0.12;
// o movimento de um tick é feito em pedaços desse tamanho (não atravessa parede em alta velocidade)
const PASSO = 0.12;

export type Solido =
    // rot: giro em y, no mesmo sentido do resto do andar (rotation.y do three)
    | { forma: "caixa"; x: number; z: number; hx: number; hz: number; rot: number; base: number; topo: number }
    | { forma: "cilindro"; x: number; z: number; raio: number; base: number; topo: number };

export function solidoDeRet(r: Ret, base: number, topo: number): Solido {
    return { forma: "caixa", x: (r.x1 + r.x2) / 2, z: (r.z1 + r.z2) / 2, hx: (r.x2 - r.x1) / 2, hz: (r.z2 - r.z1) / 2, rot: 0, base, topo };
}

// raio que cobre o sólido inteiro no chão (pra descartar rápido o que está longe)
function alcance(s: Solido) {
    return s.forma === "cilindro" ? s.raio : Math.hypot(s.hx, s.hz);
}

// distância (no chão) do ponto até o sólido, e pra que lado empurrar pra sair dele.
// Negativa quando o ponto está dentro (o quanto falta pra sair)
function distancia(s: Solido, px: number, pz: number): { d: number; nx: number; nz: number } {
    const dx = px - s.x;
    const dz = pz - s.z;
    if (s.forma === "cilindro") {
        const r = Math.hypot(dx, dz);
        return r > 1e-9 ? { d: r - s.raio, nx: dx / r, nz: dz / r } : { d: -s.raio, nx: 1, nz: 0 };
    }
    // para o espaço da caixa (desfaz o giro)
    const c = Math.cos(s.rot);
    const sn = Math.sin(s.rot);
    const lx = dx * c - dz * sn;
    const lz = dx * sn + dz * c;
    const fx = Math.abs(lx) - s.hx;
    const fz = Math.abs(lz) - s.hz;
    let nlx: number;
    let nlz: number;
    let d: number;
    if (fx > 0 || fz > 0) {
        // fora: até o ponto mais perto da borda
        const ex = Math.max(fx, 0) * Math.sign(lx);
        const ez = Math.max(fz, 0) * Math.sign(lz);
        d = Math.hypot(ex, ez);
        nlx = ex / d;
        nlz = ez / d;
    } else if (fx > fz) {
        // dentro: sai pela face mais perto
        d = fx;
        nlx = Math.sign(lx) || 1;
        nlz = 0;
    } else {
        d = fz;
        nlx = 0;
        nlz = Math.sign(lz) || 1;
    }
    // de volta pro andar
    return { d, nx: nlx * c + nlz * sn, nz: -nlx * sn + nlz * c };
}

// este sólido segura quem tem os pés em `pes` e a cabeça em `cabeca`?
function bloqueia(s: Solido, pes: number, cabeca: number) {
    return s.topo > pes + DEGRAU_MAXIMO && s.base < cabeca;
}

function perto(s: Solido, x: number, z: number, folga: number) {
    const a = alcance(s) + folga;
    return Math.abs(x - s.x) < a && Math.abs(z - s.z) < a;
}

// anda de `de` até `para` empurrando pra fora do que bloqueia. Devolve onde parou
export function mover(de: Ponto, para: Ponto, solidos: Solido[], pes: number, cabeca: number, raio = RAIO_JOGADOR): Ponto {
    const dx = para.x - de.x;
    const dz = para.z - de.z;
    const passos = Math.max(1, Math.ceil(Math.hypot(dx, dz) / PASSO));
    let x = de.x;
    let z = de.z;
    for (let i = 0; i < passos; i++) {
        x += dx / passos;
        z += dz / passos;
        // algumas voltas: sair de uma parede pode encostar em outra (quina)
        for (let volta = 0; volta < 4; volta++) {
            let mexeu = false;
            for (const s of solidos) {
                if (!perto(s, x, z, raio) || !bloqueia(s, pes, cabeca)) continue;
                const { d, nx, nz } = distancia(s, x, z);
                if (d >= raio) continue;
                x += nx * (raio - d);
                z += nz * (raio - d);
                mexeu = true;
            }
            if (!mexeu) break;
        }
    }
    return { x, z };
}

// cabe um jogador aqui (sem encostar em nada que bloqueie)?
export function pontoLivre(solidos: Solido[], p: Ponto, pes: number, cabeca = pes + ALTURA_CORPO, raio = RAIO_JOGADOR) {
    return !solidos.some((s) => perto(s, p.x, p.z, raio) && bloqueia(s, pes, cabeca) && distancia(s, p.x, p.z).d < raio);
}

// altura do chão embaixo de você: o topo mais alto que você alcança dali (degrau, móvel)
export function alturaChao(solidos: Solido[], p: Ponto, pes: number) {
    let h = 0;
    for (const s of solidos) {
        if (s.topo <= h || s.topo > pes + DEGRAU_MAXIMO || !perto(s, p.x, p.z, APOIO)) continue;
        if (distancia(s, p.x, p.z).d <= APOIO) h = s.topo;
    }
    return h;
}
