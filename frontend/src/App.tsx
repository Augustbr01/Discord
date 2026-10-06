import { Suspense, lazy, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { LiveKitRoom } from "@livekit/components-react";
import { DisconnectReason, ScreenSharePresets, VideoPresets, type MediaDeviceFailure, type RoomOptions } from "livekit-client";
import { Bird, Building2, Hash, LayoutPanelLeft, Loader2, LogOut, PhoneOff, Plus, Ticket, UserPlus, Users, Volume2 } from "lucide-react";
import {
    api, mensagemDeErro, talvezDeslogado,
    type Canal, type ServidorResumo, type TipoCanal, type Usuario,
} from "./api";
import { ChatSalaProvider } from "./contexto/ChatSala";
import { ControleVozProvider } from "./contexto/ControleVoz";
import { ToastProvider, useToast } from "./contexto/Toasts";
import { useServidor } from "./hooks/useServidor";
import { gateway } from "./lib/gateway";
import { pessoasNaSala } from "./lib/salas";
import { extrairIdConvite, lerArmazenado, salvarArmazenado } from "./lib/util";
import type { MapaMembros, Voz } from "./tipos";
import { BarraTopo } from "./components/BarraTopo";
import { CanalTexto } from "./components/CanalTexto";
import { VistaVoz } from "./components/chamada/VistaVoz";
import { Login } from "./components/Login";
import { Convidar } from "./components/modais/Convidar";
import { NovoCanal } from "./components/modais/NovoCanal";
import { NovoServidor, type AbaServidor } from "./components/modais/NovoServidor";
import { Paleta, type ItemPaleta } from "./components/Paleta";
import { Praca, type AbaPraca } from "./components/Praca";
import { SemServidor } from "./components/SemServidor";
import { TopoServidor } from "./components/TopoServidor";
import { IconeServidor } from "./components/ui/Avatar";

const CHAVE_CONVITE = "convitePendente";
const CHAVE_SERVIDOR = "liberdade:servidor";
const CHAVE_CANAIS = "liberdade:canais";
const CHAVE_PRACA = "liberdade:praca";
const CHAVE_3D = "liberdade:predio";

// o prédio 3D (Three.js) só é baixado quando alguém entra nele
const Predio = lazy(() => import("./components/predio/Predio"));
const CHAVE_MIC = "liberdade:microfone";

// qualidade da chamada: 720p com camadas menores pra conexões fracas, voz com redução de ruído
const OPCOES_SALA: RoomOptions = {
    adaptiveStream: true,
    dynacast: true,
    videoCaptureDefaults: { resolution: VideoPresets.h720.resolution },
    audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    publishDefaults: {
        simulcast: true,
        videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360],
        screenShareEncoding: ScreenSharePresets.h1080fps15.encoding,
        dtx: true,
        red: true,
    },
};

type ModalAberto =
    | { tipo: "servidor"; aba: AbaServidor }
    | { tipo: "convidar" }
    | { tipo: "canal"; tipoCanal: TipoCanal }
    | null;

// quem abre /convite/<id> sem estar logado passa pelo login e volta pra "/",
// então o id fica guardado até dar pra usar
function guardarConviteDaUrl() {
    const id = location.pathname.startsWith("/convite/") ? extrairIdConvite(location.pathname) : null;
    if (id) {
        try {
            sessionStorage.setItem(CHAVE_CONVITE, id);
        } catch {
            // sem armazenamento: o convite só não sobrevive ao login
        }
        history.replaceState(null, "", "/");
    }
}

export default function App() {
    return (
        <ToastProvider>
            <Aplicacao />
        </ToastProvider>
    );
}

function Aplicacao() {
    const toast = useToast();

    // undefined = verificando, null = deslogado
    const [eu, setEu] = useState<Usuario | null | undefined>(undefined);
    const [servidores, setServidores] = useState<ServidorResumo[] | null>(null);
    const [servidorId, setServidorId] = useState<string | null>(null);
    // último canal aberto em cada servidor (só os de texto são lembrados entre visitas)
    const [canalPorServidor, setCanalPorServidor] = useState<Record<string, string>>(() => lerArmazenado(CHAVE_CANAIS, {}));
    const [voz, setVoz] = useState<Voz | null>(null);
    // muda só quando você troca direto de uma sala pra outra (força uma conexão nova)
    const [sessaoVoz, setSessaoVoz] = useState(0);
    const [entrandoEm, setEntrandoEm] = useState<string | null>(null);
    const [micPreferido, setMicPreferido] = useState(() => lerArmazenado(CHAVE_MIC, true));
    const [surdo, setSurdo] = useState(false);
    // a Praça (salas de voz e pessoas): sempre visível em tela larga; nas estreitas abre por cima
    const [pracaAberta, setPracaAberta] = useState(false);
    const [abaPraca, setAbaPraca] = useState<AbaPraca>(() => lerArmazenado<AbaPraca>(CHAVE_PRACA, "salas"));
    const [modal, setModal] = useState<ModalAberto>(null);
    const [paletaAberta, setPaletaAberta] = useState(false);
    const [modo3d, setModo3d] = useState(() => lerArmazenado(CHAVE_3D, false));

    useEffect(() => salvarArmazenado(CHAVE_MIC, micPreferido), [micPreferido]);
    useEffect(() => salvarArmazenado(CHAVE_3D, modo3d), [modo3d]);
    useEffect(() => salvarArmazenado(CHAVE_PRACA, abaPraca), [abaPraca]);

    const abrirPraca = useCallback((aba?: AbaPraca) => {
        if (aba) setAbaPraca(aba);
        setPracaAberta(true);
    }, []);

    const tratarErro = useCallback(async (err: unknown) => {
        // o erro pode ser só "não encontrado" ou a sessão ter vencido: o /dataUser tira a dúvida
        if (talvezDeslogado(err)) {
            const aindaLogado = await api.eu().then(() => true, () => false);
            if (!aindaLogado) {
                setEu(null);
                return;
            }
        }
        toast.erro(mensagemDeErro(err));
    }, [toast]);

    const { servidor: servidorCarregado, setServidor } = useServidor(eu ? servidorId : null, tratarErro);
    // evita mostrar por um instante o servidor anterior enquanto o novo carrega
    const servidor = servidorCarregado?.id === servidorId ? servidorCarregado : null;

    // 1. quem sou eu?
    useEffect(() => {
        guardarConviteDaUrl();
        api.eu().then(setEu).catch(() => setEu(null));
    }, []);

    // 2. logado: usa o convite pendente (se tiver) e carrega os servidores
    const euId = eu?.id;

    // conexão em tempo real: abre ao logar, fecha ao sair
    useEffect(() => {
        if (!euId) return;
        gateway.conectar();
        return () => gateway.desconectar();
    }, [euId]);

    useEffect(() => {
        if (!euId) return;
        let ativo = true;

        (async () => {
            let convite: string | null = null;
            try {
                convite = sessionStorage.getItem(CHAVE_CONVITE);
                sessionStorage.removeItem(CHAVE_CONVITE);
            } catch {
                // sem armazenamento: não tem convite guardado
            }

            let abrir: string | null = null;
            if (convite) {
                try {
                    const { servidor: novo } = await api.entrarConvite(convite);
                    abrir = novo.id;
                    toast.sucesso(`Você entrou em ${novo.nome}`);
                } catch (err) {
                    toast.erro(mensagemDeErro(err));
                }
            }

            try {
                const lista = await api.listarServidores();
                if (!ativo) return;
                const ultimo = lerArmazenado<string | null>(CHAVE_SERVIDOR, null);
                setServidores(lista);
                setServidorId(abrir ?? (lista.some((s) => s.id === ultimo) ? ultimo : lista[0]?.id ?? null));
            } catch (err) {
                if (!ativo) return;
                setServidores([]);
                tratarErro(err);
            }
        })();

        return () => {
            ativo = false;
        };
    }, [euId, toast, tratarErro]);

    // Ctrl/⌘ + K abre a busca rápida
    useEffect(() => {
        const aoTeclar = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setPaletaAberta((v) => !v);
            }
        };
        window.addEventListener("keydown", aoTeclar);
        return () => window.removeEventListener("keydown", aoTeclar);
    }, []);

    // canal aberto: o último deste servidor, ou o primeiro de texto
    const canalAtual = useMemo(() => {
        if (!servidor) return null;
        return (
            servidor.canais.find((c) => c.id === canalPorServidor[servidor.id]) ??
            servidor.canais.find((c) => c.tipo === "TEXTO") ??
            servidor.canais[0] ??
            null
        );
    }, [servidor, canalPorServidor]);

    const membros: MapaMembros = useMemo(
        () => new Map((servidor?.membros ?? []).map((m) => [m.usuario.id, m.usuario])),
        [servidor],
    );

    const souAdmin = !!eu && !!servidor?.membros.some((m) => m.usuario.id === eu.id && m.permissao === "ADMIN");

    // ---------- navegação ----------

    const irParaServidor = useCallback((id: string) => {
        setServidorId(id);
        setPracaAberta(false);
        salvarArmazenado(CHAVE_SERVIDOR, id);
    }, []);

    const selecionarCanal = useCallback((idServidor: string, canal: Canal) => {
        setCanalPorServidor((mapa) => ({ ...mapa, [idServidor]: canal.id }));
        if (canal.tipo === "TEXTO") {
            salvarArmazenado(CHAVE_CANAIS, { ...lerArmazenado<Record<string, string>>(CHAVE_CANAIS, {}), [idServidor]: canal.id });
        }
        setPracaAberta(false);
    }, []);

    // ---------- chamada ----------

    async function entrarNaVoz(canal: Canal) {
        if (!servidor || entrandoEm || voz?.canal.id === canal.id) return;
        setEntrandoEm(canal.id);
        try {
            const conexao = await api.tokenVoz(canal.id);
            if (voz) setSessaoVoz((n) => n + 1);
            setVoz({ canal, servidorId: servidor.id, servidorNome: servidor.nome, conexao, desde: Date.now() });
            // o gateway avisa os outros que você entrou (ENTROU_NA_CALL); nada a recarregar
        } catch (err) {
            tratarErro(err);
        } finally {
            setEntrandoEm(null);
        }
    }

    // clicar numa sala de voz já entra nela; num canal de texto, abre o chat
    function abrirCanal(canal: Canal) {
        if (!servidor) return;
        selecionarCanal(servidor.id, canal);
        if (canal.tipo === "VOZ") entrarNaVoz(canal);
    }

    const sairDaVoz = useCallback(() => {
        setVoz(null);
        // o gateway avisa os outros que você saiu (SAIU_DA_CALL)
    }, []);

    // a ilha leva pro palco da chamada (no prédio, sai pra vista normal, onde estão vídeo e tela)
    function abrirChamada() {
        if (!voz) return;
        setModo3d(false);
        irParaServidor(voz.servidorId);
        selecionarCanal(voz.servidorId, voz.canal);
    }

    async function sairDaConta() {
        setVoz(null);
        await api.sair().catch(() => {});
        setEu(null);
        setServidores(null);
        setServidorId(null);
    }

    const idVoz = voz?.canal.id;

    // callbacks estáveis: o LiveKitRoom refaz a conexão quando eles mudam
    const aoDesconectar = useCallback((motivo?: DisconnectReason) => {
        // ignora o aviso da sala antiga quando você troca de sala
        setVoz((v) => (v && v.canal.id === idVoz ? null : v));
        if (motivo !== undefined && motivo !== DisconnectReason.CLIENT_INITIATED) {
            toast.info("Você foi desconectado da sala.");
        }
    }, [idVoz, toast]);

    const aoErroNaSala = useCallback((err: Error) => {
        if (err.name === "ConnectionError") {
            setVoz(null);
            toast.erro("Não foi possível conectar à sala de voz.");
            return;
        }
        // permissão de microfone/câmera negada já é avisada pelo onMediaDeviceFailure
        if (err.name === "NotAllowedError" || err.name === "NotFoundError") return;
        toast.erro(err.message);
    }, [toast]);

    const aoFalharDispositivo = useCallback((_falha?: MediaDeviceFailure, tipo?: MediaDeviceKind) => {
        toast.erro(
            tipo === "videoinput"
                ? "Não consegui acessar a câmera. Confira as permissões do navegador."
                : "Não consegui acessar o microfone. Confira as permissões do navegador.",
        );
    }, [toast]);

    // ---------- respostas dos modais ----------

    function aoCriarOuEntrarServidor(novo: ServidorResumo, aba: AbaServidor) {
        setServidores((lista) => (lista?.some((s) => s.id === novo.id) ? lista : [...(lista ?? []), novo]));
        irParaServidor(novo.id);
        setModal(null);
        toast.sucesso(aba === "criar" ? `Servidor ${novo.nome} criado` : `Você entrou em ${novo.nome}`);
    }

    function aoCriarCanal(novo: Canal) {
        if (!servidor) return;
        setServidor((s) => (s ? { ...s, canais: [...s.canais, novo] } : s));
        setModal(null);
        // abre o canal novo (numa sala de voz, abre a tela dela sem entrar sozinho)
        selecionarCanal(servidor.id, novo);
    }

    const apagarCanal = useCallback(async (canal: Canal) => {
        if (!window.confirm(`Apagar o canal "${canal.nome}"? Isso não pode ser desfeito.`)) return;
        try {
            await api.apagarCanal(canal.id);
            // some na hora pra quem apagou; o CANAL_APAGADO também chega e é idempotente
            setServidor((s) => (s ? { ...s, canais: s.canais.filter((c) => c.id !== canal.id) } : s));
        } catch (err) {
            tratarErro(err);
        }
    }, [setServidor, tratarErro]);

    // ---------- dados derivados ----------

    // id do usuário -> sala em que está (aparece na lista de membros)
    const emChamada = useMemo(() => {
        const mapa = new Map<string, string>();
        if (!servidor || !eu) return mapa;
        for (const c of servidor.canais) {
            if (c.tipo !== "VOZ") continue;
            for (const p of pessoasNaSala(c, voz, eu)) mapa.set(p.id, c.nome);
        }
        return mapa;
    }, [servidor, voz, eu]);

    const itensPaleta: ItemPaleta[] = [];
    if (servidor) {
        for (const c of servidor.canais) {
            itensPaleta.push({
                id: c.id,
                grupo: servidor.nome,
                titulo: c.nome,
                dica: c.tipo === "TEXTO" ? "Canal de texto" : "Sala de voz",
                icone: c.tipo === "TEXTO" ? <Hash size={16} /> : <Volume2 size={16} />,
                acao: () => abrirCanal(c),
            });
        }
    }
    for (const s of servidores ?? []) {
        if (s.id === servidorId) continue;
        itensPaleta.push({
            id: `servidor-${s.id}`,
            grupo: "Servidores",
            titulo: s.nome,
            icone: <IconeServidor nome={s.nome} url={s.iconeUrl} tamanho={20} />,
            acao: () => irParaServidor(s.id),
        });
    }
    if (servidor && souAdmin) {
        itensPaleta.push(
            { id: "convidar", grupo: "Ações", titulo: "Convidar pessoas", dica: servidor.nome, icone: <UserPlus size={16} />, acao: () => setModal({ tipo: "convidar" }) },
            { id: "novo-canal", grupo: "Ações", titulo: "Criar canal de texto", dica: servidor.nome, icone: <Hash size={16} />, acao: () => setModal({ tipo: "canal", tipoCanal: "TEXTO" }) },
            { id: "nova-sala", grupo: "Ações", titulo: "Criar sala de voz", dica: servidor.nome, icone: <Volume2 size={16} />, acao: () => setModal({ tipo: "canal", tipoCanal: "VOZ" }) },
        );
    }
    itensPaleta.push(
        { id: "novo-servidor", grupo: "Ações", titulo: "Criar servidor", icone: <Plus size={16} />, acao: () => setModal({ tipo: "servidor", aba: "criar" }) },
        { id: "entrar-convite", grupo: "Ações", titulo: "Entrar com convite", icone: <Ticket size={16} />, acao: () => setModal({ tipo: "servidor", aba: "entrar" }) },
    );
    if (servidor) {
        itensPaleta.push({
            id: "pessoas",
            grupo: "Ações",
            titulo: "Ver pessoas do servidor",
            dica: servidor.nome,
            icone: <Users size={16} />,
            acao: () => abrirPraca("pessoas"),
        });
    }
    if (voz) {
        itensPaleta.push({ id: "sair-sala", grupo: "Ações", titulo: "Sair da sala de voz", dica: voz.canal.nome, icone: <PhoneOff size={16} />, acao: sairDaVoz });
    }
    itensPaleta.push({
        id: "predio",
        grupo: "Ações",
        titulo: modo3d ? "Voltar pra vista normal" : "Andar pelo prédio em 3D",
        icone: modo3d ? <LayoutPanelLeft size={16} /> : <Building2 size={16} />,
        acao: () => setModo3d((v) => !v),
    });
    itensPaleta.push({ id: "sair-conta", grupo: "Ações", titulo: "Sair da conta", icone: <LogOut size={16} />, acao: sairDaConta });

    // ---------- telas ----------

    if (eu === undefined) {
        return (
            <div className="tela-carregando">
                <Bird size={28} strokeWidth={1.8} />
                <Loader2 size={20} className="girar" />
            </div>
        );
    }

    if (eu === null) {
        return <Login />;
    }

    let conteudo: ReactNode;

    if (servidores === null || (servidorId && !servidor)) {
        conteudo = <VistaCarregando />;
    } else if (servidores.length === 0) {
        conteudo = (
            <SemServidor
                onCriar={() => setModal({ tipo: "servidor", aba: "criar" })}
                onEntrar={() => setModal({ tipo: "servidor", aba: "entrar" })}
            />
        );
    } else if (!servidor || !canalAtual) {
        conteudo = (
            <SemCanais
                souAdmin={souAdmin}
                temSalas={!!servidor?.canais.length}
                onCriar={() => setModal({ tipo: "canal", tipoCanal: "TEXTO" })}
            />
        );
    } else if (canalAtual.tipo === "TEXTO") {
        conteudo = <CanalTexto key={canalAtual.id} canal={canalAtual} eu={eu} />;
    } else {
        conteudo = (
            <VistaVoz
                canal={canalAtual}
                eu={eu}
                membros={membros}
                voz={voz}
                pessoas={pessoasNaSala(canalAtual, voz, eu)}
                entrando={entrandoEm === canalAtual.id}
                onEntrar={() => entrarNaVoz(canalAtual)}
                onSair={sairDaVoz}
            />
        );
    }

    const noPalco = !!voz && canalAtual?.id === voz.canal.id;
    // o prédio precisa de pelo menos um servidor (um andar)
    const noPredio = modo3d && !!servidores && servidores.length > 0;

    return (
        // a sala de voz fica em volta de tudo: a chamada continua enquanto você navega.
        // entrar/sair só liga e desliga a conexão; trocar direto de sala muda a key
        // e cria uma conexão nova (desconecta da antiga e conecta na nova)
        <LiveKitRoom
            key={sessaoVoz}
            serverUrl={voz?.conexao.url}
            token={voz?.conexao.token}
            connect={!!voz}
            audio={micPreferido && !surdo}
            video={false}
            options={OPCOES_SALA}
            className={`app ${servidor ? "" : "sem-praca"} ${pracaAberta ? "praca-aberta" : ""} ${voz ? "em-chamada" : ""} ${noPredio ? "modo-3d" : ""}`}
            onDisconnected={aoDesconectar}
            onError={aoErroNaSala}
            onMediaDeviceFailure={aoFalharDispositivo}
        >
            <ControleVozProvider micPreferido={micPreferido} setMicPreferido={setMicPreferido} surdo={surdo} setSurdo={setSurdo}>
                <ChatSalaProvider desde={voz?.desde ?? null}>
                    <BarraTopo
                        servidores={servidores ?? []}
                        carregando={servidores === null}
                        atualId={servidorId}
                        eu={eu}
                        voz={voz}
                        membros={membros}
                        noPalco={noPalco}
                        modo3d={noPredio}
                        onAlternar3D={() => setModo3d((v) => !v)}
                        onEscolher={irParaServidor}
                        onAdicionar={() => setModal({ tipo: "servidor", aba: "criar" })}
                        onBuscar={() => setPaletaAberta(true)}
                        onAbrirChamada={abrirChamada}
                        onSairChamada={sairDaVoz}
                        onSairConta={sairDaConta}
                    />

                    {noPredio ? (
                        <Suspense
                            fallback={
                                <div className="predio predio-carregando">
                                    <Loader2 size={20} className="girar" /> Abrindo o prédio…
                                </div>
                            }
                        >
                            <Predio
                                servidores={servidores ?? []}
                                servidor={servidor}
                                eu={eu}
                                voz={voz}
                                membros={membros}
                                onTrocarAndar={irParaServidor}
                                onEntrarSala={entrarNaVoz}
                                onSairSala={sairDaVoz}
                                onSair3D={() => setModo3d(false)}
                            />
                        </Suspense>
                    ) : (
                    <>
                    <main className="folha">
                        {servidor && (
                            <TopoServidor
                                servidor={servidor}
                                canalAtual={canalAtual}
                                souAdmin={souAdmin}
                                emChamada={emChamada.size}
                                onCanal={abrirCanal}
                                onApagarCanal={apagarCanal}
                                onConvidar={() => setModal({ tipo: "convidar" })}
                                onNovoCanal={(tipoCanal) => setModal({ tipo: "canal", tipoCanal })}
                                onAbrirPraca={() => abrirPraca("salas")}
                            />
                        )}
                        <div className="folha-conteudo">{conteudo}</div>
                    </main>

                    {servidor && (
                        <>
                            <div className="fundo-escuro" onClick={() => setPracaAberta(false)} />
                            <Praca
                                servidor={servidor}
                                eu={eu}
                                voz={voz}
                                membros={membros}
                                entrandoEm={entrandoEm}
                                souAdmin={souAdmin}
                                emChamada={emChamada}
                                aba={abaPraca}
                                onAba={setAbaPraca}
                                onCanal={abrirCanal}
                                onApagarCanal={apagarCanal}
                                onNovaSala={() => setModal({ tipo: "canal", tipoCanal: "VOZ" })}
                                onFechar={() => setPracaAberta(false)}
                            />
                        </>
                    )}
                    </>
                    )}

                    {modal?.tipo === "servidor" && (
                        <NovoServidor abaInicial={modal.aba} onFechar={() => setModal(null)} onPronto={aoCriarOuEntrarServidor} />
                    )}
                    {modal?.tipo === "convidar" && servidor && (
                        <Convidar servidor={servidor} onFechar={() => setModal(null)} />
                    )}
                    {modal?.tipo === "canal" && servidor && (
                        <NovoCanal
                            servidorId={servidor.id}
                            tipoInicial={modal.tipoCanal}
                            onFechar={() => setModal(null)}
                            onCriado={aoCriarCanal}
                        />
                    )}
                    {paletaAberta && <Paleta itens={itensPaleta} onFechar={() => setPaletaAberta(false)} />}
                </ChatSalaProvider>
            </ControleVozProvider>
        </LiveKitRoom>
    );
}

function VistaCarregando() {
    return (
        <div className="vista vista-centro">
            <Loader2 size={22} className="girar texto-fraco" />
        </div>
    );
}

type SemCanaisProps = { souAdmin: boolean; temSalas: boolean; onCriar: () => void };

function SemCanais({ souAdmin, temSalas, onCriar }: SemCanaisProps) {
    return (
        <div className="vista vista-centro">
            <div className="estado-vazio">
                <strong>{temSalas ? "Nenhum canal de texto ainda" : "Este servidor ainda não tem canais"}</strong>
                {temSalas && <span>As salas de voz estão na Praça, ao lado.</span>}
                {souAdmin ? (
                    <button className="botao botao-primario" onClick={onCriar}>
                        <Plus size={16} /> Criar canal de texto
                    </button>
                ) : (
                    <span>Quando um admin criar um canal, ele aparece aqui.</span>
                )}
            </div>
        </div>
    );
}
