// Móveis feitos de formas simples. Geometrias e materiais são compartilhados, e as
// peças iguais de todos os móveis são desenhadas juntas (instancing).
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Movel } from "./planta";

const geometrias = new Map<string, THREE.BufferGeometry>();

export function caixaArredondada(l: number, a: number, p: number, raio = 0.05) {
    const chave = `${l}|${a}|${p}|${raio}`;
    let g = geometrias.get(chave);
    if (!g) {
        g = new RoundedBoxGeometry(l, a, p, 3, raio);
        geometrias.set(chave, g);
    }
    return g;
}

const materiais = new Map<string, THREE.MeshStandardMaterial>();

export function material(cor: string, rugosidade = 0.8, metal = 0) {
    const chave = `${cor}|${rugosidade}|${metal}`;
    let m = materiais.get(chave);
    if (!m) {
        m = new THREE.MeshStandardMaterial({ color: cor, roughness: rugosidade, metalness: metal });
        materiais.set(chave, m);
    }
    return m;
}

// clareia (fator > 0) ou escurece (< 0) uma cor
export function tom(cor: string, fator: number) {
    const c = new THREE.Color(cor);
    return `#${(fator >= 0 ? c.lerp(new THREE.Color("#ffffff"), fator) : c.lerp(new THREE.Color("#000000"), -fator)).getHexString()}`;
}

const PERNA = new THREE.CylinderGeometry(0.03, 0.025, 0.1, 10);
const TAMPO = new THREE.CylinderGeometry(0.6, 0.6, 0.05, 6);
const PE = new THREE.CylinderGeometry(0.1, 0.22, 0.4, 6);
const VASO = new THREE.CylinderGeometry(0.24, 0.17, 0.52, 12);
const TERRA = new THREE.CircleGeometry(0.22, 12);
const TRONCO = new THREE.CylinderGeometry(0.025, 0.035, 0.9, 6);
const FOLHA = new THREE.IcosahedronGeometry(0.28, 0);
// folhagem low-poly escura (facetada)
const MATERIAL_FOLHA = new THREE.MeshStandardMaterial({ color: "#1e3f2f", roughness: 0.85, flatShading: true });
const WOOFER = new THREE.CylinderGeometry(0.1, 0.1, 0.02, 24);
const TWEETER = new THREE.CylinderGeometry(0.035, 0.035, 0.02, 16);

// tapete hexagonal com filete
function hexagono(raio: number) {
    const chave = `hexagono|${raio}`;
    let g = geometrias.get(chave);
    if (!g) {
        g = new THREE.CircleGeometry(raio, 6);
        geometrias.set(chave, g);
    }
    return g;
}

function anel(raio: number) {
    const chave = `anel|${raio}`;
    let g = geometrias.get(chave);
    if (!g) {
        g = new THREE.RingGeometry(raio * 0.88, raio * 0.9, 6);
        geometrias.set(chave, g);
    }
    return g;
}

// cada móvel é uma lista de peças (geometria + material + onde fica dentro do móvel)
type Peca = {
    geometria: THREE.BufferGeometry;
    material: THREE.Material;
    pos: [number, number, number];
    giro?: [number, number, number];
    escala?: number;
};

function pecasSofa(cor: string): Peca[] {
    const tecido = material(cor, 0.95);
    const almofada = material(tom(cor, 0.1), 0.95);
    const perna = material("#0c0c0f", 0.5, 0.3);
    return [
        { geometria: caixaArredondada(2.4, 0.36, 0.95, 0.06), material: tecido, pos: [0, 0.28, 0] },
        { geometria: caixaArredondada(2.4, 0.56, 0.24, 0.08), material: tecido, pos: [0, 0.7, -0.36] },
        { geometria: caixaArredondada(0.22, 0.52, 0.95, 0.07), material: tecido, pos: [-1.09, 0.5, 0] },
        { geometria: caixaArredondada(0.22, 0.52, 0.95, 0.07), material: tecido, pos: [1.09, 0.5, 0] },
        ...[-0.65, 0, 0.65].map((x): Peca => ({ geometria: caixaArredondada(0.64, 0.14, 0.68, 0.06), material: almofada, pos: [x, 0.52, 0.08] })),
        ...[-1.05, 1.05].flatMap((x) => [-0.38, 0.38].map((z): Peca => ({ geometria: PERNA, material: perna, pos: [x, 0.05, z] }))),
    ];
}

// mesa hexagonal preta acetinada
function pecasMesa(): Peca[] {
    const preto = material("#0c0c0f", 0.25, 0.4);
    return [
        { geometria: TAMPO, material: preto, pos: [0, 0.44, 0] },
        { geometria: PE, material: material("#0c0c0f", 0.4), pos: [0, 0.2, 0] },
    ];
}

// arbusto em vaso: bolinhas de folhas em volta de um tronco fino
function pecasPlanta(semente: number): Peca[] {
    let s = semente;
    const r = () => {
        s = (s * 16807) % 2147483647;
        return s / 2147483647;
    };
    return [
        { geometria: VASO, material: material("#0c0c0e", 0.5), pos: [0, 0.26, 0] },
        { geometria: TERRA, material: material("#141210", 1), pos: [0, 0.5, 0], giro: [-Math.PI / 2, 0, 0] },
        { geometria: TRONCO, material: material("#2a1d14", 0.9), pos: [0, 0.9, 0] },
        ...Array.from({ length: 6 }, (_, i): Peca => ({
            geometria: FOLHA,
            material: MATERIAL_FOLHA,
            pos: [(r() - 0.5) * 0.45, 0.95 + i * 0.13 + r() * 0.12, (r() - 0.5) * 0.45],
            escala: 0.75 + r() * 0.5,
        })),
    ];
}

// poltrona de cinema: assento e encosto estofados (grafite), braços e laterais pretos
function pecasPoltrona(cor: string): Peca[] {
    const veludo = material(cor, 0.95);
    const escuro = material("#0e0e11", 0.45, 0.3);
    return [
        { geometria: caixaArredondada(0.56, 0.12, 0.5, 0.04), material: veludo, pos: [0, 0.45, 0.02] },
        { geometria: caixaArredondada(0.56, 0.64, 0.12, 0.05), material: veludo, pos: [0, 0.82, -0.25], giro: [-0.12, 0, 0] },
        ...[-0.32, 0.32].flatMap((x): Peca[] => [
            { geometria: caixaArredondada(0.07, 0.6, 0.48, 0.02), material: escuro, pos: [x, 0.3, -0.03] },
            { geometria: caixaArredondada(0.09, 0.06, 0.52, 0.025), material: escuro, pos: [x, 0.63, -0.01] },
        ]),
    ];
}

// torre de som (frente da caixa pra +z)
function pecasTorre(): Peca[] {
    const preto = material("#141414", 0.45);
    const tela = material("#2a2a2d", 1);
    const cone = material("#0b0b0b", 0.35, 0.4);
    return [
        { geometria: caixaArredondada(0.32, 1.1, 0.34, 0.02), material: preto, pos: [0, 0.55, 0] },
        { geometria: caixaArredondada(0.27, 1.0, 0.02, 0.01), material: tela, pos: [0, 0.57, 0.165] },
        { geometria: WOOFER, material: cone, pos: [0, 0.38, 0.18], giro: [Math.PI / 2, 0, 0] },
        { geometria: WOOFER, material: cone, pos: [0, 0.62, 0.18], giro: [Math.PI / 2, 0, 0] },
        { geometria: TWEETER, material: cone, pos: [0, 0.9, 0.18], giro: [Math.PI / 2, 0, 0] },
    ];
}

// pedestal onde fica o tablet do cinema
function pecasPedestal(): Peca[] {
    const escuro = material("#0c0c0f", 0.4, 0.5);
    const latao = material("#2c2d33", 0.3, 0.85);
    return [
        { geometria: caixaArredondada(0.46, 0.04, 0.46, 0.015), material: escuro, pos: [0, 0.02, 0] },
        { geometria: caixaArredondada(0.12, 0.98, 0.12, 0.03), material: latao, pos: [0, 0.51, 0] },
        { geometria: caixaArredondada(0.36, 0.04, 0.28, 0.015), material: escuro, pos: [0, 1.0, 0] },
    ];
}

function pecasTapete(cor: string, raio: number): Peca[] {
    return [
        { geometria: hexagono(raio), material: material(cor, 1), pos: [0, 0.006, 0], giro: [-Math.PI / 2, 0, 0] },
        { geometria: anel(raio), material: material("#2c2c36", 1), pos: [0, 0.007, 0], giro: [-Math.PI / 2, 0, 0] },
    ];
}

function pecas(m: Movel, i: number): Peca[] {
    if (m.tipo === "sofa") return pecasSofa(m.cor ?? "#6b625a");
    if (m.tipo === "mesa") return pecasMesa();
    if (m.tipo === "planta") return pecasPlanta(i * 7919 + 13);
    if (m.tipo === "poltrona") return pecasPoltrona(m.cor ?? "#2a2a33");
    if (m.tipo === "torre") return pecasTorre();
    if (m.tipo === "pedestal") return pecasPedestal();
    return pecasTapete(m.cor ?? "#3b3631", m.raio ?? 2.4);
}

export type Grupo = { geometria: THREE.BufferGeometry; material: THREE.Material; matrizes: THREE.Matrix4[] };

export function Instancias({ geometria, material: mat, matrizes }: Grupo) {
    const ref = useRef<THREE.InstancedMesh>(null);
    useLayoutEffect(() => {
        const malha = ref.current;
        if (!malha) return;
        matrizes.forEach((m, i) => malha.setMatrixAt(i, m));
        malha.instanceMatrix.needsUpdate = true;
        malha.computeBoundingSphere();
    }, [matrizes]);
    return <instancedMesh ref={ref} args={[geometria, mat, matrizes.length]} />;
}

// todas as peças iguais (mesma geometria e material) de todos os móveis do andar
// viram um desenho só: um andar com 12 sofás e 13 plantas fica em ~25 desenhos, não ~250
export function Moveis({ moveis }: { moveis: Movel[] }) {
    const grupos = useMemo(() => {
        const mapa = new Map<string, Grupo>();
        const doMovel = new THREE.Matrix4();
        const daPeca = new THREE.Matrix4();
        const giro = new THREE.Quaternion();
        const euler = new THREE.Euler();
        const pos = new THREE.Vector3();
        const escala = new THREE.Vector3();

        moveis.forEach((m, i) => {
            doMovel.makeRotationY(m.rot).setPosition(m.x, m.y ?? 0, m.z);
            for (const p of pecas(m, i)) {
                giro.setFromEuler(euler.set(...(p.giro ?? [0, 0, 0])));
                daPeca.compose(pos.set(...p.pos), giro, escala.setScalar(p.escala ?? 1));
                const chave = `${p.geometria.uuid}|${p.material.uuid}`;
                const grupo = mapa.get(chave) ?? { geometria: p.geometria, material: p.material, matrizes: [] };
                grupo.matrizes.push(doMovel.clone().multiply(daPeca));
                mapa.set(chave, grupo);
            }
        });
        return [...mapa.entries()];
    }, [moveis]);

    return (
        <>
            {grupos.map(([chave, g]) => (
                <Instancias key={`${chave}|${g.matrizes.length}`} {...g} />
            ))}
        </>
    );
}
