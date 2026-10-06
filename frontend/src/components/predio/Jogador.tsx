import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Raycaster, Vector2 } from "three";
import { estaDigitando } from "../../lib/util";
import { NASCER, PORTA_ELEVADOR, dentroDoElevador, salaEm, type Parede, type Planta, type SalaPlanta } from "./planta";

// o que dá pra usar olhando pra ele (E, clique ou toque)
export type Alvo = { tipo: "mural"; canalId: string } | { tipo: "elevador" };

// estado compartilhado entre a cena, o jogador e os controles de toque (fora do React, muda todo quadro)
export type Comandos = {
    // joystick do celular: x = de lado, y = pra frente (-1 a 1)
    toque: { x: number; y: number };
    // 0 = portas do elevador fechadas, 1 = abertas (a cena anima)
    portas: number;
    interagir: boolean;
};

type Props = {
    planta: Planta;
    comandos: RefObject<Comandos>;
    // muda quando o andar troca: você volta pro elevador
    renascer: number;
    // painel aberto ou trocando de andar: não anda nem olha
    pausado: boolean;
    // o navegador recusou travar o mouse: olhar é arrastando
    semTrava: boolean;
    onTravaRecusada: () => void;
    onSala: (sala: SalaPlanta | null) => void;
    onAlvo: (alvo: Alvo | null) => void;
    onInteragir: (alvo: Alvo) => void;
};

const RAIO = 0.3;
const OLHO = 1.62;
const ANDANDO = 3.2;
const CORRENDO = 5.6;
const SENSIBILIDADE = 0.0022;
const LIMITE_OLHAR = 1.35;
// setas ←/→ viram a câmera: dá pra andar pelo prédio só com o teclado, sem mouse
const GIRO_TECLADO = 2.2;
const TECLAS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight"]);

const movimentoReduzido = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// pede pra travar o mouse na tela; alguns navegadores e páginas embutidas recusam
export function travarMouse(tela: HTMLElement | null, aoRecusar: () => void) {
    if (!tela?.requestPointerLock) return aoRecusar();
    try {
        const pedido = tela.requestPointerLock() as unknown;
        if (pedido instanceof Promise) pedido.catch(aoRecusar);
    } catch {
        aoRecusar();
    }
}

// empurra o círculo do jogador pra fora de uma parede (caixa no plano xz)
function colidir(p: { x: number; z: number }, parede: Parede) {
    const minX = parede.cx - parede.w / 2;
    const maxX = parede.cx + parede.w / 2;
    const minZ = parede.cz - parede.d / 2;
    const maxZ = parede.cz + parede.d / 2;
    const qx = Math.max(minX, Math.min(p.x, maxX));
    const qz = Math.max(minZ, Math.min(p.z, maxZ));
    const dx = p.x - qx;
    const dz = p.z - qz;
    const dist = Math.hypot(dx, dz);
    if (dist >= RAIO) return;
    if (dist > 1e-6) {
        p.x += (dx / dist) * (RAIO - dist);
        p.z += (dz / dist) * (RAIO - dist);
        return;
    }
    // o centro entrou na parede: sai pelo lado mais perto
    const saidas = [p.x - minX + RAIO, maxX - p.x + RAIO, p.z - minZ + RAIO, maxZ - p.z + RAIO];
    const menor = Math.min(...saidas);
    if (menor === saidas[0]) p.x = minX - RAIO;
    else if (menor === saidas[1]) p.x = maxX + RAIO;
    else if (menor === saidas[2]) p.z = minZ - RAIO;
    else p.z = maxZ + RAIO;
}

// você, em primeira pessoa: anda, olha, bate nas paredes, entra nas salas e mira no que dá pra usar
export function Jogador({ planta, comandos, renascer, pausado, semTrava, onTravaRecusada, onSala, onAlvo, onInteragir }: Props) {
    const { camera, gl, scene, size } = useThree();
    const pos = useRef({ ...NASCER });
    const yaw = useRef(0);
    const pitch = useRef(0);
    const teclas = useRef(new Set<string>());
    const passos = useRef(0);
    const sala = useRef<SalaPlanta | null>(null);
    const alvo = useRef<Alvo | null>(null);
    const raycaster = useMemo(() => new Raycaster(undefined, undefined, 0, 3.4), []);
    const centro = useMemo(() => new Vector2(0, 0), []);

    // callbacks e flags lidos dentro do loop sem recriar listeners
    const atual = useRef({ pausado, semTrava, onTravaRecusada, onSala, onAlvo, onInteragir });
    atual.current = { pausado, semTrava, onTravaRecusada, onSala, onAlvo, onInteragir };

    useEffect(() => {
        camera.rotation.order = "YXZ";
    }, [camera]);

    // em tela muito larga, 72° de altura viram olho de peixe: limita o campo horizontal a ~100°
    useEffect(() => {
        if (!("fov" in camera)) return;
        const proporcao = size.width / Math.max(size.height, 1);
        const vertical = (2 * Math.atan(Math.tan((50 * Math.PI) / 180) / proporcao) * 180) / Math.PI;
        camera.fov = Math.min(70, vertical);
        camera.updateProjectionMatrix();
    }, [camera, size]);

    // andar novo: volta pro elevador olhando pro corredor
    useEffect(() => {
        pos.current = { ...NASCER };
        yaw.current = 0;
        pitch.current = 0;
        sala.current = null;
    }, [renascer]);

    // teclado
    useEffect(() => {
        const baixo = (e: KeyboardEvent) => {
            if (estaDigitando(e) || e.ctrlKey || e.metaKey || e.altKey) return;
            if (TECLAS.has(e.code)) {
                teclas.current.add(e.code);
                if (e.code.startsWith("Arrow")) e.preventDefault();
            }
            if (e.code === "KeyE" && !e.repeat) comandos.current.interagir = true;
        };
        const cima = (e: KeyboardEvent) => teclas.current.delete(e.code);
        const limpar = () => teclas.current.clear();
        window.addEventListener("keydown", baixo);
        window.addEventListener("keyup", cima);
        window.addEventListener("blur", limpar);
        return () => {
            window.removeEventListener("keydown", baixo);
            window.removeEventListener("keyup", cima);
            window.removeEventListener("blur", limpar);
        };
    }, [comandos]);

    // mouse (com o ponteiro travado) e toque (arrastar pra olhar, tocar pra usar)
    useEffect(() => {
        const tela = gl.domElement;
        const olhar = (dx: number, dy: number, sens: number) => {
            yaw.current -= dx * sens;
            pitch.current = Math.max(-LIMITE_OLHAR, Math.min(LIMITE_OLHAR, pitch.current - dy * sens));
        };

        // sem a trava, olhar é arrastar com o botão apertado
        let arrasto = 0;
        const moverMouse = (e: MouseEvent) => {
            if (atual.current.pausado) return;
            if (document.pointerLockElement === tela) {
                olhar(e.movementX, e.movementY, SENSIBILIDADE);
            } else if (atual.current.semTrava && e.buttons & 1) {
                arrasto += Math.abs(e.movementX) + Math.abs(e.movementY);
                olhar(e.movementX, e.movementY, SENSIBILIDADE * 1.6);
            }
        };
        const apertar = (e: PointerEvent) => {
            if (e.pointerType === "mouse") arrasto = 0;
        };

        const clicar = (e: MouseEvent) => {
            if (atual.current.pausado || (e as PointerEvent).pointerType === "touch") return;
            if (document.pointerLockElement === tela) {
                comandos.current.interagir = true;
            } else if (atual.current.semTrava) {
                // clique sem arrastar usa o que está na mira
                if (arrasto < 6) comandos.current.interagir = true;
            } else {
                travarMouse(tela, atual.current.onTravaRecusada);
            }
        };

        let dedo: { id: number; x: number; y: number; inicio: number; andou: number } | null = null;
        const tocar = (e: PointerEvent) => {
            if (e.pointerType !== "touch" || dedo) return;
            dedo = { id: e.pointerId, x: e.clientX, y: e.clientY, inicio: performance.now(), andou: 0 };
        };
        const arrastar = (e: PointerEvent) => {
            if (!dedo || e.pointerId !== dedo.id || atual.current.pausado) return;
            const dx = e.clientX - dedo.x;
            const dy = e.clientY - dedo.y;
            dedo.andou += Math.abs(dx) + Math.abs(dy);
            dedo.x = e.clientX;
            dedo.y = e.clientY;
            olhar(dx, dy, 0.005);
        };
        const soltar = (e: PointerEvent) => {
            if (!dedo || e.pointerId !== dedo.id) return;
            if (dedo.andou < 10 && performance.now() - dedo.inicio < 300) comandos.current.interagir = true;
            dedo = null;
        };

        document.addEventListener("mousemove", moverMouse);
        tela.addEventListener("pointerdown", apertar);
        tela.addEventListener("click", clicar);
        tela.addEventListener("pointerdown", tocar);
        window.addEventListener("pointermove", arrastar);
        window.addEventListener("pointerup", soltar);
        window.addEventListener("pointercancel", soltar);
        return () => {
            document.removeEventListener("mousemove", moverMouse);
            tela.removeEventListener("pointerdown", apertar);
            tela.removeEventListener("click", clicar);
            tela.removeEventListener("pointerdown", tocar);
            window.removeEventListener("pointermove", arrastar);
            window.removeEventListener("pointerup", soltar);
            window.removeEventListener("pointercancel", soltar);
        };
    }, [gl, comandos]);

    useFrame((_, dtBruto) => {
        const dt = Math.min(dtBruto, 0.05);
        const c = comandos.current;
        const { pausado, onSala, onAlvo, onInteragir } = atual.current;
        const p = pos.current;

        // andar
        if (!pausado) {
            const t = teclas.current;
            yaw.current += ((t.has("ArrowLeft") ? 1 : 0) - (t.has("ArrowRight") ? 1 : 0)) * GIRO_TECLADO * dt;
            let frente = (t.has("KeyW") || t.has("ArrowUp") ? 1 : 0) - (t.has("KeyS") || t.has("ArrowDown") ? 1 : 0) + c.toque.y;
            let lado = (t.has("KeyD") ? 1 : 0) - (t.has("KeyA") ? 1 : 0) + c.toque.x;
            const forca = Math.hypot(frente, lado);
            if (forca > 1) {
                frente /= forca;
                lado /= forca;
            }

            if (forca > 0.05) {
                const vel = t.has("ShiftLeft") || t.has("ShiftRight") ? CORRENDO : ANDANDO;
                // com yaw = 0 a câmera olha pra -z; a direita é +x
                const sin = Math.sin(yaw.current);
                const cos = Math.cos(yaw.current);
                const paredes = c.portas < 0.9 ? [...planta.paredes, PORTA_ELEVADOR] : planta.paredes;

                p.x += (-sin * frente + cos * lado) * vel * dt;
                for (const parede of paredes) colidir(p, parede);
                p.z += (-cos * frente - sin * lado) * vel * dt;
                for (const parede of paredes) colidir(p, parede);

                passos.current += dt * vel * 2.1;
            }
        }

        const balanco = movimentoReduzido() ? 0 : Math.sin(passos.current) * 0.03;
        camera.position.set(p.x, OLHO + balanco, p.z);
        camera.rotation.set(pitch.current, yaw.current, 0);

        // entrou ou saiu de uma sala?
        const agora = salaEm(planta, p.x, p.z);
        if (agora?.canal.id !== sala.current?.canal.id) {
            sala.current = agora;
            onSala(agora);
        }

        // o que está na mira (o elevador vale de qualquer jeito quando você está dentro dele)
        let mirando: Alvo | null = null;
        if (dentroDoElevador(p.z)) {
            mirando = { tipo: "elevador" };
        } else {
            raycaster.setFromCamera(centro, camera);
            const acerto = raycaster.intersectObjects(scene.children, true)[0];
            const dado = acerto?.object.userData.alvo as Alvo | undefined;
            if (dado) mirando = dado;
        }
        const mudou = JSON.stringify(mirando) !== JSON.stringify(alvo.current);
        if (mudou) {
            alvo.current = mirando;
            onAlvo(mirando);
        }

        if (c.interagir) {
            c.interagir = false;
            if (alvo.current && !pausado) onInteragir(alvo.current);
        }
    });

    return null;
}
