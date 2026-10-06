import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as EventoPonteiro, type RefObject } from "react";
import { Canvas } from "@react-three/fiber";
import { useParticipants, useSpeakingParticipants } from "@livekit/components-react";
import { Hash, LayoutPanelLeft, X } from "lucide-react";
import type { Canal, ServidorDetalhe, ServidorResumo, Usuario } from "../../api";
import type { MapaMembros, Voz } from "../../tipos";
import { CanalTexto } from "../CanalTexto";
import { pessoaDoParticipante } from "../chamada/AoVivo";
import { Cena, type InfoSala } from "./Cena";
import { Jogador, travarMouse, type Alvo, type Comandos } from "./Jogador";
import { montarPlanta, type SalaPlanta } from "./planta";
import "../../styles/predio.css";

type Props = {
    servidores: ServidorResumo[];
    servidor: ServidorDetalhe | null;
    eu: Usuario;
    voz: Voz | null;
    membros: MapaMembros;
    onTrocarAndar: (id: string) => void;
    onEntrarSala: (canal: Canal) => void;
    onSairSala: () => void;
    onSair3D: () => void;
};

// a chave muda a cada troca, pra animação recomeçar mesmo quando uma transição emenda na outra
type Transicao = { andar: number; nome: string; chave: number };

const ehToque = () => window.matchMedia("(pointer: coarse)").matches;

// o servidor como um prédio em primeira pessoa: cada servidor é um andar, as salas de voz são
// salas de verdade (entrar pela porta = entrar na chamada) e os canais de texto ficam no mural
export default function Predio(props: Props) {
    const { servidores, eu, voz, membros } = props;

    // durante a troca de andar o servidor novo ainda está carregando: segue mostrando o anterior
    const ultimo = useRef(props.servidor);
    if (props.servidor) ultimo.current = props.servidor;
    const servidor = props.servidor ?? ultimo.current;

    const comandos = useRef<Comandos>({ toque: { x: 0, y: 0 }, portas: 0, interagir: false });
    const tela = useRef<HTMLCanvasElement | null>(null);
    const [travado, setTravado] = useState(false);
    // o navegador não deixou travar o mouse: dá pra olhar arrastando
    const [semTrava, setSemTrava] = useState(false);
    const recusarTrava = useCallback(() => setSemTrava(true), []);
    const [alvo, setAlvo] = useState<Alvo | null>(null);
    const [salaAtual, setSalaAtual] = useState<SalaPlanta | null>(null);
    const [canalAberto, setCanalAberto] = useState<Canal | null>(null);
    const [elevadorAberto, setElevadorAberto] = useState(false);
    const [transicao, setTransicao] = useState<Transicao | null>(null);
    const [portasAbertas, setPortasAbertas] = useState(false);
    const [renascer, setRenascer] = useState(0);
    const salaAnterior = useRef<SalaPlanta | null>(null);
    const toque = useMemo(ehToque, []);

    const andar = servidor ? servidores.findIndex((s) => s.id === servidor.id) + 1 : 1;
    const planta = useMemo(() => montarPlanta(servidor?.canais ?? []), [servidor?.canais]);

    // quem está em cada sala: na sua, direto do LiveKit (com quem fala); nas outras, o que o servidor diz
    const participantes = useParticipants();
    const falando = useSpeakingParticipants();
    const salas = useMemo(() => {
        const ids = new Set(falando.map((p) => p.identity));
        const mapa = new Map<string, InfoSala>();
        for (const c of servidor?.canais ?? []) {
            if (c.tipo !== "VOZ") continue;
            if (voz?.canal.id === c.id) {
                mapa.set(c.id, {
                    contagem: participantes.length,
                    voceAqui: true,
                    pessoas: participantes
                        .filter((p) => !p.isLocal)
                        .map((p) => ({ id: p.identity, nome: pessoaDoParticipante(p, membros, eu).nome, falando: ids.has(p.identity) })),
                });
            } else {
                const lista = c.participantes ?? [];
                mapa.set(c.id, {
                    contagem: lista.length,
                    voceAqui: false,
                    pessoas: lista.filter((u) => u.id !== eu.id).map((u) => ({ id: u.id, nome: u.nome, falando: false })),
                });
            }
        }
        return mapa;
    }, [servidor?.canais, voz?.canal.id, participantes, falando, membros, eu]);

    // ponteiro travado = você está "dentro" da cena
    useEffect(() => {
        const mudou = () => setTravado(!!tela.current && document.pointerLockElement === tela.current);
        const recusou = () => setSemTrava(true);
        document.addEventListener("pointerlockchange", mudou);
        document.addEventListener("pointerlockerror", recusou);
        return () => {
            document.removeEventListener("pointerlockchange", mudou);
            document.removeEventListener("pointerlockerror", recusou);
            if (document.pointerLockElement) document.exitPointerLock();
        };
    }, []);

    // chegou num andar (pela primeira vez, pelo elevador ou pelas abas): volta pro elevador e as portas abrem
    const servidorId = props.servidor?.id;
    useEffect(() => {
        if (!servidorId) return;
        const s = servidores.find((x) => x.id === servidorId);
        setRenascer((n) => n + 1);
        setPortasAbertas(false);
        // você reaparece no elevador: não está mais em sala nenhuma (a chamada, se tiver, continua pela ilha)
        salaAnterior.current = null;
        setSalaAtual(null);
        setTransicao({ andar: servidores.findIndex((x) => x.id === servidorId) + 1, nome: s?.nome ?? "", chave: Date.now() });
        setCanalAberto(null);
        const sumir = setTimeout(() => setTransicao(null), 950);
        const abrir = setTimeout(() => setPortasAbertas(true), 1150);
        return () => {
            clearTimeout(sumir);
            clearTimeout(abrir);
        };
        // só quando o andar muda; a lista de servidores não muda o andar
    }, [servidorId]);

    const soltarPonteiro = () => {
        if (document.pointerLockElement) document.exitPointerLock();
    };

    // entrar pela porta entra na chamada; sair da sala sai dela
    const atual = useRef({ voz, onEntrarSala: props.onEntrarSala, onSairSala: props.onSairSala, servidor });
    atual.current = { voz, onEntrarSala: props.onEntrarSala, onSairSala: props.onSairSala, servidor };

    const aoMudarSala = useCallback((sala: SalaPlanta | null) => {
        const antes = salaAnterior.current;
        salaAnterior.current = sala;
        setSalaAtual(sala);
        const { voz, onEntrarSala, onSairSala } = atual.current;
        if (sala) {
            if (voz?.canal.id !== sala.canal.id) onEntrarSala(sala.canal);
        } else if (antes && voz?.canal.id === antes.canal.id) {
            onSairSala();
        }
    }, []);

    const aoInteragir = useCallback((a: Alvo) => {
        if (a.tipo === "elevador") {
            setElevadorAberto(true);
            soltarPonteiro();
            return;
        }
        const canal = atual.current.servidor?.canais.find((c) => c.id === a.canalId);
        if (canal) {
            setCanalAberto(canal);
            soltarPonteiro();
        }
    }, []);

    function escolherAndar(id: string) {
        setElevadorAberto(false);
        if (id === servidor?.id) return;
        const i = servidores.findIndex((s) => s.id === id);
        // as portas fecham, a tela escurece com o número do andar e aí o andar troca
        setPortasAbertas(false);
        setTimeout(() => setTransicao({ andar: i + 1, nome: servidores[i]?.nome ?? "", chave: Date.now() }), 450);
        setTimeout(() => props.onTrocarAndar(id), 750);
    }

    // Esc fecha o chat do mural e o painel do elevador
    useEffect(() => {
        const aoTeclar = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            if (elevadorAberto) setElevadorAberto(false);
            else if (canalAberto && !(e.target as HTMLElement | null)?.closest("textarea, input")) setCanalAberto(null);
        };
        window.addEventListener("keydown", aoTeclar);
        return () => window.removeEventListener("keydown", aoTeclar);
    }, [elevadorAberto, canalAberto]);

    const pausado = !!canalAberto || elevadorAberto || !!transicao;
    // dá pra andar e mirar: mouse travado, celular, ou arrastando quando a trava foi recusada
    const livre = travado || toque || semTrava;
    const nomeAlvo = alvo?.tipo === "mural" ? servidor?.canais.find((c) => c.id === alvo.canalId)?.nome : null;

    return (
        <div className={`predio ${travado ? "travado" : ""} ${semTrava && !toque ? "sem-trava" : ""}`}>
            <Canvas
                className="predio-tela"
                camera={{ fov: 72, near: 0.05, far: 80 }}
                dpr={[1, 1.75]}
                onCreated={({ gl }) => {
                    tela.current = gl.domElement;
                }}
            >
                {servidor && (
                    <Cena
                        planta={planta}
                        andar={andar}
                        servidorNome={servidor.nome}
                        salas={salas}
                        alvo={alvo}
                        comandos={comandos}
                        portasAbertas={portasAbertas}
                    />
                )}
                <Jogador
                    planta={planta}
                    comandos={comandos}
                    renascer={renascer}
                    pausado={pausado}
                    semTrava={semTrava}
                    onTravaRecusada={recusarTrava}
                    onSala={aoMudarSala}
                    onAlvo={setAlvo}
                    onInteragir={aoInteragir}
                />
            </Canvas>

            {/* ---------- HUD ---------- */}

            <div className="predio-topo">
                <span className="predio-andar">
                    <strong>{andar}º andar</strong>
                    <span className="truncar">{salaAtual ? `Na sala ${salaAtual.canal.nome}` : servidor?.nome}</span>
                </span>
                <button className="predio-sair" onClick={props.onSair3D}>
                    <LayoutPanelLeft size={16} />
                    Vista normal
                </button>
            </div>

            {livre && !pausado && <span className="predio-mira" aria-hidden="true" />}

            {alvo && !pausado && livre && (
                <button className="predio-acao" onClick={() => (comandos.current.interagir = true)}>
                    {!toque && <kbd>E</kbd>}
                    {alvo.tipo === "elevador" ? "Escolher andar" : `Abrir #${nomeAlvo ?? ""}`}
                </button>
            )}

            {semTrava && !toque && !pausado && (
                <p className="predio-dica">Arraste pra olhar em volta. WASD pra andar, E ou clique pra usar.</p>
            )}

            {!livre && !pausado && (
                <button className="predio-comecar" onClick={() => travarMouse(tela.current, recusarTrava)}>
                    <strong>Clique pra andar pelo prédio</strong>
                    <span className="predio-teclas">
                        <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> andar</span>
                        <span><kbd>←</kbd><kbd>→</kbd> virar</span>
                        <span><kbd>Shift</kbd> correr</span>
                        <span><kbd>E</kbd> usar</span>
                        <span><kbd>Esc</kbd> soltar o mouse</span>
                    </span>
                    <small>Entre numa sala pela porta pra entrar na chamada. Os canais de texto estão no mural, à esquerda do elevador.</small>
                </button>
            )}

            {toque && !pausado && <Joystick comandos={comandos} />}

            {canalAberto && (
                <aside className="predio-chat" aria-label={`Canal ${canalAberto.nome}`}>
                    <header className="predio-chat-topo">
                        <Hash size={18} />
                        <strong className="truncar">{canalAberto.nome}</strong>
                        <button className="botao-icone" onClick={() => setCanalAberto(null)} aria-label="Fechar e voltar a andar">
                            <X size={18} />
                        </button>
                    </header>
                    <CanalTexto key={canalAberto.id} canal={canalAberto} eu={eu} />
                </aside>
            )}

            {elevadorAberto && (
                <div className="predio-elevador" role="dialog" aria-label="Elevador" onMouseDown={() => setElevadorAberto(false)}>
                    <div className="predio-elevador-painel" onMouseDown={(e) => e.stopPropagation()}>
                        <h2>Pra qual andar?</h2>
                        <ol>
                            {[...servidores].reverse().map((s) => {
                                const numero = servidores.indexOf(s) + 1;
                                const aqui = s.id === servidor?.id;
                                const comVoce = voz?.servidorId === s.id;
                                return (
                                    <li key={s.id}>
                                        <button className={aqui ? "aqui" : ""} onClick={() => escolherAndar(s.id)} autoFocus={aqui}>
                                            <span className="predio-andar-numero">{numero}</span>
                                            <span className="predio-andar-nome truncar">{s.nome}</span>
                                            {aqui ? <span className="predio-andar-nota">Você está aqui</span> : comVoce ? <span className="predio-andar-nota">Sua chamada</span> : null}
                                        </button>
                                    </li>
                                );
                            })}
                        </ol>
                        <button className="botao botao-fantasma botao-largo" onClick={() => setElevadorAberto(false)}>
                            Ficar neste andar
                        </button>
                    </div>
                </div>
            )}

            {transicao && (
                <div key={transicao.chave} className="predio-transicao" aria-live="polite">
                    <span className="predio-transicao-numero">{transicao.andar}</span>
                    <span className="predio-transicao-nome">{transicao.nome}</span>
                </div>
            )}
        </div>
    );
}

// joystick do celular: arrastar o pino anda pra direção dele
function Joystick({ comandos }: { comandos: RefObject<Comandos> }) {
    const base = useRef<HTMLDivElement>(null);
    const [pino, setPino] = useState({ x: 0, y: 0 });
    const MAX = 44;

    function mover(e: EventoPonteiro<HTMLDivElement>) {
        const r = base.current?.getBoundingClientRect();
        if (!r) return;
        let dx = e.clientX - (r.left + r.width / 2);
        let dy = e.clientY - (r.top + r.height / 2);
        const d = Math.hypot(dx, dy);
        if (d > MAX) {
            dx = (dx / d) * MAX;
            dy = (dy / d) * MAX;
        }
        setPino({ x: dx, y: dy });
        comandos.current.toque = { x: dx / MAX, y: -dy / MAX };
    }

    function soltar() {
        setPino({ x: 0, y: 0 });
        comandos.current.toque = { x: 0, y: 0 };
    }

    return (
        <div
            ref={base}
            className="predio-joystick"
            onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                mover(e);
            }}
            onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && mover(e)}
            onPointerUp={soltar}
            onPointerCancel={soltar}
            aria-label="Andar"
        >
            <span className="predio-joystick-pino" style={{ transform: `translate(${pino.x}px, ${pino.y}px)` }} />
        </div>
    );
}
