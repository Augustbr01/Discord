// Cabine do elevador no fundo do hall. As portas abrem quando você chega no andar
// e fecham quando você escolhe outro.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { material } from "./Moveis";
import { ALTURA_ELEVADOR, ESPESSURA, type Planta } from "./planta";
import { texturaTexto } from "./texturas";

// aço escovado escuro, moldura preta com fita de LED (Neon, como o hall)
const ACO = material("#5a5c63", 0.3, 0.9);
const LATAO = material("#0c0c0f", 0.4, 0.5);
const PRETO = material("#0c0c0d", 0.4, 0.3);
const LUZ = new THREE.MeshBasicMaterial({ color: "#eef1ff", toneMapped: false });
const BOTAO = new THREE.MeshBasicMaterial({ color: new THREE.Color("#22d3ee").multiplyScalar(1.5), toneMapped: false });
const FITA = new THREE.MeshBasicMaterial({ color: new THREE.Color("#8b5cf6").multiplyScalar(1.5), toneMapped: false });
const CAIXA = new THREE.BoxGeometry(1, 1, 1);

type Props = { planta: Planta; andar: number; aberta: boolean };

export function Elevador({ planta, andar, aberta }: Props) {
    const H = planta.hall.z2;
    const { x1, x2, z2 } = planta.elevador;
    const esquerda = useRef<THREE.Mesh>(null);
    const direita = useRef<THREE.Mesh>(null);
    const abertura = useRef(0);

    useFrame((_, delta) => {
        abertura.current = THREE.MathUtils.damp(abertura.current, aberta ? 1 : 0, 3.2, delta);
        const x = 0.55 + abertura.current * 1.08;
        if (esquerda.current) esquerda.current.position.x = -x;
        if (direita.current) direita.current.position.x = x;
    });

    const visor = useMemo(
        () => texturaTexto([{ texto: `▲ ${andar}`, tamanho: 120, cor: "#22d3ee", peso: 600 }], { largura: 512, altura: 220, fundo: "#060606", raio: 16 }),
        [andar],
    );
    useEffect(() => () => visor.textura.dispose(), [visor]);

    const frente = H - ESPESSURA / 2;

    return (
        <group>
            {/* portas de aço (correm pra dentro da parede) */}
            {[esquerda, direita].map((ref, i) => (
                <mesh key={i} ref={ref} geometry={CAIXA} material={ACO} position={[i === 0 ? -0.55 : 0.55, 1.2, H]} scale={[1.1, 2.4, 0.05]} />
            ))}

            {/* moldura de latão do lado do hall */}
            {[-1, 1].map((s) => (
                <mesh key={s} geometry={CAIXA} material={LATAO} position={[s * 1.17, 1.24, frente - 0.02]} scale={[0.14, 2.48, 0.05]} />
            ))}
            <mesh geometry={CAIXA} material={LATAO} position={[0, 2.46, frente - 0.02]} scale={[2.48, 0.12, 0.05]} />
            {/* fita de LED contornando a moldura */}
            {[-1, 1].map((s) => (
                <mesh key={s} geometry={CAIXA} material={FITA} position={[s * 1.25, 1.26, frente - 0.03]} scale={[0.02, 2.52, 0.02]} />
            ))}
            <mesh geometry={CAIXA} material={FITA} position={[0, 2.53, frente - 0.03]} scale={[2.52, 0.02, 0.02]} />

            {/* visor com o número do andar */}
            <mesh geometry={CAIXA} material={PRETO} position={[0, 2.86, frente - 0.02]} scale={[0.66, 0.32, 0.04]} />
            <mesh position={[0, 2.86, frente - 0.045]} rotation={[0, Math.PI, 0]}>
                <planeGeometry args={[0.6, 0.6 / visor.aspecto]} />
                <meshBasicMaterial map={visor.textura} toneMapped={false} />
            </mesh>

            {/* botão de chamar, ao lado da porta */}
            <mesh geometry={CAIXA} material={LATAO} position={[1.55, 1.25, frente - 0.015]} scale={[0.16, 0.28, 0.03]} />
            <mesh position={[1.55, 1.25, frente - 0.035]} geometry={CAIXA} material={BOTAO} scale={[0.05, 0.05, 0.01]} />

            {/* dentro da cabine */}
            <mesh position={[0, ALTURA_ELEVADOR, (H + z2) / 2]} rotation={[Math.PI / 2, 0, 0]} material={PRETO}>
                <planeGeometry args={[x2 - x1, z2 - H]} />
            </mesh>
            <mesh position={[0, ALTURA_ELEVADOR - 0.015, (H + z2) / 2]} geometry={CAIXA} material={LUZ} scale={[1.7, 0.02, 1.5]} />
            <mesh position={[0, 0.95, z2 - ESPESSURA / 2 - 0.07]} rotation={[0, 0, Math.PI / 2]} material={LATAO}>
                <cylinderGeometry args={[0.025, 0.025, 2.1, 12]} />
            </mesh>
            {/* painel de andares na parede direita da cabine */}
            <group position={[x2 - ESPESSURA / 2 - 0.012, 1.3, H + 0.55]} rotation={[0, -Math.PI / 2, 0]}>
                <mesh geometry={CAIXA} material={PRETO} scale={[0.26, 0.56, 0.02]} />
                {Array.from({ length: 8 }, (_, i) => (
                    <mesh key={i} geometry={CAIXA} material={i === 0 ? BOTAO : ACO} position={[(i % 2 ? 0.05 : -0.05), 0.19 - Math.floor(i / 2) * 0.11, 0.014]} scale={[0.045, 0.045, 0.01]} />
                ))}
            </group>
        </group>
    );
}
