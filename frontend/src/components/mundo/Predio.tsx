// O andar em si: paredes, pisos, tetos, luzes, janelas, letreiros, quadros e TVs.
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { useThree, type ThreeElements } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { Track } from "livekit-client";
import type { Canal, ServidorDetalhe } from "../../api";
import type { ComandoYoutube, EstadoYoutube } from "../../tipos";
import { PlayerYoutube } from "../youtube/PlayerYoutube";
import { useTexturaVideo } from "./midia";
import { material, Moveis, tom } from "./Moveis";
import {
    ALTURA, ALTURA_HALL, ALTURA_PORTA, ESPESSURA, dentro,
    type Degrau, type Parede, type Planta, type Ret, type SalaPlanta, type TipoParede,
} from "./planta";

const PORTA_MEIA = 0.9;
import {
    repetida, texturaCarpete, texturaCidade, texturaLuz, texturaMadeira, texturaPiso, texturaRipado, texturaTexto,
    type LinhaTexto,
} from "./texturas";

const COR_PAREDE: Record<TipoParede, THREE.MeshStandardMaterial> = {
    parede: material("#8a8076", 0.92),
    hall: material("#7a7067", 0.9),
    metal: material("#a3a5aa", 0.3, 0.85),
};
const RODAPE = material("#1d1b19", 0.6);
const TETO = material("#6e665e", 0.95);
const MADEIRA_ESCURA = material("#2e231c", 0.55);
const LATAO = material("#b8955c", 0.32, 0.85);

const BRILHO = new THREE.MeshBasicMaterial({ color: "#fff0d8", toneMapped: false });
const BRILHO_FRACO = new THREE.MeshBasicMaterial({ color: "#6b6154", toneMapped: false });

const CAIXA_SOM = material("#151516", 0.45);
const TELA_SOM = material("#2a2a2d", 1);

// cinema: tecido escuro nas paredes, teto preto, carpete dos degraus e luzinhas de escada
const TECIDO_CINEMA = material("#2b2326", 1);
const TETO_CINEMA = material("#141112", 1);
const DEGRAU_CINEMA = material("#3a2426", 1);
const LUZ_ESCADA = new THREE.MeshBasicMaterial({ color: "#d9a35b", toneMapped: false });
const ARANDELA = new THREE.MeshBasicMaterial({ color: "#ffcf8a", toneMapped: false });
const VELUDO = new THREE.MeshStandardMaterial({ color: "#6e1418", roughness: 0.9, side: THREE.DoubleSide });

// cortina com dobras: um plano com ondas
const DOBRAS = (() => {
    const g = new THREE.PlaneGeometry(1.4, 1, 28, 1);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 22) * 0.05);
    g.computeVertexNormals();
    return g;
})();

const CAIXA = new THREE.BoxGeometry(1, 1, 1);
const PLANO = new THREE.PlaneGeometry(1, 1);

// muitas caixas com o mesmo material num desenho só (paredes, rodapés)
function Caixas({ caixas, material: mat }: { caixas: Parede[]; material: THREE.Material }) {
    const ref = useRef<THREE.InstancedMesh>(null);

    useLayoutEffect(() => {
        const malha = ref.current;
        if (!malha) return;
        const m = new THREE.Matrix4();
        const pos = new THREE.Vector3();
        const escala = new THREE.Vector3();
        const giro = new THREE.Quaternion();
        caixas.forEach((c, i) => {
            pos.set((c.x1 + c.x2) / 2, (c.base + c.topo) / 2, (c.z1 + c.z2) / 2);
            escala.set(c.x2 - c.x1, c.topo - c.base, c.z2 - c.z1);
            malha.setMatrixAt(i, m.compose(pos, giro, escala));
        });
        malha.instanceMatrix.needsUpdate = true;
        malha.computeBoundingSphere();
    }, [caixas]);

    if (caixas.length === 0) return null;
    return <instancedMesh key={caixas.length} ref={ref} args={[CAIXA, mat, caixas.length]} />;
}

function Piso({ ret, textura, metros, rugosidade, y = 0, cor = "#ffffff" }: { ret: Ret; textura: THREE.Texture; metros: number; rugosidade: number; y?: number; cor?: string }) {
    const largura = ret.x2 - ret.x1;
    const fundo = ret.z2 - ret.z1;
    const mapa = useMemo(() => repetida(textura, largura / metros, fundo / metros), [textura, largura, fundo, metros]);
    useEffect(() => () => mapa.dispose(), [mapa]);
    return (
        <mesh geometry={PLANO} position={[(ret.x1 + ret.x2) / 2, y, (ret.z1 + ret.z2) / 2]} rotation={[-Math.PI / 2, 0, 0]} scale={[largura, fundo, 1]}>
            <meshStandardMaterial map={mapa} roughness={rugosidade} color={cor} />
        </mesh>
    );
}

function Teto({ ret, altura, mat = TETO }: { ret: Ret; altura: number; mat?: THREE.Material }) {
    return (
        <mesh
            geometry={PLANO}
            material={mat}
            position={[(ret.x1 + ret.x2) / 2, altura, (ret.z1 + ret.z2) / 2]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[ret.x2 - ret.x1, ret.z2 - ret.z1, 1]}
        />
    );
}

// mancha de luz pintada no chão
function PocaDeLuz({ x, z, raio, forca = 1 }: { x: number; z: number; raio: number; forca?: number }) {
    return (
        <mesh geometry={PLANO} position={[x, 0.012, z]} rotation={[-Math.PI / 2, 0, 0]} scale={[raio * 2, raio * 2, 1]} renderOrder={1}>
            <meshBasicMaterial map={texturaLuz()} transparent opacity={forca} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
    );
}

type PlacaProps = ThreeElements["group"] & {
    linhas: (string | LinhaTexto)[];
    opcoes?: Parameters<typeof texturaTexto>[1];
    largura: number;
};

// texto desenhado num plano (letreiros, plaquinhas, quadros)
function Placa({ linhas, opcoes, largura, ...grupo }: PlacaProps) {
    // recria a textura só quando o texto muda de verdade (não a cada render)
    const chave = JSON.stringify([linhas, opcoes]);
    const { textura, aspecto } = useMemo(() => texturaTexto(linhas, opcoes), [chave]);
    useEffect(() => () => textura.dispose(), [textura]);
    return (
        <group {...grupo}>
            <mesh geometry={PLANO} scale={[largura, largura / aspecto, 1]}>
                <meshBasicMaterial map={textura} transparent toneMapped={false} />
            </mesh>
        </group>
    );
}

// janela com a cidade lá fora. Fica colada na parede, virada pra dentro
function Janela({ largura, altura, semente, ...grupo }: ThreeElements["group"] & { largura: number; altura: number; semente: number }) {
    const vaos = Math.max(1, Math.round(largura / 1.4));
    return (
        <group {...grupo}>
            <mesh geometry={PLANO} scale={[largura, altura, 1]}>
                <meshBasicMaterial map={texturaCidade(semente)} toneMapped={false} />
            </mesh>
            {/* caixilhos */}
            {Array.from({ length: vaos + 1 }, (_, i) => (
                <mesh key={i} geometry={CAIXA} material={MADEIRA_ESCURA} position={[-largura / 2 + (i * largura) / vaos, 0, 0.03]} scale={[0.07, altura + 0.07, 0.06]} />
            ))}
            <mesh geometry={CAIXA} material={MADEIRA_ESCURA} position={[0, altura / 2, 0.03]} scale={[largura + 0.07, 0.07, 0.06]} />
            <mesh geometry={CAIXA} material={MADEIRA_ESCURA} position={[0, -altura / 2, 0.06]} scale={[largura + 0.2, 0.08, 0.16]} />
        </group>
    );
}

// YouTube junto tocando na TV da sala da sua call
export type YoutubeNaTV = {
    estado: EstadoYoutube;
    posicaoAgora: () => number;
    enviar: (comando: ComandoYoutube) => void;
    volume: RefObject<number>;
    mudo: boolean;
};

// tamanho do player em px: o drei converte px em metros por distanceFactor / 400
const PX_YOUTUBE = 1280;

// TV da sala (ou o telão do cinema): o YouTube junto ou a tela compartilhada da call em que
// você está, ou o nome da sala
function TV({ sala, nome, tela, youtube }: { sala: SalaPlanta; nome: string; tela: Track | undefined; youtube: YoutubeNaTV | undefined }) {
    const cinema = sala.modelo === "CINEMA";
    const video = useTexturaVideo(tela, cinema ? 1920 : 1280, cinema ? 1080 : 720);
    // onde o <Html> pendura o iframe: sem isso o drei troca de elemento quando o canvas
    // liga os eventos, recria a raiz React e o player some (a raiz velha apaga a nova)
    const gl = useThree((s) => s.gl);
    const portal = useMemo(() => ({ current: gl.domElement.parentElement as HTMLElement }), [gl]);
    const L = sala.tv.largura;
    const A = L * 9 / 16;
    // a tela cabe inteira dentro do 16:9, com faixa preta se precisar
    const [vl, va] = video ? (video.aspecto > 16 / 9 ? [L, L / video.aspecto] : [A * video.aspecto, A]) : [L, A];

    return (
        <group position={[sala.tv.x, sala.tv.y, sala.tv.z]} rotation={[0, sala.tv.rot, 0]}>
            {cinema ? (
                // cortinas de veludo dos dois lados do telão
                [-1, 1].map((s) => (
                    <mesh key={s} geometry={DOBRAS} material={VELUDO} position={[s * (L / 2 + 0.42), sala.altura / 2 - sala.tv.y - 0.1, 0.12]} scale={[0.56, sala.altura - 0.25, 1]} />
                ))
            ) : (
                // painel de cor da sala atrás da TV
                <mesh geometry={CAIXA} material={material(tom(sala.cor, -0.35), 0.9)} position={[0, -0.1, -0.02]} scale={[4.4, 3.0, 0.03]} />
            )}
            <mesh geometry={CAIXA} material={material("#0b0b0c", 0.25, 0.4)} position={[0, 0, 0.02]} scale={[L + (cinema ? 0.2 : 0.08), A + (cinema ? 0.2 : 0.08), 0.05]} />
            {youtube ? (
                // o YouTube não vira textura (iframe de outro site): o próprio iframe fica atrás
                // do canvas, posicionado em 3D, e um plano "fura" o canvas onde é a tela da TV
                <Html transform occlude="blending" portal={portal} position={[0, 0, 0.05]} distanceFactor={(L / PX_YOUTUBE) * 400}>
                    <div className="youtube-tv" style={{ width: PX_YOUTUBE, height: (PX_YOUTUBE * 9) / 16 }}>
                        <PlayerYoutube
                            estado={youtube.estado}
                            posicaoAgora={youtube.posicaoAgora}
                            enviar={youtube.enviar}
                            volume={youtube.volume}
                            mudo={youtube.mudo}
                            clicavel={false}
                        />
                    </div>
                </Html>
            ) : video ? (
                <mesh geometry={PLANO} position={[0, 0, 0.05]} scale={[vl, va, 1]}>
                    <meshBasicMaterial map={video.textura} toneMapped={false} />
                </mesh>
            ) : (
                <Placa
                    position={[0, 0, 0.05]}
                    largura={L}
                    linhas={cinema
                        ? [{ texto: "CINEMA", tamanho: 40, cor: "#d9a35b", peso: 700 }, { texto: nome, tamanho: 84, peso: 700 }, { texto: "Coloque um vídeo do YouTube ou compartilhe a tela", tamanho: 26, cor: "#85858e", peso: 500 }]
                        : [{ texto: nome, tamanho: 64, peso: 600 }, { texto: "Ninguém compartilhando a tela", tamanho: 30, cor: "#85858e", peso: 500 }]}
                    opcoes={{ largura: 1024, altura: 576, fundo: "#101013" }}
                />
            )}
        </group>
    );
}

function Porta({ sala, nome, pessoas }: { sala: SalaPlanta; nome: string; pessoas: number }) {
    const { porta, lado } = sala;
    const virada = -lado * Math.PI / 2; // de frente pro corredor
    const meia = 0.9;
    return (
        <group>
            {/* batentes */}
            {[-1, 1].map((s) => (
                <mesh key={s} geometry={CAIXA} material={MADEIRA_ESCURA} position={[porta.x, ALTURA_PORTA / 2, porta.z + s * (meia + 0.04)]} scale={[ESPESSURA + 0.08, ALTURA_PORTA, 0.08]} />
            ))}
            <mesh geometry={CAIXA} material={MADEIRA_ESCURA} position={[porta.x, ALTURA_PORTA + 0.04, porta.z]} scale={[ESPESSURA + 0.08, 0.08, meia * 2 + 0.16]} />
            {/* filete aceso quando tem gente lá dentro */}
            <mesh
                geometry={CAIXA}
                material={pessoas > 0 ? BRILHO : BRILHO_FRACO}
                position={[porta.x - lado * (ESPESSURA / 2 + 0.045), ALTURA_PORTA - 0.01, porta.z]}
                scale={[0.01, 0.025, meia * 2]}
            />
            <Placa
                position={[porta.x - lado * (ESPESSURA / 2 + 0.012), 2.82, porta.z]}
                rotation={[0, virada, 0]}
                largura={1.5}
                linhas={[
                    { texto: sala.modelo === "CINEMA" ? `Cinema · ${nome}` : nome, tamanho: 58, peso: 600 },
                    { texto: pessoas === 0 ? "vazia" : pessoas === 1 ? "1 pessoa" : `${pessoas} pessoas`, tamanho: 34, cor: pessoas > 0 ? "#f3d9ad" : "#85858e", peso: 500 },
                ]}
                opcoes={{ largura: 768, altura: 220, fundo: "rgba(14, 13, 12, 0.92)", raio: 18 }}
            />
        </group>
    );
}

// por dentro do cinema: tecido nas paredes (com o vão da porta), arandelas e luz nos degraus
function DecoracaoCinema({ sala, degraus }: { sala: SalaPlanta; degraus: Degrau[] }) {
    const { ret, lado, porta, altura } = sala;
    const caixas = useMemo(() => {
        const t = 0.04;
        const xFora = lado > 0 ? ret.x2 : ret.x1;
        const xDentro = lado > 0 ? ret.x1 : ret.x2;
        const faixaX = (x: number, para: number) => (para > 0 ? { x1: x, x2: x + t } : { x1: x - t, x2: x });
        const parede = (r: Ret, base = 0, topo = altura): Parede => ({ ...r, base, topo, tipo: "parede" });
        const fora = faixaX(xFora, -lado);
        const dentroX = faixaX(xDentro, lado);
        const z1Porta = porta.z - PORTA_MEIA - 0.06;
        const z2Porta = porta.z + PORTA_MEIA + 0.06;
        return {
            tecido: [
                parede({ ...fora, z1: ret.z1, z2: ret.z2 }),
                parede({ x1: ret.x1, x2: ret.x2, z1: ret.z1, z2: ret.z1 + t }),
                parede({ x1: ret.x1, x2: ret.x2, z1: ret.z2 - t, z2: ret.z2 }),
                parede({ ...dentroX, z1: ret.z1, z2: z1Porta }),
                parede({ ...dentroX, z1: z2Porta, z2: ret.z2 }),
                parede({ ...dentroX, z1: z1Porta, z2: z2Porta }, ALTURA_PORTA + 0.08, altura),
            ],
            // arandelas nas duas paredes compridas, a cada 3 m (menos em cima da porta)
            arandelas: [fora, dentroX].flatMap((faixa, i) => {
                const lista: Parede[] = [];
                for (let z = ret.z1 + 3.5; z < ret.z2 - 1; z += 3) {
                    if (i === 1 && Math.abs(z - porta.z) < 1.4) continue;
                    const x = (faixa.x1 + faixa.x2) / 2 + (i === 0 ? -lado : lado) * 0.04;
                    lista.push({ x1: x - 0.04, x2: x + 0.04, z1: z - 0.14, z2: z + 0.14, base: 2.5, topo: 2.85, tipo: "parede" });
                }
                return lista;
            }),
            degraus: degraus.filter((d) => dentro(ret, { x: (d.x1 + d.x2) / 2, z: (d.z1 + d.z2) / 2 })).map((d) => parede(d, 0, d.topo)),
            // filete de luz na quina de cada degrau
            luzes: degraus.filter((d) => dentro(ret, { x: (d.x1 + d.x2) / 2, z: (d.z1 + d.z2) / 2 }))
                .map((d) => parede({ x1: d.x1, x2: d.x2, z1: d.z1 - 0.012, z2: d.z1 + 0.004 }, d.topo - 0.05, d.topo - 0.02)),
        };
    }, [ret, lado, porta, altura, degraus]);

    return (
        <group>
            <Caixas caixas={caixas.tecido} material={TECIDO_CINEMA} />
            <Caixas caixas={caixas.arandelas} material={ARANDELA} />
            <Caixas caixas={caixas.degraus} material={DEGRAU_CINEMA} />
            <Caixas caixas={caixas.luzes} material={LUZ_ESCADA} />
        </group>
    );
}

// soundbar embaixo da TV e caixas de parede (as torres e o pedestal são móveis instanciados)
function CaixasSom({ sala }: { sala: SalaPlanta }) {
    return (
        <>
            {sala.caixasSom.filter((c) => c.tipo === "barra" || c.tipo === "parede").map((c, i) => (
                <group key={i} position={[c.x, c.y, c.z]} rotation={[0, c.rot, 0]}>
                    <mesh
                        geometry={CAIXA}
                        material={CAIXA_SOM}
                        scale={c.tipo === "barra" ? [1.5, 0.11, 0.12] : [0.28, 0.42, 0.2]}
                    />
                    <mesh
                        geometry={CAIXA}
                        material={TELA_SOM}
                        position={[0, 0, c.tipo === "barra" ? 0.061 : 0.101]}
                        scale={c.tipo === "barra" ? [1.44, 0.08, 0.004] : [0.24, 0.38, 0.004]}
                    />
                </group>
            ))}
        </>
    );
}

// o tablet do controle da sala, com a tela acesa
function Tablet({ sala }: { sala: SalaPlanta }) {
    const { tablet } = sala;
    return (
        <group position={[tablet.x, tablet.y, tablet.z]} rotation={[0, tablet.rot, 0]}>
            <group rotation={[tablet.inclinacao, 0, 0]}>
                <mesh geometry={CAIXA} material={material("#111113", 0.3, 0.4)} scale={[0.3, 0.2, 0.014]} />
                <Placa
                    position={[0, 0, 0.0075]}
                    largura={0.27}
                    linhas={[
                        { texto: "CONTROLE DA SALA", tamanho: 30, cor: "#d9b77e", peso: 700 },
                        { texto: "TV  ·  Som  ·  Luzes", tamanho: 44, peso: 600 },
                        { texto: "YouTube junto", tamanho: 32, cor: "#b4b4bb", peso: 500 },
                    ]}
                    opcoes={{ largura: 512, altura: 360, fundo: "#16161a" }}
                />
            </group>
        </group>
    );
}

// apagada: a sala está com a luz desligada (controle da sala)
function Luminaria({ x, z, apagada }: { x: number; z: number; apagada: boolean }) {
    return (
        <group position={[x, 0, z]}>
            <mesh geometry={CAIXA} material={RODAPE} position={[0, (ALTURA + 2.55) / 2, 0]} scale={[0.015, ALTURA - 2.55, 0.015]} />
            <mesh position={[0, 2.55, 0]}>
                <cylinderGeometry args={[0.22, 0.5, 0.26, 32, 1, true]} />
                <meshStandardMaterial color="#1f1c19" roughness={0.5} metalness={0.6} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 2.43, 0]} rotation={[Math.PI / 2, 0, 0]} material={apagada ? BRILHO_FRACO : BRILHO}>
                <circleGeometry args={[0.46, 32]} />
            </mesh>
            {!apagada && <PocaDeLuz x={0} z={0} raio={2.6} forca={0.9} />}
        </group>
    );
}

type Props = {
    planta: Planta;
    servidor: ServidorDetalhe;
    andar: number;
    pessoasPorSala: Map<string, number>;
    // sala da call em que você está (se for deste andar) e a tela que aparece na TV dela
    salaDaCall: string | null;
    telaDaSala: Track | undefined;
    youtube: YoutubeNaTV | undefined;
    // sala com a luz apagada agora (a luminária dela também apaga)
    salaEscura: string | null;
};

export function Predio({ planta, servidor, andar, pessoasPorSala, salaDaCall, telaDaSala, youtube, salaEscura }: Props) {
    const { hall, corredor, elevador, salas, quadros } = planta;
    const H = hall.z2;
    const canais = useMemo(() => new Map<string, Canal>(servidor.canais.map((c) => [c.id, c])), [servidor.canais]);

    const porTipo = useMemo(() => {
        const grupos: Record<TipoParede, Parede[]> = { parede: [], hall: [], metal: [] };
        for (const p of [...planta.paredes, ...planta.vergas]) grupos[p.tipo].push(p);
        return grupos;
    }, [planta]);

    const rodapes = useMemo(
        () => planta.paredes
            .filter((p) => p.tipo !== "metal")
            .map((p) => ({ ...p, x1: p.x1 - 0.015, x2: p.x2 + 0.015, z1: p.z1 - 0.015, z2: p.z2 + 0.015, base: 0, topo: 0.12 })),
        [planta],
    );

    const salasTexto = salas.map((s) => ({
        nome: canais.get(s.canalId)?.nome ?? "",
        pessoas: pessoasPorSala.get(s.canalId) ?? 0,
    }));
    const linhasDiretorio: LinhaTexto[] = [
        { texto: "SALAS DE VOZ", tamanho: 40, cor: "#b8955c", peso: 700 },
        ...(salasTexto.length === 0
            ? [{ texto: "Nenhuma sala ainda", tamanho: 44, cor: "#85858e", peso: 500 }]
            : salasTexto.slice(0, 7).map((s) => ({
                  texto: `${s.nome}  ·  ${s.pessoas === 0 ? "vazia" : s.pessoas === 1 ? "1 pessoa" : `${s.pessoas} pessoas`}`,
                  tamanho: 46,
                  cor: s.pessoas > 0 ? "#f3d9ad" : "#b4b4bb",
                  peso: 500,
              }))),
        ...(salasTexto.length > 7 ? [{ texto: `+ ${salasTexto.length - 7} salas pelo corredor`, tamanho: 36, cor: "#85858e", peso: 500 }] : []),
    ];

    const madeira = texturaMadeira();
    const ripadoLetreiro = useMemo(() => repetida(texturaRipado(), 3.6, 1), []);
    const zLuzes = useMemo(() => {
        const lista: number[] = [];
        for (let z = -2; z > corredor.z1 + 1; z -= 4) lista.push(z);
        return lista;
    }, [corredor.z1]);

    return (
        <group>
            {/* ---------- estrutura ---------- */}
            <Caixas caixas={porTipo.parede} material={COR_PAREDE.parede} />
            <Caixas caixas={porTipo.hall} material={COR_PAREDE.hall} />
            <Caixas caixas={porTipo.metal} material={COR_PAREDE.metal} />
            <Caixas caixas={rodapes} material={RODAPE} />

            <Piso ret={hall} textura={texturaPiso()} metros={2} rugosidade={0.22} />
            <Piso ret={corredor} textura={madeira} metros={3} rugosidade={0.5} />
            <Piso ret={{ x1: -0.9, x2: 0.9, z1: corredor.z1 + 0.6, z2: -0.4 }} textura={texturaCarpete()} metros={1} rugosidade={1} y={0.008} cor="#b5463c" />
            {salas.map((s) => s.modelo === "CINEMA"
                ? <Piso key={s.canalId} ret={s.ret} textura={texturaCarpete()} metros={1} rugosidade={1} cor="#5a3033" />
                : <Piso key={s.canalId} ret={s.ret} textura={madeira} metros={3} rugosidade={0.45} cor="#e8d9c8" />)}
            <Piso ret={elevador} textura={texturaCarpete()} metros={1} rugosidade={1} cor="#45444a" />

            <Teto ret={hall} altura={ALTURA_HALL} />
            <Teto ret={corredor} altura={ALTURA} />
            {salas.map((s) => <Teto key={s.canalId} ret={s.ret} altura={s.altura} mat={s.modelo === "CINEMA" ? TETO_CINEMA : TETO} />)}

            {/* ---------- hall ---------- */}
            {[-5, 0, 5].map((x) => (
                <mesh key={x} geometry={CAIXA} material={BRILHO} position={[x, ALTURA_HALL - 0.02, H / 2]} scale={[0.12, 0.03, H - 2.5]} />
            ))}
            {[-5, 0, 5].flatMap((x) => [H * 0.28, H * 0.72].map((z) => <PocaDeLuz key={`${x}:${z}`} x={x} z={z} raio={3.2} forca={0.55} />))}

            {/* parede da frente: letreiro do servidor (esquerda) e diretório das salas (direita) */}
            <mesh geometry={PLANO} position={[-6, ALTURA_HALL / 2, ESPESSURA / 2 + 0.005]} scale={[7.2, ALTURA_HALL, 1]}>
                <meshStandardMaterial map={ripadoLetreiro} roughness={0.7} />
            </mesh>
            <Placa
                position={[-6, 2.55, ESPESSURA / 2 + 0.02]}
                largura={6.2}
                linhas={[
                    { texto: `${andar}º ANDAR`, tamanho: 54, cor: "#d9b77e", peso: 600 },
                    { texto: servidor.nome, tamanho: 150, cor: "#fff4e2", peso: 700 },
                ]}
                opcoes={{ largura: 2048, altura: 560 }}
            />
            <Placa
                position={[6, 2, ESPESSURA / 2 + 0.02]}
                largura={4.4}
                linhas={linhasDiretorio}
                opcoes={{ largura: 1280, altura: 800, fundo: "rgba(16, 15, 14, 0.94)", raio: 24, alinhar: "left" }}
            />

            {/* parede do fundo: janelas dos lados do elevador */}
            {[-1, 1].map((s) => (
                <Janela key={s} position={[s * 6.3, 2.15, H - ESPESSURA / 2 - 0.01]} rotation={[0, Math.PI, 0]} largura={5.6} altura={2.9} semente={s > 0 ? 2 : 1} />
            ))}
            {[-1, 1].map((s) => (
                <mesh key={s} geometry={PLANO} position={[s * 2.3, ALTURA_HALL / 2, H - ESPESSURA / 2 - 0.005]} rotation={[0, Math.PI, 0]} scale={[2, ALTURA_HALL, 1]}>
                    <meshStandardMaterial map={texturaRipado()} roughness={0.7} />
                </mesh>
            ))}

            {/* canais de texto: quadros nas paredes laterais */}
            {quadros.map((q) => (
                <group key={q.canalId} position={[q.x, 1.65, q.z]} rotation={[0, q.rot, 0]}>
                    <mesh geometry={CAIXA} material={MADEIRA_ESCURA} position={[0, 0, 0.02]} scale={[2.1, 1.35, 0.05]} />
                    <Placa
                        position={[0, 0, 0.05]}
                        largura={1.96}
                        linhas={[
                            { texto: `# ${canais.get(q.canalId)?.nome ?? ""}`, tamanho: 76, peso: 600 },
                            { texto: "canal de texto", tamanho: 34, cor: "#8f9a95", peso: 500 },
                        ]}
                        opcoes={{ largura: 1024, altura: 640, fundo: "#1b2220" }}
                    />
                    <mesh geometry={CAIXA} material={LATAO} position={[0, 0.8, 0.12]} scale={[1.4, 0.03, 0.03]} />
                </group>
            ))}

            {/* ---------- corredor ---------- */}
            {zLuzes.map((z) => (
                <group key={z}>
                    <mesh geometry={CAIXA} material={BRILHO} position={[0, ALTURA - 0.02, z]} scale={[1.1, 0.03, 0.5]} />
                    <PocaDeLuz x={0} z={z} raio={2.4} forca={0.7} />
                </group>
            ))}
            <Janela position={[0, 1.65, corredor.z1 + ESPESSURA / 2 + 0.01]} largura={3.2} altura={2.3} semente={3} />

            {/* ---------- salas ---------- */}
            {salas.map((s) => {
                const nome = canais.get(s.canalId)?.nome ?? "";
                return (
                    <group key={s.canalId}>
                        <Porta sala={s} nome={nome} pessoas={pessoasPorSala.get(s.canalId) ?? 0} />
                        <TV
                            sala={s}
                            nome={nome}
                            tela={s.canalId === salaDaCall ? telaDaSala : undefined}
                            youtube={s.canalId === salaDaCall ? youtube : undefined}
                        />
                        {s.modelo === "CINEMA" ? <DecoracaoCinema sala={s} degraus={planta.degraus} /> : <Luminaria x={s.centro.x} z={s.centro.z} apagada={s.canalId === salaEscura} />}
                        <CaixasSom sala={s} />
                        <Tablet sala={s} />
                    </group>
                );
            })}

            <Moveis moveis={planta.moveis} />
        </group>
    );
}
