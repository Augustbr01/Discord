// O cinema no estilo da sala gamer: LEDs de duas cores na paleta da sala (a mesma do controle,
// com ciclo RGB e liga/desliga) e um céu de estrelas no teto.
//
// - sanca (A) no alto das paredes, com a luz lavando a parede;
// - bias light (A) contornando o telão, com um brilho atrás;
// - fita (B) na quina de cada degrau, e barras (B) nas paredes compridas no lugar das arandelas.
// As paredes, o piso, os degraus e as poltronas em grafite são do Predio/Moveis.
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { EstadoLed } from "../../tipos";
import { dentro, ESPESSURA, type Degrau, type SalaPlanta } from "./planta";
import { BALDES_LED, Montagem, useMateriaisLed } from "./SalaGamer";
import { repetida, texturaEstrelas } from "./texturas";

const T = 0.04; // espessura do revestimento das paredes (DecoracaoCinema)
const PORTA_MEIA = 0.9;

function montarLeds(sala: SalaPlanta, degraus: Degrau[]) {
    const { ret, lado, porta, altura, tv } = sala;
    const k = new Montagem();
    const plano = (l: number, a: number) => new THREE.PlaneGeometry(l, a);
    const comprimento = ret.z2 - ret.z1;
    const largura = ret.x2 - ret.x1;
    const xc = (ret.x1 + ret.x2) / 2;
    const zc = (ret.z1 + ret.z2) / 2;
    // faces de dentro das paredes (já com o revestimento)
    const x1 = ret.x1 + T;
    const x2 = ret.x2 - T;
    const z1 = ret.z1 + T;
    const z2 = ret.z2 - T;

    // ---------- sanca (A) nas quatro paredes + a luz lavando as compridas e a do fundo ----------
    const cy = altura - 0.06;
    k.caixa("ledA", 0.025, 0.025, comprimento - 0.3, x1 + 0.1, cy, zc);
    k.caixa("ledA", 0.025, 0.025, comprimento - 0.3, x2 - 0.1, cy, zc);
    k.caixa("ledA", largura - 0.3, 0.025, 0.025, xc, cy, z1 + 0.1);
    k.caixa("ledA", largura - 0.3, 0.025, 0.025, xc, cy, z2 - 0.1);
    const lav = 1.1;
    const ly = altura - 0.08 - lav / 2;
    k.por("lavagemA", plano(comprimento - 0.3, lav), x1 + 0.005, ly, zc, 0, Math.PI / 2);
    k.por("lavagemA", plano(comprimento - 0.3, lav), x2 - 0.005, ly, zc, 0, -Math.PI / 2);
    k.por("lavagemA", plano(largura - 0.3, lav), xc, ly, z2 - 0.005, 0, Math.PI);

    // ---------- bias light (A) em volta do telão (na parede da frente, atrás da moldura) ----------
    const L = tv.largura;
    const A = (L * 9) / 16;
    const mx = (L + 0.2) / 2 + 0.05;
    const my = (A + 0.2) / 2 + 0.05;
    const bz = z1 + 0.01;
    k.caixa("ledA", mx * 2 + 0.03, 0.03, 0.02, tv.x, tv.y + my, bz);
    k.caixa("ledA", mx * 2 + 0.03, 0.03, 0.02, tv.x, tv.y - my, bz);
    k.caixa("ledA", 0.03, my * 2, 0.02, tv.x - mx, tv.y, bz);
    k.caixa("ledA", 0.03, my * 2, 0.02, tv.x + mx, tv.y, bz);
    k.por("brilhoA", plano(L + 1.8, A + 1.4), tv.x, tv.y, z1 + 0.003);

    // ---------- fita (B) na quina de cada degrau ----------
    for (const d of degraus) {
        if (!dentro(ret, { x: (d.x1 + d.x2) / 2, z: (d.z1 + d.z2) / 2 })) continue;
        k.caixa("ledB", d.x2 - d.x1 - 0.1, 0.015, 0.015, (d.x1 + d.x2) / 2, d.topo - 0.035, d.z1 - 0.004);
    }

    // ---------- barras (B) nas paredes compridas, a cada 3 m (menos na porta) ----------
    const xDentro = lado > 0 ? x1 : x2; // a parede do corredor (a da porta)
    for (const [x, sentido] of [[x1, 1], [x2, -1]] as const) {
        for (let z = ret.z1 + 3.5; z < ret.z2 - 1; z += 3) {
            if (x === xDentro && Math.abs(z - porta.z) < PORTA_MEIA + 0.6) continue;
            k.caixa("ledB", 0.03, 0.7, 0.03, x + sentido * 0.02, 2.75, z);
            k.por("brilhoB", plano(0.9, 1.8), x + sentido * 0.006, 2.75, z, 0, sentido > 0 ? Math.PI / 2 : -Math.PI / 2);
        }
    }

    return k.juntar();
}

const ESTRELAS = (() => {
    let m: THREE.MeshBasicMaterial | null = null;
    return () => (m ??= new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.85 }));
})();

export function LedsCinema({ sala, degraus, led }: { sala: SalaPlanta; degraus: Degrau[]; led: EstadoLed | null }) {
    const geos = useMemo(() => montarLeds(sala, degraus), [sala, degraus]);
    useEffect(() => () => geos.forEach((g) => g.dispose()), [geos]);
    const mats = useMateriaisLed(sala.canalId, led, false);

    // céu de estrelas: a mesma textura repetida a cada ~3 m
    const { ret, altura } = sala;
    const largura = ret.x2 - ret.x1;
    const comprimento = ret.z2 - ret.z1;
    const estrelas = useMemo(() => repetida(texturaEstrelas(), largura / 3, comprimento / 3), [largura, comprimento]);
    useEffect(() => () => estrelas.dispose(), [estrelas]);
    const ceu = useMemo(() => {
        const m = ESTRELAS().clone();
        m.map = estrelas;
        return m;
    }, [estrelas]);
    useEffect(() => () => ceu.dispose(), [ceu]);

    return (
        <group>
            {BALDES_LED.map((chave) => {
                const g = geos.get(chave);
                return g ? <mesh key={chave} geometry={g} material={mats[chave]} renderOrder={chave.startsWith("led") ? 0 : 2} /> : null;
            })}
            <mesh material={ceu} position={[(ret.x1 + ret.x2) / 2, altura - 0.012, (ret.z1 + ret.z2) / 2]} rotation={[Math.PI / 2, 0, 0]} renderOrder={2}>
                <planeGeometry args={[largura - 2 * ESPESSURA, comprimento - 2 * ESPESSURA]} />
            </mesh>
        </group>
    );
}
