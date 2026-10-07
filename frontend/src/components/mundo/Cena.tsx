// O canvas 3D e o que vai dentro dele (luz, prédio, elevador, você e os outros).
//
// O canvas fica montado o tempo todo que o 3D está aberto: trocar de andar (ou criar/apagar
// canal) só troca o conteúdo, que entra nele por um "túnel". Assim existe um contexto WebGL
// só — criar e destruir contexto toda hora estressa a placa de vídeo (e o Chrome desliga a
// aceleração se o processo da GPU travar algumas vezes).
import { Suspense, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Environment, Lightformer } from "@react-three/drei";
import tunnel from "tunnel-rat";
import type { Participant, Room, Track } from "livekit-client";
import type { ServidorDetalhe, Usuario } from "../../api";
import { AudioEspacial, type SomDaTV } from "./AudioEspacial";
import { Boneco } from "./Boneco";
import { Elevador } from "./Elevador";
import { Jogador, type ControleToque, type PedidoJogador } from "./Jogador";
import type { Interativo, Planta, Ponto } from "./planta";
import { Predio, type YoutubeNaTV } from "./Predio";
import type { Pose } from "./rede";

export type Pessoa = {
    usuario: Usuario;
    lerAlvo: () => Pose | undefined;
    participante?: Participant | undefined;
    camera?: Track | undefined;
    telas: Track[];
};

type Props = {
    planta: Planta;
    servidor: ServidorDetalhe;
    andar: number;
    pose: RefObject<Pose>;
    pessoas: Pessoa[];
    posicoes: Map<string, Ponto>;
    pessoasPorSala: Map<string, number>;
    salaDaCall: string | null;
    telaDaSala: Track | undefined;
    youtube: YoutubeNaTV | undefined;
    portaAberta: boolean;
    portaFechada: RefObject<boolean>;
    parado: boolean;
    toque: RefObject<ControleToque>;
    pedido: RefObject<PedidoJogador | null>;
    sala: Room | undefined;
    surdo: boolean;
    // call do hall: a voz cai mais com a distância (conversa de corredor)
    proximidade: boolean;
    // luz apagada (cinema com filme rolando, ou escolhido no controle da sala): a TV ilumina a sala
    escuro: boolean;
    telao: { x: number; y: number; z: number; rot: number } | null;
    // a tela que está na TV da sala, pras caixas de som
    somTV: SomDaTV | null;
    onSala: (id: string | null) => void;
    onFoco: (it: Interativo | null) => void;
    onTravado: (travado: boolean) => void;
    onPostura: (postura: number) => void;
    // velocidade no chão, pro velocímetro
    velocidade: RefObject<number>;
};

export type Tunel = ReturnType<typeof tunnel>;
export const criarTunel = tunnel;

export function CanvasMundo({ tunel, onContexto }: { tunel: Tunel; onContexto: (perdido: boolean) => void }) {
    return (
        <Canvas
            className="mundo-canvas"
            dpr={[1, 1.5]}
            gl={{ antialias: true, powerPreference: "high-performance" }}
            camera={{ fov: 72, near: 0.05, far: 120, position: [0, 1.62, 0] }}
            onCreated={({ gl }) => {
                // a placa de vídeo pode "reiniciar" (driver, falta de memória); o three tenta voltar
                // sozinho, e se não voltar o Mundo3D oferece recarregar
                gl.domElement.addEventListener("webglcontextlost", () => onContexto(true));
                gl.domElement.addEventListener("webglcontextrestored", () => onContexto(false));
            }}
        >
            <color attach="background" args={["#0c0b0a"]} />
            <fog attach="fog" args={["#0c0b0a", 26, 80]} />

            {/* reflexos: um "estúdio" de luzes gerado uma vez só, sem baixar nada */}
            <Environment resolution={256} frames={1} environmentIntensity={0.55}>
                <color attach="background" args={["#1a1714"]} />
                <Lightformer form="rect" intensity={2.2} color="#ffe7c7" position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[14, 3, 1]} />
                <Lightformer form="rect" intensity={1.2} color="#ffd9a8" position={[-8, 2, 6]} rotation-y={Math.PI / 2} scale={[10, 2, 1]} />
                <Lightformer form="rect" intensity={1.2} color="#cfd8ff" position={[8, 2, 6]} rotation-y={-Math.PI / 2} scale={[10, 2, 1]} />
                <Lightformer form="ring" intensity={1.5} color="#fff3e0" position={[0, 3, -10]} scale={4} />
            </Environment>

            <tunel.Out />
        </Canvas>
    );
}

// luz geral do andar. Escurece aos poucos (uns 2 s) quando o filme começa no cinema;
// só quem está lá dentro vê, porque as paredes do cinema tapam o resto
function Luzes({ escuro, telao }: { escuro: boolean; telao: Props["telao"] }) {
    const hemisferio = useRef<THREE.HemisphereLight>(null);
    const sol = useRef<THREE.DirectionalLight>(null);
    const ambiente = useRef<THREE.AmbientLight>(null);
    const tela = useRef<THREE.PointLight>(null);
    const nivel = useRef(0);
    const cena = useThree((s) => s.scene);

    useFrame((_, delta) => {
        nivel.current += ((escuro ? 1 : 0) - nivel.current) * Math.min(1, delta * 1.5);
        const n = nivel.current;
        if (hemisferio.current) hemisferio.current.intensity = 2.4 * (1 - n * 0.88);
        if (sol.current) sol.current.intensity = 0.8 * (1 - n * 0.95);
        if (ambiente.current) ambiente.current.intensity = 0.9 * (1 - n * 0.85);
        if (tela.current) tela.current.intensity = n * 5;
        cena.environmentIntensity = 0.55 * (1 - n * 0.85);
    });

    return (
        <>
            {/* luz física: ambiente/hemisfério precisam de intensidade alta pra clarear teto e paredes */}
            <hemisphereLight ref={hemisferio} args={["#fff1e0", "#9a8775", 2.4]} />
            <directionalLight ref={sol} position={[4, 10, 6]} intensity={0.8} color="#ffe9cf" />
            <ambientLight ref={ambiente} intensity={0.9} color="#ffe2c4" />
            {/* o brilho da TV / telão na sala escura (apagado no resto do tempo) */}
            <pointLight
                ref={tela}
                position={telao ? [telao.x + Math.sin(telao.rot) * 2.5, telao.y, telao.z + Math.cos(telao.rot) * 2.5] : [0, -50, 0]}
                color="#c4d0ff"
                intensity={0}
                distance={18}
                decay={1.2}
            />
        </>
    );
}

// o andar em si (entra no CanvasMundo pelo túnel)
export function Cena(props: Props) {
    const { planta, pose } = props;

    return (
        <>
            <Luzes escuro={props.escuro} telao={props.telao} />

            <Suspense fallback={null}>
                <Predio
                    planta={planta}
                    servidor={props.servidor}
                    andar={props.andar}
                    pessoasPorSala={props.pessoasPorSala}
                    salaDaCall={props.salaDaCall}
                    telaDaSala={props.telaDaSala}
                    youtube={props.youtube}
                    salaEscura={props.escuro ? props.salaDaCall : null}
                />
                <Elevador planta={planta} andar={props.andar} aberta={props.portaAberta} />
                {props.pessoas.map((p) => (
                    <Boneco
                        key={p.usuario.id}
                        usuario={p.usuario}
                        lerAlvo={p.lerAlvo}
                        participante={p.participante}
                        camera={p.camera}
                        telas={p.telas}
                        posicoes={props.posicoes}
                        degraus={planta.degraus}
                    />
                ))}
            </Suspense>

            <Jogador
                planta={planta}
                pose={pose}
                parado={props.parado}
                portaFechada={props.portaFechada}
                toque={props.toque}
                pedido={props.pedido}
                onSala={props.onSala}
                onFoco={props.onFoco}
                onTravado={props.onTravado}
                onPostura={props.onPostura}
                velocidade={props.velocidade}
            />
            <AudioEspacial sala={props.sala} posicoes={props.posicoes} surdo={props.surdo} tv={props.somTV} proximidade={props.proximidade} />
        </>
    );
}
