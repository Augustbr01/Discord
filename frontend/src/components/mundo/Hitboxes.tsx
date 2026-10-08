// Contorno de cada sólido da colisão (configuração "Mostrar hitboxes"): pra conferir se a
// hitbox bate com o móvel. Paredes em cinza, móveis e degraus em rosa.
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Solido } from "./colisao";

const PAREDE = new THREE.LineBasicMaterial({ color: "#9a9aa6", toneMapped: false, transparent: true, opacity: 0.35 });
const MOVEL = new THREE.LineBasicMaterial({ color: "#ff3d9a", toneMapped: false });

export function Hitboxes({ solidos }: { solidos: Solido[] }) {
    // todas as arestas numa geometria só por cor (um desenho cada)
    const { paredes, moveis } = useMemo(() => {
        const listas = { paredes: [] as number[], moveis: [] as number[] };
        const aresta = (lista: number[], a: THREE.Vector3, b: THREE.Vector3) => lista.push(a.x, a.y, a.z, b.x, b.y, b.z);
        for (const s of solidos) {
            const altura = s.topo - s.base;
            const lista = s.forma === "caixa" && altura > 2.3 && Math.min(s.hx, s.hz) < 0.15 ? listas.paredes : listas.moveis;
            // contorno no chão do sólido (pontos em volta), repetido embaixo e em cima, com as verticais
            const contorno: [number, number][] = [];
            if (s.forma === "caixa") {
                const c = Math.cos(s.rot);
                const sn = Math.sin(s.rot);
                for (const [lx, lz] of [[-s.hx, -s.hz], [s.hx, -s.hz], [s.hx, s.hz], [-s.hx, s.hz]] as const) {
                    contorno.push([s.x + lx * c + lz * sn, s.z - lx * sn + lz * c]);
                }
            } else {
                for (let i = 0; i < 16; i++) {
                    const a = (i / 16) * Math.PI * 2;
                    contorno.push([s.x + Math.cos(a) * s.raio, s.z + Math.sin(a) * s.raio]);
                }
            }
            contorno.forEach(([x, z], i) => {
                const [nx, nz] = contorno[(i + 1) % contorno.length]!;
                for (const y of [s.base, s.topo]) aresta(lista, new THREE.Vector3(x, y + 0.004, z), new THREE.Vector3(nx, y + 0.004, nz));
                if (s.forma === "caixa" || i % 4 === 0) aresta(lista, new THREE.Vector3(x, s.base, z), new THREE.Vector3(x, s.topo, z));
            });
        }
        const geo = (v: number[]) => new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
        return { paredes: geo(listas.paredes), moveis: geo(listas.moveis) };
    }, [solidos]);
    useEffect(() => () => {
        paredes.dispose();
        moveis.dispose();
    }, [paredes, moveis]);

    return (
        <>
            <lineSegments geometry={paredes} material={PAREDE} renderOrder={10} />
            <lineSegments geometry={moveis} material={MOVEL} renderOrder={10} />
        </>
    );
}
