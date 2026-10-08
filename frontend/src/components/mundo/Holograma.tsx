// Holograma do chat da call, flutuando na parede da porta da sala gamer (atrás do sofá).
// É luz (mistura aditiva): o fundo some, só o texto e a moldura brilham, na cor da sala.
// Só a sala da sua call mostra as mensagens; as outras ficam no "aguardando".
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { EstadoLed } from "../../tipos";
import { paletaDaSala } from "./paletas";
import { GAMER, type SalaPlanta } from "./planta";
import { FONTE, texturaLavagem } from "./texturas";

export type LinhaChat = { id: string; nome: string; texto: string; local: boolean };

const LARGURA_PX = 1024;
const ALTURA_PX = 512;
const MARGEM = 36;
// letra grande o bastante pra ler da frente da sala (a uns 6 m)
const TEXTO = 34;
const LINHA = 42;
const NOME = 40;

function rgba(hex: string, alfa: number) {
    const c = new THREE.Color(hex);
    return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${alfa})`;
}

// quebra o texto em linhas que cabem em `largura` (palavra grande demais é cortada)
function quebrar(ctx: CanvasRenderingContext2D, texto: string, largura: number) {
    const linhas: string[] = [];
    let atual = "";
    for (const palavra of texto.split(/\s+/)) {
        let p = palavra;
        while (ctx.measureText(p).width > largura) {
            let n = p.length;
            while (n > 1 && ctx.measureText(p.slice(0, n)).width > largura) n--;
            if (atual) linhas.push(atual);
            linhas.push(p.slice(0, n));
            atual = "";
            p = p.slice(n);
        }
        const tentativa = atual ? `${atual} ${p}` : p;
        if (ctx.measureText(tentativa).width > largura && atual) {
            linhas.push(atual);
            atual = p;
        } else {
            atual = tentativa;
        }
    }
    if (atual) linhas.push(atual);
    return linhas;
}

type Desenho = { nomeSala: string; mensagens: LinhaChat[] | null; corA: string; corB: string };

function desenhar(ctx: CanvasRenderingContext2D, { nomeSala, mensagens, corA, corB }: Desenho) {
    const W = LARGURA_PX;
    const H = ALTURA_PX;
    ctx.clearRect(0, 0, W, H);

    // vidro do holograma: um véu bem fraco na cor B, moldura e cantoneiras
    ctx.fillStyle = rgba(corB, 0.07);
    ctx.beginPath();
    ctx.roundRect(4, 4, W - 8, H - 8, 18);
    ctx.fill();
    ctx.strokeStyle = rgba(corB, 0.45);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = corB;
    ctx.lineWidth = 5;
    const c = 46;
    for (const [x, y, dx, dy] of [[6, 6, 1, 1], [W - 6, 6, -1, 1], [6, H - 6, 1, -1], [W - 6, H - 6, -1, -1]]) {
        ctx.beginPath();
        ctx.moveTo(x + dx * c, y);
        ctx.lineTo(x, y);
        ctx.lineTo(x, y + dy * c);
        ctx.stroke();
    }

    // cabeçalho
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.font = `700 26px ${FONTE}`;
    ctx.fillStyle = corB;
    ctx.fillText("CHAT DA CALL", MARGEM, 52);
    ctx.textAlign = "right";
    ctx.font = `600 24px ${FONTE}`;
    ctx.fillStyle = "rgba(236, 240, 255, 0.75)";
    ctx.fillText(nomeSala, W - MARGEM, 52);
    ctx.fillStyle = rgba(corB, 0.35);
    ctx.fillRect(MARGEM, 70, W - 2 * MARGEM, 2);

    // rodapé
    ctx.textAlign = "left";
    ctx.font = `500 20px ${FONTE}`;
    ctx.fillStyle = "rgba(236, 240, 255, 0.45)";
    ctx.fillText(mensagens ? "E  ·  escrever no chat" : "Entre na call pra ver o chat", MARGEM, H - 26);

    const topo = 92;
    const fundo = H - 70;
    if (!mensagens || mensagens.length === 0) {
        ctx.textAlign = "center";
        ctx.font = `500 30px ${FONTE}`;
        ctx.fillStyle = "rgba(236, 240, 255, 0.55)";
        ctx.fillText(mensagens ? "Nenhuma mensagem ainda" : "· · ·", W / 2, (topo + fundo) / 2 + 10);
    } else {
        // da mais nova (embaixo) pra mais antiga, até encher; mensagens seguidas da mesma
        // pessoa ficam sob o mesmo nome
        const largura = W - 2 * MARGEM;
        const blocos: { nome: string | null; autor: string; local: boolean; linhas: string[] }[] = [];
        let altura = 0;
        const espaco = fundo - topo;
        for (let i = mensagens.length - 1; i >= 0; i--) {
            const m = mensagens[i]!;
            const anterior = mensagens[i - 1];
            const comNome = !anterior || anterior.nome !== m.nome;
            ctx.font = `500 ${TEXTO}px ${FONTE}`;
            const linhas = quebrar(ctx, m.texto, largura);
            const h = linhas.length * LINHA + (comNome ? NOME : 0) + 8;
            // conta o nome mesmo quando é continuação: se este bloco ficar no topo, o nome aparece
            if (altura + h + (comNome ? 0 : NOME) > espaco) {
                // a que coube pela metade: mostra só o fim dela
                const sobra = Math.floor((espaco - altura - NOME - 8) / LINHA);
                if (sobra > 0) blocos.push({ nome: m.nome, autor: m.nome, local: m.local, linhas: linhas.slice(-sobra) });
                break;
            }
            blocos.push({ nome: comNome ? m.nome : null, autor: m.nome, local: m.local, linhas });
            altura += h;
        }
        // o bloco do topo sempre diz quem escreveu (a mensagem anterior dele ficou de fora)
        const doTopo = blocos[blocos.length - 1];
        if (doTopo) doTopo.nome = doTopo.autor;
        let y = fundo;
        ctx.textAlign = "left";
        for (const b of blocos) {
            for (let k = b.linhas.length - 1; k >= 0; k--) {
                ctx.font = `500 ${TEXTO}px ${FONTE}`;
                ctx.fillStyle = "rgba(236, 240, 255, 0.95)";
                ctx.fillText(b.linhas[k]!, MARGEM, y);
                y -= LINHA;
            }
            if (b.nome) {
                ctx.font = `700 ${TEXTO - 4}px ${FONTE}`;
                ctx.fillStyle = b.local ? corB : corA;
                ctx.fillText(b.nome, MARGEM, y + 2);
                y -= NOME;
            }
            y -= 8;
        }
    }

    // linhas de varredura: apaga uma faixa fina a cada 4 px
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
    ctx.globalCompositeOperation = "source-over";
}

type Props = { sala: SalaPlanta; nomeSala: string; mensagens: LinhaChat[] | null; led: EstadoLed | null };

export function Holograma({ sala, nomeSala, mensagens, led }: Props) {
    const { x, y, largura, altura } = GAMER.holograma;
    const z = GAMER.meia;
    const paleta = paletaDaSala(sala.canalId, led);
    const ligado = !led || led.ligado;

    const { ctx, textura } = useMemo(() => {
        const canvas = document.createElement("canvas");
        canvas.width = LARGURA_PX;
        canvas.height = ALTURA_PX;
        const textura = new THREE.CanvasTexture(canvas);
        textura.colorSpace = THREE.SRGBColorSpace;
        textura.anisotropy = 8;
        return { canvas, ctx: canvas.getContext("2d")!, textura };
    }, []);
    const mats = useMemo(() => ({
        tela: new THREE.MeshBasicMaterial({ map: textura, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
        feixe: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.16, alphaMap: texturaLavagem(), blending: THREE.AdditiveBlending, depthWrite: false }),
        emissor: new THREE.MeshBasicMaterial({ toneMapped: false }),
    }), [textura]);
    useEffect(() => () => {
        textura.dispose();
        Object.values(mats).forEach((m) => m.dispose());
    }, [textura, mats]);

    // redesenha só quando muda o que aparece
    const chave = JSON.stringify([nomeSala, paleta.a, paleta.b, mensagens?.slice(-30)]);
    useEffect(() => {
        desenhar(ctx, { nomeSala, mensagens: mensagens?.slice(-30) ?? null, corA: paleta.a, corB: paleta.b });
        textura.needsUpdate = true;
    }, [chave]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        mats.feixe.color.set(paleta.b);
        mats.emissor.color.set(paleta.b).multiplyScalar(ligado ? 1.5 : 0.1);
    }, [mats, paleta.b, ligado]);

    // flutua de leve e treme de vez em quando, como projeção
    const painel = useRef<THREE.Group>(null);
    useFrame(({ clock }) => {
        const t = clock.elapsedTime;
        if (painel.current) painel.current.position.y = y + Math.sin(t * 1.1) * 0.012;
        const falha = Math.sin(t * 0.7) > 0.985 ? 0.55 : 1;
        mats.tela.opacity = ligado ? (0.9 + Math.sin(t * 23) * 0.04) * falha : 0;
        mats.feixe.opacity = ligado ? 0.16 * falha : 0;
    });

    const base = y - altura / 2 - 0.14;
    return (
        <group position={[sala.centro.x, 0, sala.centro.z]} rotation={[0, sala.tv.rot, 0]}>
            {/* emissor na parede: caixa preta com a fita de LED em cima */}
            <mesh position={[x, base, z - 0.05]}>
                <boxGeometry args={[largura + 0.2, 0.05, 0.1]} />
                <meshStandardMaterial color="#09090b" roughness={0.5} />
            </mesh>
            <mesh material={mats.emissor} position={[x, base + 0.03, z - 0.07]}>
                <boxGeometry args={[largura + 0.1, 0.012, 0.012]} />
            </mesh>
            {/* o feixe subindo do emissor (a máscara de lavagem virada: forte embaixo) */}
            <mesh material={mats.feixe} position={[x, y, z - 0.09]} rotation={[0, Math.PI, Math.PI]} renderOrder={2}>
                <planeGeometry args={[largura + 0.1, altura + 0.25]} />
            </mesh>
            {/* a tela, um pouco à frente da parede, virada pra sala */}
            <group ref={painel} position={[x, y, z - 0.14]} rotation={[0, Math.PI, 0]}>
                <mesh material={mats.tela} renderOrder={3}>
                    <planeGeometry args={[largura, altura]} />
                </mesh>
            </group>
        </group>
    );
}
