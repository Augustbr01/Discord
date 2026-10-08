// Um boneco por pessoa: anda até a última posição que chegou pela rede (suavizado),
// mostra o nome, a foto (ou a câmera, se estiver ligada) no rosto e as telas
// compartilhadas flutuando em cima da cabeça. Pula, agacha, desliza, senta e deita
// (quadril e joelho de cada perna mudam de ângulo conforme a postura).
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Participant, Track } from "livekit-client";
import type { Usuario } from "../../api";
import { hash } from "../../lib/util";
import { useTexturaAvatar, useTexturaVideo } from "./midia";
import { caixaArredondada, material, tom } from "./Moveis";
import { alturaChao, type Solido } from "./colisao";
import type { Ponto } from "./planta";
import { ITEM, POSTURA, type Pose } from "./rede";
import { texturaCracha, texturaSombra, texturaTexto } from "./texturas";

const CORES = ["#c8664b", "#5b8c6a", "#4f7ab8", "#d1a64a", "#8a5fa8", "#3f9a9a", "#c25b7a", "#7f8c99"];

const COXA = new THREE.CapsuleGeometry(0.08, 0.22, 4, 10);
const CANELA = new THREE.CapsuleGeometry(0.07, 0.22, 4, 10);
const TRONCO = new THREE.CapsuleGeometry(0.22, 0.38, 6, 16);
const BRACO = new THREE.CapsuleGeometry(0.06, 0.42, 4, 10);
const ROSTO = new THREE.CircleGeometry(0.15, 40);
const ANEL = new THREE.TorusGeometry(0.168, 0.012, 8, 48);
const PLANO = new THREE.PlaneGeometry(1, 1);
const CALCA = material("#26262b", 0.85);
// traseira clara (alumínio): quem está de frente pra pessoa vê que ela está com o tablet
const CORPO_TABLET = material("#c4c6cc", 0.45, 0.3);

const LARGURA_TELA = 1.3;
// quanto a cabeça gira pro lado antes do corpo acompanhar (sentado o corpo fica no lugar)
const GIRO_CABECA = 1.0;
const GIRO_CABECA_SENTADO = 1.4;
const INCLINACAO_CABECA = 0.85;
const TABLET = new THREE.BoxGeometry(0.3, 0.21, 0.014);
const TELA_TABLET = new THREE.PlaneGeometry(0.27, 0.18);
let texturaTabletNaMao: THREE.Texture | null = null;
// a tela acesa do tablet que alguém está segurando (uma textura só pra todos os bonecos)
function telaDoTablet() {
    texturaTabletNaMao ??= texturaTexto(
        [{ texto: "CONTROLE DA SALA", tamanho: 30, cor: "#d9b77e", peso: 700 }, { texto: "TV  ·  Som  ·  Luzes", tamanho: 44, peso: 600 }],
        { largura: 512, altura: 340, fundo: "#16161a" },
    ).textura;
    return texturaTabletNaMao;
}
const QUADRIL = 0.72; // altura do quadril em pé
const SEGMENTO = 0.36; // coxa e canela
// deitado: o corpo tomba pra frente a partir dos pés; ele recua isso pra cabeça ficar perto
// de onde a pessoa está (os olhos da câmera dela) e sobe o tanto da grossura do tronco
const RECUO_DEITADO = 1.1;
const ALTURA_DEITADO = 0.21;

// como o corpo fica em cada postura. queda = quanto o quadril desce; inclinação = tronco
// pra trás (+) ou pra frente (-); quadril/joelho = ângulo das pernas; braço = pra frente (+);
// deitar = 0 de pé, 1 de bruços no chão
type Forma = { queda: number; inclinacao: number; quadril: number; joelho: number; braco: number; deitar: number };
const FORMAS: Record<number, Forma> = {
    [POSTURA.EM_PE]: { queda: 0, inclinacao: 0, quadril: 0, joelho: 0, braco: 0, deitar: 0 },
    [POSTURA.AGACHADO]: { queda: 0.3, inclinacao: -0.25, quadril: 1.05, joelho: -1.9, braco: 0.5, deitar: 0 },
    [POSTURA.DESLIZANDO]: { queda: 0.42, inclinacao: 0.55, quadril: 1.35, joelho: -0.35, braco: -0.6, deitar: 0 },
    [POSTURA.SENTADO]: { queda: 0.17, inclinacao: 0.12, quadril: Math.PI / 2, joelho: -Math.PI / 2, braco: 0.35, deitar: 0 },
    // de bruços, braços esticados pra frente (como quem rasteja)
    [POSTURA.DEITADO]: { queda: 0, inclinacao: 0, quadril: 0, joelho: -0.15, braco: 2.7, deitar: 1 },
};

// diferença entre dois ângulos pelo caminho mais curto
function giro(para: number, de: number) {
    return Math.atan2(Math.sin(para - de), Math.cos(para - de));
}

type Props = {
    usuario: Usuario;
    // onde a pessoa deveria estar agora (lido a cada quadro)
    lerAlvo: () => Pose | undefined;
    // na mesma call que você: dá pra ver quando fala, a câmera e as telas
    participante?: Participant | undefined;
    camera?: Track | undefined;
    telas: Track[];
    // posição atual de cada boneco, pro áudio espacial saber de onde vem a voz
    posicoes: Map<string, Ponto>;
    // o chão de verdade (degraus, móveis): a sombra fica nele (não sobe junto no pulo)
    solidos: Solido[];
};

export function Boneco({ usuario, lerAlvo, participante, camera, telas, posicoes, solidos }: Props) {
    const raiz = useRef<THREE.Group>(null);
    const corpo = useRef<THREE.Group>(null);
    const tronco = useRef<THREE.Group>(null);
    // [quadril esq., quadril dir., joelho esq., joelho dir., braço esq., braço dir.]
    const juntas = useRef<(THREE.Group | null)[]>([]);
    const cracha = useRef<THREE.Sprite>(null);
    const grupoTelas = useRef<THREE.Group>(null);
    const anel = useRef<THREE.MeshBasicMaterial>(null);
    const sombra = useRef<THREE.Mesh>(null);
    const tablet = useRef<THREE.Group>(null);
    // 0..1: quanto está com o tablet levantado (sobe e desce aos poucos)
    const segurando = useRef(0);
    const grupoCabeca = useRef<THREE.Group>(null);
    // rot = pra onde olha; corpo = pra onde o corpo está virado (vai atrás do olhar)
    const estado = useRef({
        x: 0, z: 0, y: 0, rot: 0, pitch: 0, corpo: 0, sentadoAntes: false,
        fase: 0, velocidade: 0, iniciado: false, forma: { ...FORMAS[POSTURA.EM_PE] },
    });

    const cor = CORES[hash(usuario.id) % CORES.length];
    const foto = useTexturaAvatar(usuario.nome, usuario.avatarUrl);
    const video = useTexturaVideo(camera, 480, 270);
    const textoCracha = useMemo(() => texturaCracha(usuario.nome), [usuario.nome]);
    useEffect(() => () => textoCracha.textura.dispose(), [textoCracha]);

    // câmera no rosto redondo: corta o meio do vídeo num quadrado
    useEffect(() => {
        if (!video) return;
        const a = video.aspecto;
        video.textura.repeat.set(a > 1 ? 1 / a : 1, a > 1 ? 1 : a);
        video.textura.offset.set(a > 1 ? (1 - 1 / a) / 2 : 0, a > 1 ? 0 : (1 - a) / 2);
    }, [video]);

    useEffect(() => () => {
        posicoes.delete(usuario.id);
    }, [posicoes, usuario.id]);

    useFrame(({ camera: olho }, delta) => {
        const alvo = lerAlvo();
        const e = estado.current;
        if (!alvo || !raiz.current || !corpo.current) return;

        // primeira vez, ou pulou longe (trocou de lugar de repente, sentou): vai direto
        const sentado = alvo.postura === POSTURA.SENTADO;
        if (!e.iniciado || Math.hypot(alvo.x - e.x, alvo.z - e.z) > (sentado ? 1.2 : 6)) {
            e.x = alvo.x;
            e.z = alvo.z;
            e.y = alvo.y;
            e.rot = alvo.rot;
            e.corpo = alvo.rot;
            e.iniciado = true;
        }
        const k = 1 - Math.exp(-delta * 10);
        const antesX = e.x;
        const antesZ = e.z;
        e.x += (alvo.x - e.x) * k;
        e.z += (alvo.z - e.z) * k;
        // na altura (pulo) acompanha mais rápido
        e.y += (alvo.y - e.y) * (1 - Math.exp(-delta * 16));
        e.rot += giro(alvo.rot, e.rot) * k;
        e.pitch += ((alvo.pitch ?? 0) - e.pitch) * k;

        const v = Math.hypot(e.x - antesX, e.z - antesZ) / Math.max(delta, 1e-3);
        e.velocidade += (v - e.velocidade) * Math.min(1, delta * 8);
        const deitado = alvo.postura === POSTURA.DEITADO;
        // rastejando, os "passos" são curtos: a fase anda mais rápido por metro
        e.fase += e.velocidade * delta * (deitado ? 5 : 2.6);
        // só balança as pernas andando em pé ou agachado
        const anda = alvo.postura === POSTURA.EM_PE || alvo.postura === POSTURA.AGACHADO;
        const passo = anda ? Math.min(1, e.velocidade / 3) : 0;

        // a forma do corpo vai mudando aos poucos pra da postura nova
        const alvoForma = FORMAS[alvo.postura] ?? FORMAS[POSTURA.EM_PE];
        const kf = Math.min(1, delta * 12);
        const forma = e.forma;
        (Object.keys(forma) as (keyof Forma)[]).forEach((c) => {
            forma[c] += (alvoForma[c] - forma[c]) * kf;
        });

        raiz.current.position.set(e.x, e.y, e.z);
        // sombra no chão, menor quanto mais alto no pulo
        if (sombra.current) {
            const altura = Math.max(0, e.y - alturaChao(solidos, e, e.y));
            sombra.current.position.y = 0.011 - altura;
            sombra.current.scale.setScalar(0.9 * (1 - Math.min(0.5, altura * 0.45)));
        }
        // o corpo vai atrás do olhar: andando, alinha; parado, só vira quando a cabeça passa do
        // limite; sentado, fica virado pro lado do lugar (que é pra onde olhava ao sentar)
        const limite = sentado ? GIRO_CABECA_SENTADO : GIRO_CABECA;
        if (sentado) {
            if (!e.sentadoAntes) e.corpo = alvo.rot;
        } else {
            const diferenca = giro(e.rot, e.corpo);
            if (e.velocidade > 0.4) {
                e.corpo += diferenca * Math.min(1, delta * 10);
            } else if (Math.abs(diferenca) > limite) {
                const alvoCorpo = e.rot - Math.sign(diferenca) * (limite - 0.2);
                e.corpo += giro(alvoCorpo, e.corpo) * Math.min(1, delta * 6);
            }
        }
        e.sentadoAntes = sentado;
        // deitado: tomba pra frente (o giro em x é no corpo já virado pra onde olha)
        corpo.current.rotation.set(-forma.deitar * Math.PI / 2, e.corpo, 0, "YXZ");
        if (grupoCabeca.current) {
            const lado = Math.max(-limite, Math.min(limite, giro(e.rot, e.corpo)));
            const cima = Math.max(-INCLINACAO_CABECA, Math.min(INCLINACAO_CABECA, e.pitch));
            // a maior parte do olhar pra cima/baixo é a cabeça; o resto o tronco acompanha
            // deitado, a cabeça levanta pra olhar pra frente em vez de pro chão
            grupoCabeca.current.rotation.set(cima * 0.75 + forma.deitar * 1.2, lado, 0, "YXZ");
        }
        corpo.current.position.set(
            Math.sin(e.corpo) * RECUO_DEITADO * forma.deitar,
            -forma.queda + Math.abs(Math.sin(e.fase)) * 0.045 * passo + ALTURA_DEITADO * forma.deitar,
            Math.cos(e.corpo) * RECUO_DEITADO * forma.deitar,
        );
        if (tronco.current) tronco.current.rotation.x = forma.inclinacao + Math.max(-0.3, Math.min(0.3, e.pitch * 0.25));

        // pernas e braços balançam em oposição; o joelho dobra na perna que vai pra trás
        const balanco = Math.sin(e.fase) * (alvo.postura === POSTURA.AGACHADO ? 0.35 : 0.6) * passo;
        // rastejando: um braço estica e puxa enquanto o joelho do outro lado sobe pro lado
        const puxa = deitado ? Math.sin(e.fase) * Math.min(1, e.velocidade / 0.8) * forma.deitar : 0;
        const joelhoSobeE = Math.max(0, -puxa);
        const joelhoSobeD = Math.max(0, puxa);
        const [quadrilE, quadrilD, joelhoE, joelhoD, bracoE, bracoD] = juntas.current;
        if (quadrilE) quadrilE.rotation.set(forma.quadril + balanco + joelhoSobeE * 0.3, 0, -joelhoSobeE * 0.7);
        if (quadrilD) quadrilD.rotation.set(forma.quadril - balanco + joelhoSobeD * 0.3, 0, joelhoSobeD * 0.7);
        if (joelhoE) joelhoE.rotation.x = forma.joelho - Math.max(0, -balanco) * 1.2 - joelhoSobeE * 1.1;
        if (joelhoD) joelhoD.rotation.x = forma.joelho - Math.max(0, balanco) * 1.2 - joelhoSobeD * 1.1;
        // o tronco rola um pouco pro lado do braço que puxa
        if (tronco.current) tronco.current.rotation.z = puxa * 0.12;
        // com o tablet: os dois braços pra frente, mãos nas bordas dele, na altura do peito
        segurando.current += ((alvo.item === ITEM.TABLET ? 1 : 0) - segurando.current) * Math.min(1, delta * 8);
        const s = segurando.current;
        if (bracoE) {
            bracoE.rotation.x = (forma.braco - balanco * 0.8 + puxa * 0.3) * (1 - s) + 1.45 * s;
            // o que puxa abre pro lado (puxando o corpo), em vez de afundar no chão
            bracoE.rotation.z = 0.3 * s - Math.max(0, -puxa) * 0.45;
        }
        if (bracoD) {
            bracoD.rotation.x = (forma.braco + balanco * 0.8 - puxa * 0.3) * (1 - s) + 1.45 * s;
            bracoD.rotation.z = -0.3 * s + Math.max(0, puxa) * 0.45;
        }
        if (tablet.current) {
            tablet.current.visible = s > 0.05;
            tablet.current.position.y = 0.36 + 0.22 * s;
        }

        // nome e telas acompanham a altura da cabeça
        const emPe = 1 - forma.deitar;
        if (cracha.current) cracha.current.position.y = (2.08 - forma.queda) * emPe + 0.8 * forma.deitar;
        if (grupoTelas.current) {
            grupoTelas.current.position.y = (2.22 - forma.queda) * emPe + 0.95 * forma.deitar;
            // as telas ficam sempre de frente pra quem está olhando
            grupoTelas.current.rotation.y = Math.atan2(olho.position.x - e.x, olho.position.z - e.z);
        }

        // anel do rosto acende com a voz
        if (anel.current) {
            const nivel = participante?.isSpeaking ? Math.min(1, 0.45 + participante.audioLevel * 2) : 0;
            anel.current.opacity += (nivel - anel.current.opacity) * Math.min(1, delta * 12);
        }

        const pos = posicoes.get(usuario.id);
        if (pos) {
            pos.x = e.x;
            pos.z = e.z;
        } else {
            posicoes.set(usuario.id, { x: e.x, z: e.z });
        }
    });

    const tecido = material(cor, 0.85);
    const mangas = material(tom(cor, -0.12), 0.85);
    const cabeca = material(tom(cor, 0.55), 0.55);
    const alturaCracha = 0.17;

    return (
        <group ref={raiz}>
            <mesh ref={sombra} geometry={PLANO} position={[0, 0.011, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.9, 0.9, 1]} renderOrder={1}>
                <meshBasicMaterial map={texturaSombra()} transparent depthWrite={false} />
            </mesh>

            {/* o corpo olha pra -z quando rot = 0, igual à câmera */}
            <group ref={corpo}>
                {[-0.1, 0.1].map((x, i) => (
                    <group key={x} ref={(g) => { juntas.current[i] = g; }} position={[x, QUADRIL, 0]}>
                        <mesh geometry={COXA} material={CALCA} position={[0, -SEGMENTO / 2, 0]} />
                        <group ref={(g) => { juntas.current[i + 2] = g; }} position={[0, -SEGMENTO, 0]}>
                            <mesh geometry={CANELA} material={CALCA} position={[0, -SEGMENTO / 2, 0]} />
                        </group>
                    </group>
                ))}

                {/* do quadril pra cima: inclina junto (pra frente agachado, pra trás deslizando) */}
                <group ref={tronco} position={[0, QUADRIL, 0]}>
                    <mesh geometry={TRONCO} material={tecido} position={[0, 0.36, 0]} />
                    {[-0.29, 0.29].map((x, i) => (
                        <group key={x} ref={(g) => { juntas.current[i + 4] = g; }} position={[x, 0.64, 0]}>
                            <mesh geometry={BRACO} material={mangas} position={[0, -0.24, 0]} />
                        </group>
                    ))}

                    {/* o tablet nas mãos, inclinado pro rosto (quem olha por trás vê a tela acesa) */}
                    <group ref={tablet} position={[0, 0.58, -0.5]} rotation={[-0.78, 0, 0]} visible={false}>
                        <mesh geometry={TABLET} material={CORPO_TABLET} />
                        <mesh geometry={TELA_TABLET} position={[0, 0, 0.0075]}>
                            <meshBasicMaterial map={telaDoTablet()} toneMapped={false} />
                        </mesh>
                    </group>

                    <group ref={grupoCabeca} position={[0, 0.94, 0]}>
                        <mesh geometry={caixaArredondada(0.42, 0.4, 0.38, 0.1)} material={cabeca} />
                        <mesh geometry={ROSTO} position={[0, 0, -0.192]} rotation={[0, Math.PI, 0]}>
                            <meshBasicMaterial map={video?.textura ?? foto} toneMapped={false} />
                        </mesh>
                        <mesh geometry={ANEL} position={[0, 0, -0.194]} rotation={[0, Math.PI, 0]}>
                            <meshBasicMaterial ref={anel} color="#f6f6f7" transparent opacity={0} toneMapped={false} />
                        </mesh>
                    </group>
                </group>
            </group>

            <sprite ref={cracha} position={[0, 2.08, 0]} scale={[alturaCracha * textoCracha.aspecto, alturaCracha, 1]}>
                <spriteMaterial map={textoCracha.textura} transparent depthWrite={false} toneMapped={false} />
            </sprite>

            {telas.length > 0 && (
                <group ref={grupoTelas} position={[0, 2.22, 0]}>
                    {telas.map((t, i) => (
                        <PainelTela key={t.sid ?? i} track={t} x={(i - (telas.length - 1) / 2) * (LARGURA_TELA + 0.12)} />
                    ))}
                </group>
            )}
        </group>
    );
}

function PainelTela({ track, x }: { track: Track; x: number }) {
    const video = useTexturaVideo(track, 1280, 720);
    if (!video) return null;
    const altura = LARGURA_TELA / video.aspecto;
    return (
        <group position={[x, altura / 2, 0]}>
            <mesh geometry={PLANO} position={[0, 0, -0.005]} scale={[LARGURA_TELA + 0.06, altura + 0.06, 1]}>
                <meshBasicMaterial color="#0b0b0c" />
            </mesh>
            <mesh geometry={PLANO} scale={[LARGURA_TELA, altura, 1]}>
                <meshBasicMaterial map={video.textura} toneMapped={false} />
            </mesh>
        </group>
    );
}
