// Você em primeira pessoa: mouse (com o ponteiro travado) ou toque pra olhar,
// WASD/setas ou o joystick da tela pra andar. Esbarra nas paredes e nos móveis,
// sobe os degraus do cinema, pula (Espaço ou rodinha), agacha (C), anda devagar (Shift) e senta.
//
// A movimentação é a da Source/CS: aceleração e atrito no chão, controle no ar (air strafe)
// e bunny hop — pular no tick em que encosta no chão não perde velocidade pro atrito.
// A física roda em ticks fixos de 64 por segundo (como o CS2) e a câmera interpola entre eles.
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type * as THREE from "three";
import { estaDigitando } from "../../lib/util";
import { fovVertical, lerConfig, radianosPorPonto } from "./config";
import { ALTURA_AGACHADO, ALTURA_CORPO, alturaChao, mover, pontoLivre, solidoDeRet, DEGRAU_MAXIMO } from "./colisao";
import {
    dentro, ALTURA, ALTURA_ELEVADOR, ALTURA_HALL,
    type Assento, type Interativo, type Planta, type Ponto,
} from "./planta";
import { POSTURA, type Pose } from "./rede";

// 1 unidade do CS = 1 polegada
const U = 0.0254;
// altura dos olhos acima dos pés em cada postura (64 e 46 unidades no CS)
const OLHOS = { [POSTURA.EM_PE]: 64 * U, [POSTURA.AGACHADO]: 46 * U, [POSTURA.DESLIZANDO]: 46 * U, [POSTURA.SENTADO]: 1.15 } as Record<number, number>;

const TICK = 1 / 64;
const VELOCIDADE = 250 * U; // a de quem corre com a faca no CS
const FATOR_DEVAGAR = 0.52; // Shift
const FATOR_AGACHADO = 0.34;
const ACELERACAO = 5.5; // sv_accelerate
const ATRITO = 5.2; // sv_friction
const PARADA = 80 * U; // sv_stopspeed
const ACELERACAO_AR = 12; // sv_airaccelerate
const MAXIMO_AR = 30 * U; // o quanto o ar deixa somar na direção que você aperta
const GRAVIDADE = 800 * U;
const PULO = 301.993 * U;

const SENSIBILIDADE_TOQUE = 0.005;
const LIMITE_OLHAR = Math.PI / 2 - 0.02;

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
    // velocidade no chão agora (m/s), pro velocímetro
    velocidade: RefObject<number>;
    onSala: (salaId: string | null) => void;
    onFoco: (interativo: Interativo | null) => void;
    onTravado: (travado: boolean) => void;
    onPostura: (postura: number) => void;
};

export function Jogador({ planta, pose, parado, portaFechada, toque, pedido, velocidade, onSala, onFoco, onTravado, onPostura }: Props) {
    const { camera, gl } = useThree();
    const teclas = useRef(new Set<string>());
    // pulo apertado (tecla ou rodinha): vale pro próximo tick, e só se estiver no chão nele
    const querPular = useRef(false);
    const olhar = useRef({ yaw: pose.current.rot, pitch: 0 });
    const fisica = useRef({
        vx: 0, vz: 0, vy: 0, noChao: true,
        // posição do tick anterior (a câmera fica entre ele e o atual)
        antes: { x: pose.current.x, y: pose.current.y, z: pose.current.z },
        acumulado: 0,
        olhos: OLHOS[POSTURA.EM_PE], cameraY: pose.current.y + OLHOS[POSTURA.EM_PE],
        assento: null as Assento | null,
        agachado: false,
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
        const travado = () => document.pointerLockElement === canvas;

        const travar = () => {
            // entrada bruta: o movimento do mouse sem a aceleração do sistema (nem todo navegador tem)
            const bruta = lerConfig().entradaBruta;
            const simples = () => Promise.resolve(canvas.requestPointerLock()).catch(() => {});
            try {
                const pedidoTrava = bruta ? canvas.requestPointerLock({ unadjustedMovement: true }) : canvas.requestPointerLock();
                Promise.resolve(pedidoTrava).catch(() => (bruta ? simples() : undefined));
            } catch {
                if (bruta) simples();
            }
        };

        const aoClicar = (e: MouseEvent) => {
            // no toque não tem ponteiro pra travar: lá quem olha é o arrastar
            const tipo = (e as PointerEvent).pointerType;
            if ((tipo && tipo !== "mouse") || !("requestPointerLock" in canvas)) return;
            if (!paradoRef.current && !travado()) travar();
        };
        // rodinha pula (como o "bind mwheeldown +jump" do CS)
        const aoRodar = (e: WheelEvent) => {
            if (!travado() || paradoRef.current || e.deltaY === 0) return;
            querPular.current = true;
        };
        const aoMudarTrava = () => onTravado(travado());
        const aoMexer = (e: MouseEvent) => {
            if (!travado() || paradoRef.current) return;
            const cfg = lerConfig();
            const rad = radianosPorPonto(cfg.sensibilidade);
            olhar.current.yaw -= e.movementX * rad;
            const y = cfg.inverterY ? -e.movementY : e.movementY;
            olhar.current.pitch = Math.max(-LIMITE_OLHAR, Math.min(LIMITE_OLHAR, olhar.current.pitch - y * rad));
        };
        const aoApertar = (e: KeyboardEvent) => {
            if (estaDigitando(e) || e.ctrlKey || e.metaKey || e.altKey) return;
            teclas.current.add(e.code);
            if (e.code === "Space") {
                // sem isso o Espaço rola a página ou clica no botão que estiver com foco
                e.preventDefault();
                if (!e.repeat) querPular.current = true;
            }
        };
        const aoSoltar = (e: KeyboardEvent) => teclas.current.delete(e.code);
        const aoSairDaJanela = () => teclas.current.clear();

        area.addEventListener("click", aoClicar);
        document.addEventListener("wheel", aoRodar, { passive: true });
        document.addEventListener("pointerlockchange", aoMudarTrava);
        document.addEventListener("mousemove", aoMexer);
        window.addEventListener("keydown", aoApertar);
        window.addEventListener("keyup", aoSoltar);
        window.addEventListener("blur", aoSairDaJanela);
        return () => {
            area.removeEventListener("click", aoClicar);
            document.removeEventListener("wheel", aoRodar);
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

    // a porta do elevador fechada também é parede
    const portaElevador = useMemo(() => solidoDeRet(planta.portaElevador, 0, ALTURA_ELEVADOR), [planta]);
    const solidos = () => (portaFechada.current ? [...planta.solidos, portaElevador] : planta.solidos);

    // altura do teto onde você está (pra não atravessar com o pulo)
    function teto(p: Ponto) {
        if (dentro(planta.elevador, p)) return ALTURA_ELEVADOR;
        const s = planta.salas.find((q) => dentro(q.ret, p));
        if (s) return s.altura;
        if (dentro(planta.hall, p)) return ALTURA_HALL;
        return ALTURA;
    }

    // levanta e fica em pé na frente do lugar (um pouco mais longe se ali estiver ocupado)
    function levantar() {
        const f = fisica.current;
        const a = f.assento;
        if (!a) return;
        const p = pose.current;
        const fx = -Math.sin(a.rot);
        const fz = -Math.cos(a.rot);
        const tentativas: Ponto[] = [0.8, 1.1, 1.4].map((d) => ({ x: a.x + fx * d, z: a.z + fz * d }));
        const alvo = tentativas.find((q) => pontoLivre(solidos(), q, a.y)) ?? tentativas[0]!;
        p.x = alvo.x;
        p.z = alvo.z;
        p.y = alturaChao(solidos(), alvo, a.y);
        f.antes = { x: p.x, y: p.y, z: p.z };
        f.assento = null;
        f.vx = f.vz = f.vy = 0;
        f.noChao = true;
    }

    // ---------- um tick da física (Source) ----------

    function atrito(dt: number) {
        const f = fisica.current;
        const vel = Math.hypot(f.vx, f.vz);
        if (vel < 0.001) {
            f.vx = f.vz = 0;
            return;
        }
        const controle = vel < PARADA ? PARADA : vel;
        const nova = Math.max(0, vel - controle * ATRITO * dt);
        f.vx *= nova / vel;
        f.vz *= nova / vel;
    }

    // soma velocidade na direção desejada até chegar em `desejada` (no ar, só até MAXIMO_AR
    // na direção apertada — é isso que deixa ganhar velocidade virando o mouse com A/D no pulo)
    function acelerar(dirX: number, dirZ: number, desejada: number, aceleracao: number, limite: number, dt: number) {
        const f = fisica.current;
        const atual = f.vx * dirX + f.vz * dirZ;
        const falta = Math.min(desejada, limite) - atual;
        if (falta <= 0) return;
        const soma = Math.min(aceleracao * desejada * dt, falta);
        f.vx += soma * dirX;
        f.vz += soma * dirZ;
    }

    function tick(dt: number, frente: number, lado: number, agachar: boolean, devagar: boolean, pular: boolean) {
        const f = fisica.current;
        const p = pose.current;
        f.antes = { x: p.x, y: p.y, z: p.z };
        f.agachado = agachar;

        // direção que você quer ir, no andar: frente = (-sen yaw, -cos yaw); direita = (cos yaw, -sen yaw)
        const yaw = olhar.current.yaw;
        const intensidade = Math.min(1, Math.hypot(frente, lado));
        let dirX = 0;
        let dirZ = 0;
        if (intensidade > 0.05) {
            const norma = Math.hypot(frente, lado);
            const fr = frente / norma;
            const la = lado / norma;
            dirX = -Math.sin(yaw) * fr + Math.cos(yaw) * la;
            dirZ = -Math.cos(yaw) * fr - Math.sin(yaw) * la;
        }
        const desejada = VELOCIDADE * (agachar ? FATOR_AGACHADO : devagar ? FATOR_DEVAGAR : 1) * intensidade;

        if (f.noChao) {
            if (pular) {
                // pulou: sai do chão antes do atrito (bhop no tick certo não perde nada)
                f.vy = PULO;
                f.noChao = false;
            } else {
                atrito(dt);
            }
        }
        if (f.noChao) acelerar(dirX, dirZ, desejada, ACELERACAO, Infinity, dt);
        else acelerar(dirX, dirZ, desejada, ACELERACAO_AR, MAXIMO_AR, dt);

        // andar com colisão: o que fica acima do degrau que dá pra subir (e abaixo da cabeça) é parede
        const lista = solidos();
        const novo = mover(p, { x: p.x + f.vx * dt, z: p.z + f.vz * dt }, lista, p.y, p.y + (agachar ? ALTURA_AGACHADO : ALTURA_CORPO));
        // bateu: a velocidade fica só no que deu pra andar (desliza na parede, não acumula)
        const realX = (novo.x - p.x) / dt;
        const realZ = (novo.z - p.z) / dt;
        if (Math.abs(realX) < Math.abs(f.vx)) f.vx = realX;
        if (Math.abs(realZ) < Math.abs(f.vz)) f.vz = realZ;
        p.x = novo.x;
        p.z = novo.z;

        // chão, gravidade e teto
        const chao = alturaChao(lista, p, p.y);
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
            // o limite é a câmera não passar do teto (pela cabeça, o pulo do CS bateria nos 3,2 m do corredor)
            const limite = teto(p) - 0.1 - OLHOS[agachar ? POSTURA.AGACHADO : POSTURA.EM_PE];
            if (p.y > limite && f.vy > 0) {
                p.y = limite;
                f.vy = 0;
            }
            if (p.y <= chao) {
                p.y = chao;
                f.vy = 0;
                f.noChao = true;
            }
        }
    }

    useFrame((_, delta) => {
        // aba em segundo plano / travada: não tenta recuperar segundos de física de uma vez
        const dt = Math.min(delta, 0.25);
        const t = teclas.current;
        const p = pose.current;
        const f = fisica.current;
        const toq = toque.current;
        const cfg = lerConfig();

        // campo de visão das configurações
        const cam = camera as THREE.PerspectiveCamera;
        const fov = fovVertical(cfg.fov);
        if (Math.abs(cam.fov - fov) > 0.01) {
            cam.fov = fov;
            cam.updateProjectionMatrix();
        }

        // olhar pelo toque
        if (toq.olhar.x || toq.olhar.y) {
            olhar.current.yaw -= toq.olhar.x * SENSIBILIDADE_TOQUE;
            olhar.current.pitch = Math.max(-LIMITE_OLHAR, Math.min(LIMITE_OLHAR, olhar.current.pitch - toq.olhar.y * SENSIBILIDADE_TOQUE));
            toq.olhar.x = 0;
            toq.olhar.y = 0;
        }
        if (toq.pular) {
            querPular.current = true;
            toq.pular = false;
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
        const agachar = (t.has("KeyC") || toq.agachado) && !paradoRef.current;
        const devagar = t.has("ShiftLeft") || t.has("ShiftRight");
        const segurandoPulo = t.has("Space") && !paradoRef.current;

        // ---------- sentar / levantar ----------
        const pedidoAgora = pedido.current;
        pedido.current = null;
        if (pedidoAgora?.tipo === "sentar" && !f.assento) {
            const a = pedidoAgora.assento;
            f.assento = a;
            p.x = a.x;
            p.z = a.z;
            p.y = a.y;
            f.antes = { x: p.x, y: p.y, z: p.z };
            f.vx = f.vz = f.vy = 0;
            olhar.current.yaw = a.rot;
            olhar.current.pitch = 0;
        } else if (f.assento && (pedidoAgora?.tipo === "levantar" || querPular.current || intensidade > 0.3)) {
            querPular.current = false;
            levantar();
        }

        let novaPostura: number;
        if (f.assento) {
            // sentado: só olha em volta
            novaPostura = POSTURA.SENTADO;
            f.acumulado = 0;
        } else {
            f.acumulado += dt;
            while (f.acumulado >= TICK) {
                const pular = !paradoRef.current && (querPular.current || (cfg.autoBhop && segurandoPulo));
                querPular.current = false;
                tick(TICK, frente, lado, agachar, devagar, pular && f.noChao);
                f.acumulado -= TICK;
            }
            novaPostura = agachar ? POSTURA.AGACHADO : POSTURA.EM_PE;
        }
        velocidade.current = f.assento ? 0 : Math.hypot(f.vx, f.vz);

        // ---------- câmera (entre o tick anterior e o atual) ----------
        const alfa = f.assento ? 1 : f.acumulado / TICK;
        const x = f.antes.x + (p.x - f.antes.x) * alfa;
        const y = f.antes.y + (p.y - f.antes.y) * alfa;
        const z = f.antes.z + (p.z - f.antes.z) * alfa;
        f.olhos += (OLHOS[novaPostura] - f.olhos) * Math.min(1, dt * 12);
        const alvoY = y + f.olhos;
        // no chão suaviza (degrau não dá tranco); no ar segue direto
        f.cameraY = f.noChao ? f.cameraY + (alvoY - f.cameraY) * Math.min(1, dt * 18) : alvoY;
        camera.position.set(x, f.cameraY, z);
        camera.rotation.set(olhar.current.pitch, olhar.current.yaw, 0, "YXZ");

        p.rot = olhar.current.yaw;
        p.pitch = olhar.current.pitch;
        p.postura = novaPostura;
        if (novaPostura !== postura.current) {
            postura.current = novaPostura;
            onPostura(novaPostura);
        }

        atualizarSala(p);
        atualizarFoco(p, olhar.current.yaw, olhar.current.pitch, f.cameraY, !!f.assento);
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

    // a mira (o centro da tela) acerta a tela do holograma do chat desta sala?
    function miraNoChat(it: Interativo, p: Ponto, yaw: number, pitch: number, olhosY: number) {
        const h = planta.salas.find((s) => s.canalId === it.canalId)?.chat;
        if (!h) return false;
        // direção da câmera
        const dx = -Math.sin(yaw) * Math.cos(pitch);
        const dy = Math.sin(pitch);
        const dz = -Math.cos(yaw) * Math.cos(pitch);
        // olhando pra frente da tela?
        const deFrente = dx * h.nx + dz * h.nz;
        if (deFrente >= -0.05) return false;
        // onde o raio da mira encontra o plano da tela
        const t = ((h.x - p.x) * h.nx + (h.z - p.z) * h.nz) / deFrente;
        if (t <= 0 || t > it.raio) return false;
        const u = (p.x + dx * t - h.x) * h.ux + (p.z + dz * t - h.z) * h.uz;
        const v = olhosY + dy * t - h.y;
        return Math.abs(u) <= h.largura / 2 && Math.abs(v) <= h.altura / 2;
    }

    function atualizarFoco(p: Ponto, yaw: number, pitch: number, olhosY: number, sentado: boolean) {
        let melhor: Interativo | null = null;
        let menor = Infinity;
        for (const it of planta.interativos) {
            // holograma do chat: só com a mira em cima dele, e aí ganha dos outros (foi de propósito)
            if (it.tipo === "chat") {
                if (miraNoChat(it, p, yaw, pitch, olhosY)) {
                    melhor = it;
                    break;
                }
                continue;
            }
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
