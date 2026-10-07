// Você em primeira pessoa: mouse (com o ponteiro travado) ou toque pra olhar,
// WASD/setas ou o joystick da tela pra andar. Esbarra nas paredes e nos móveis,
// sobe os degraus do cinema, pula (Espaço), agacha (C) e desliza (correndo + C), e senta.
import { useEffect, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { estaDigitando } from "../../lib/util";
import {
    alturaChao, dentro, moverComColisao, pontoLivre, DEGRAU_MAXIMO, RAIO_JOGADOR,
    type Assento, type Interativo, type Planta, type Ponto,
} from "./planta";
import { POSTURA, type Pose } from "./rede";

// altura dos olhos acima dos pés em cada postura
const OLHOS = { [POSTURA.EM_PE]: 1.62, [POSTURA.AGACHADO]: 1.0, [POSTURA.DESLIZANDO]: 0.8, [POSTURA.SENTADO]: 1.15 } as Record<number, number>;
const ANDAR = 3.6; // m/s
const CORRER = 6.4;
const AGACHADO = 1.8;
const PULO = 5.2; // velocidade pra cima ao pular
const GRAVIDADE = 15;
const DESLIZE_S = 0.75;
const SENSIBILIDADE = 0.0022;
const SENSIBILIDADE_TOQUE = 0.005;
const LIMITE_OLHAR = Math.PI / 2 - 0.08;

export type ControleToque = {
    // joystick: -1..1 em cada eixo (y negativo = pra frente)
    andar: { x: number; y: number };
    // quanto girou desde o último quadro (px)
    olhar: { x: number; y: number };
    // botões da tela: pular (uma vez) e agachar (liga/desliga)
    pular: boolean;
    agachado: boolean;
};

// pedidos de fora (o Mundo3D decide se o lugar está livre)
export type PedidoJogador = { tipo: "sentar"; assento: Assento } | { tipo: "levantar" };

type Props = {
    planta: Planta;
    pose: RefObject<Pose>;
    // modal aberto etc.: fica parado
    parado: boolean;
    portaFechada: RefObject<boolean>;
    toque: RefObject<ControleToque>;
    pedido: RefObject<PedidoJogador | null>;
    onSala: (salaId: string | null) => void;
    onFoco: (interativo: Interativo | null) => void;
    onTravado: (travado: boolean) => void;
    onPostura: (postura: number) => void;
};

export function Jogador({ planta, pose, parado, portaFechada, toque, pedido, onSala, onFoco, onTravado, onPostura }: Props) {
    const { camera, gl } = useThree();
    const teclas = useRef(new Set<string>());
    // apertos que valem uma vez (não importa quanto tempo segura)
    const apertos = useRef({ pular: false, agachar: false });
    const olhar = useRef({ yaw: pose.current.rot, pitch: 0 });
    const fisica = useRef({
        vx: 0, vz: 0, vy: 0, noChao: true,
        deslize: 0, dirX: 0, dirZ: 0, velDeslize: 0,
        olhos: OLHOS[POSTURA.EM_PE], cameraY: pose.current.y + OLHOS[POSTURA.EM_PE], inclinacao: 0, passo: 0,
        assento: null as Assento | null,
    });
    const sala = useRef<string | null>(null);
    const foco = useRef<string | null>(null);
    const postura = useRef<number>(POSTURA.EM_PE);
    const paradoRef = useRef(parado);
    paradoRef.current = parado;

    // a primeira sala é a de onde você nasceu (sem disparar entrar na call de novo)
    if (sala.current === null) {
        sala.current = planta.salas.find((s) => dentro(s.ret, pose.current))?.canalId ?? null;
    }

    useEffect(() => {
        const canvas = gl.domElement;
        // o YouTube na TV deixa o canvas sem receber clique (o iframe fica atrás dele),
        // então o clique que trava o mouse é ouvido no elemento de fora
        const area = canvas.parentElement ?? canvas;

        const aoClicar = (e: MouseEvent) => {
            // no toque não tem ponteiro pra travar: lá quem olha é o arrastar
            const tipo = (e as PointerEvent).pointerType;
            if ((tipo && tipo !== "mouse") || !("requestPointerLock" in canvas)) return;
            if (!paradoRef.current && document.pointerLockElement !== canvas) {
                // alguns navegadores devolvem promessa e rejeitam se o pedido vier rápido demais
                Promise.resolve(canvas.requestPointerLock()).catch(() => {});
            }
        };
        const aoMudarTrava = () => onTravado(document.pointerLockElement === canvas);
        const aoMexer = (e: MouseEvent) => {
            if (document.pointerLockElement !== canvas || paradoRef.current) return;
            olhar.current.yaw -= e.movementX * SENSIBILIDADE;
            olhar.current.pitch = Math.max(-LIMITE_OLHAR, Math.min(LIMITE_OLHAR, olhar.current.pitch - e.movementY * SENSIBILIDADE));
        };
        const aoApertar = (e: KeyboardEvent) => {
            if (estaDigitando(e) || e.ctrlKey || e.metaKey || e.altKey) return;
            teclas.current.add(e.code);
            if (e.repeat) return;
            if (e.code === "Space") {
                // sem isso o Espaço rola a página ou clica no botão que estiver com foco
                e.preventDefault();
                apertos.current.pular = true;
            }
            if (e.code === "KeyC") apertos.current.agachar = true;
        };
        const aoSoltar = (e: KeyboardEvent) => teclas.current.delete(e.code);
        const aoSairDaJanela = () => teclas.current.clear();

        area.addEventListener("click", aoClicar);
        document.addEventListener("pointerlockchange", aoMudarTrava);
        document.addEventListener("mousemove", aoMexer);
        window.addEventListener("keydown", aoApertar);
        window.addEventListener("keyup", aoSoltar);
        window.addEventListener("blur", aoSairDaJanela);
        return () => {
            area.removeEventListener("click", aoClicar);
            document.removeEventListener("pointerlockchange", aoMudarTrava);
            document.removeEventListener("mousemove", aoMexer);
            window.removeEventListener("keydown", aoApertar);
            window.removeEventListener("keyup", aoSoltar);
            window.removeEventListener("blur", aoSairDaJanela);
            if (document.pointerLockElement === canvas) document.exitPointerLock();
        };
    }, [gl, onTravado]);

    // abriu um modal: solta o mouse e as teclas
    useEffect(() => {
        if (!parado) return;
        teclas.current.clear();
        if (document.pointerLockElement === gl.domElement) document.exitPointerLock();
    }, [parado, gl]);

    const caixas = () => (portaFechada.current ? [...planta.colisao, planta.portaElevador] : planta.colisao);

    // levanta e fica em pé na frente do lugar (um pouco mais longe se ali estiver ocupado)
    function levantar() {
        const f = fisica.current;
        const a = f.assento;
        if (!a) return;
        const p = pose.current;
        const fx = -Math.sin(a.rot);
        const fz = -Math.cos(a.rot);
        const tentativas: Ponto[] = [0.8, 1.1, 1.4].map((d) => ({ x: a.x + fx * d, z: a.z + fz * d }));
        const alvo = tentativas.find((q) => pontoLivre(caixas(), q)) ?? tentativas[0];
        p.x = alvo.x;
        p.z = alvo.z;
        p.y = alturaChao(planta.degraus, alvo);
        f.assento = null;
        f.vx = f.vz = f.vy = 0;
        f.noChao = true;
    }

    useFrame((_, delta) => {
        // PC lento (poucos quadros) ainda anda na velocidade certa; o teto evita atravessar
        // parede num quadro travado (0.1 s correndo = 0.64 m, menos que parede + raio)
        const dt = Math.min(delta, 0.1);
        const t = teclas.current;
        const p = pose.current;
        const f = fisica.current;
        const toq = toque.current;
        const pular = apertos.current.pular || toq.pular;
        const apertouAgachar = apertos.current.agachar;
        apertos.current.pular = apertos.current.agachar = toq.pular = false;

        // olhar pelo toque
        if (toq.olhar.x || toq.olhar.y) {
            olhar.current.yaw -= toq.olhar.x * SENSIBILIDADE_TOQUE;
            olhar.current.pitch = Math.max(-LIMITE_OLHAR, Math.min(LIMITE_OLHAR, olhar.current.pitch - toq.olhar.y * SENSIBILIDADE_TOQUE));
            toq.olhar.x = 0;
            toq.olhar.y = 0;
        }

        let frente = 0;
        let lado = 0;
        if (!paradoRef.current) {
            if (t.has("KeyW") || t.has("ArrowUp")) frente += 1;
            if (t.has("KeyS") || t.has("ArrowDown")) frente -= 1;
            if (t.has("KeyD") || t.has("ArrowRight")) lado += 1;
            if (t.has("KeyA") || t.has("ArrowLeft")) lado -= 1;
            frente -= toq.andar.y;
            lado += toq.andar.x;
        }
        const intensidade = Math.min(1, Math.hypot(frente, lado));
        const yaw = olhar.current.yaw;

        // ---------- sentar / levantar ----------
        const pedidoAgora = pedido.current;
        pedido.current = null;
        if (pedidoAgora?.tipo === "sentar" && !f.assento) {
            const a = pedidoAgora.assento;
            f.assento = a;
            f.deslize = 0;
            p.x = a.x;
            p.z = a.z;
            p.y = a.y;
            olhar.current.yaw = a.rot;
            olhar.current.pitch = 0;
        } else if (f.assento && (pedidoAgora?.tipo === "levantar" || pular || intensidade > 0.3)) {
            levantar();
        }

        let novaPostura: number;
        let movendo = false;

        if (f.assento) {
            // sentado: só olha em volta
            novaPostura = POSTURA.SENTADO;
        } else {
            const agachar = (t.has("KeyC") || toq.agachado) && !paradoRef.current;
            const correndo = (t.has("ShiftLeft") || t.has("ShiftRight")) && frente > 0 && !agachar;

            // direção que você quer ir, no andar: frente = (-sen yaw, -cos yaw); direita = (cos yaw, -sen yaw)
            let querX = 0;
            let querZ = 0;
            if (intensidade > 0.05) {
                const norma = Math.hypot(frente, lado);
                const fr = frente / norma;
                const la = lado / norma;
                const vel = (agachar ? AGACHADO : correndo ? CORRER : ANDAR) * intensidade;
                querX = (-Math.sin(yaw) * fr + Math.cos(yaw) * la) * vel;
                querZ = (-Math.cos(yaw) * fr - Math.sin(yaw) * la) * vel;
            }

            // deslizar: agachar correndo (igual no CoD). A direção trava no começo
            const velocidade = Math.hypot(f.vx, f.vz);
            if (apertouAgachar && f.noChao && f.deslize <= 0 && velocidade > CORRER * 0.8) {
                f.deslize = DESLIZE_S;
                f.dirX = f.vx / velocidade;
                f.dirZ = f.vz / velocidade;
                f.velDeslize = velocidade + 2.2;
            }

            if (f.deslize > 0) {
                f.deslize -= dt;
                const resto = Math.max(0, f.deslize / DESLIZE_S);
                const vel = AGACHADO + (f.velDeslize - AGACHADO) * resto * resto;
                f.vx = f.dirX * vel;
                f.vz = f.dirZ * vel;
            } else if (f.noChao) {
                f.vx = querX;
                f.vz = querZ;
            } else {
                // no ar dá pra corrigir só um pouco
                const ar = Math.min(1, dt * 2.5);
                f.vx += (querX - f.vx) * ar;
                f.vz += (querZ - f.vz) * ar;
            }

            // pular (pular no meio do deslize corta o deslize e mantém o embalo)
            if (pular && f.noChao && !paradoRef.current) {
                f.vy = PULO;
                f.noChao = false;
                f.deslize = 0;
            }

            // andar com colisão: degrau alto demais conta como parede
            const pes = p.y;
            const novo = moverComColisao(
                p,
                { x: p.x + f.vx * dt, z: p.z + f.vz * dt },
                caixas(),
                RAIO_JOGADOR,
                (q) => alturaChao(planta.degraus, q) - pes <= DEGRAU_MAXIMO,
            );
            movendo = Math.hypot(novo.x - p.x, novo.z - p.z) > 0.001;
            p.x = novo.x;
            p.z = novo.z;

            // chão e gravidade
            const chao = alturaChao(planta.degraus, p);
            if (f.noChao) {
                // desce degrau pequeno colado no chão; mais alto que isso, cai
                if (p.y - chao > DEGRAU_MAXIMO) {
                    f.noChao = false;
                    f.vy = 0;
                } else {
                    p.y = chao;
                }
            }
            if (!f.noChao) {
                f.vy -= GRAVIDADE * dt;
                p.y += f.vy * dt;
                if (p.y <= chao) {
                    p.y = chao;
                    f.vy = 0;
                    f.noChao = true;
                }
            }

            novaPostura = f.deslize > 0 ? POSTURA.DESLIZANDO : agachar ? POSTURA.AGACHADO : POSTURA.EM_PE;
        }

        // ---------- câmera ----------
        f.olhos += (OLHOS[novaPostura] - f.olhos) * Math.min(1, dt * 12);
        const andando = movendo && f.noChao && novaPostura !== POSTURA.DESLIZANDO;
        if (andando) f.passo += Math.hypot(f.vx, f.vz) * dt * 2.2;
        const balanco = andando ? Math.sin(f.passo) * 0.035 : 0;
        const alvoY = p.y + f.olhos + balanco;
        // no chão suaviza (degrau não dá tranco); no ar segue direto
        f.cameraY = f.noChao ? f.cameraY + (alvoY - f.cameraY) * Math.min(1, dt * 18) : alvoY;
        // deslizando, a câmera inclina um pouco
        f.inclinacao += ((novaPostura === POSTURA.DESLIZANDO ? 0.06 : 0) - f.inclinacao) * Math.min(1, dt * 10);
        camera.position.set(p.x, f.cameraY, p.z);
        camera.rotation.set(olhar.current.pitch, olhar.current.yaw, f.inclinacao, "YXZ");

        p.rot = olhar.current.yaw;
        p.pitch = olhar.current.pitch;
        p.postura = novaPostura;
        if (novaPostura !== postura.current) {
            postura.current = novaPostura;
            onPostura(novaPostura);
        }

        atualizarSala(p);
        atualizarFoco(p, olhar.current.yaw, !!f.assento);
    });

    function atualizarSala(p: Ponto) {
        const atual = planta.salas.find((s) => s.canalId === sala.current);
        // sai só quando passa bem da porta, entra só quando já está dentro: sem pisca-pisca na soleira
        if (atual && dentro(atual.ret, p, 0.1)) return;
        const nova = planta.salas.find((s) => dentro(s.ret, p, -0.3))?.canalId ?? null;
        if (nova === sala.current) return;
        sala.current = nova;
        onSala(nova);
    }

    function atualizarFoco(p: Ponto, yaw: number, sentado: boolean) {
        let melhor: Interativo | null = null;
        let menor = Infinity;
        for (const it of planta.interativos) {
            // sentado, os outros lugares não interessam (levanta com Espaço)
            if (sentado && it.tipo === "assento") continue;
            const d = Math.hypot(it.x - p.x, it.z - p.z);
            if (d > it.raio) continue;
            // precisa estar mais ou menos olhando pra ele
            const dirX = (it.x - p.x) / (d || 1);
            const dirZ = (it.z - p.z) / (d || 1);
            const alinhado = -Math.sin(yaw) * dirX - Math.cos(yaw) * dirZ;
            if (d > 0.6 && alinhado < 0.2) continue;
            if (d < menor) {
                menor = d;
                melhor = it;
            }
        }
        const id = melhor?.id ?? null;
        if (id !== foco.current) {
            foco.current = id;
            onFoco(melhor);
        }
    }

    return null;
}
