import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { LiveKitRoom } from "@livekit/components-react";
import { MediaDeviceFailure, ScreenSharePresets, VideoPresets, type RoomOptions } from "livekit-client";
import { Bird, Building2, Camera, Hash, Loader2, LogOut, PhoneOff, Plus, Settings, Ticket, UserPlus, Users, Volume2 } from "lucide-react";
import {
    api, mensagemDeErro, talvezDeslogado,
    type Canal, type ServidorResumo, type TipoCanal, type Usuario,
} from "./api";
import { ChatSalaProvider } from "./contexto/ChatSala";
import { GerenciadorCall, type Destino, type MotivoPerda } from "./lib/gerenciadorCall";
import { ControleVozProvider } from "./contexto/ControleVoz";
import { FocoChamadaProvider } from "./contexto/FocoChamada";
import { PerfilProvider } from "./contexto/Perfil";
import { ToastProvider, useToast } from "./contexto/Toasts";
import { YoutubeSalaProvider } from "./contexto/YoutubeSala";
import { ControleSalaProvider } from "./contexto/ControleSala";
import { removerMembro, useServidor } from "./hooks/useServidor";
import { useSonsDeVoz } from "./hooks/useSonsDeVoz";
import { gateway } from "./lib/gateway";
import { pessoasNaSala } from "./lib/salas";
import { extrairIdConvite, lerArmazenado, removerArmazenado, salvarArmazenado } from "./lib/util";
import type { MapaMembros, Voz } from "./tipos";
import { BarraServidores } from "./components/BarraServidores";
import { CanalTexto } from "./components/CanalTexto";
import { VistaVoz } from "./components/chamada/VistaVoz";
import { ListaMembros } from "./components/ListaMembros";
import { Login } from "./components/Login";
import { Convidar } from "./components/modais/Convidar";
import { EditarServidor } from "./components/modais/EditarServidor";
import { ExpulsarMembro } from "./components/modais/ExpulsarMembro";
import { FotoPerfil } from "./components/modais/FotoPerfil";
import { NovoCanal } from "./components/modais/NovoCanal";
import { NovoServidor, type AbaServidor } from "./components/modais/NovoServidor";
import { PainelCanais } from "./components/PainelCanais";
import { Paleta, type ItemPaleta } from "./components/Paleta";
import { SemServidor } from "./components/SemServidor";
import { IconeServidor } from "./components/ui/Avatar";
import { Cabecalho } from "./components/ui/Cabecalho";

// o 3D (three.js) só é baixado quando alguém abre o mundo
const Mundo3D = lazy(() => import("./components/mundo/Mundo3D"));

const CHAVE_CONVITE = "liberdade:convite";
// tempo pra fazer o login e voltar com o convite ainda guardado
const VALIDADE_CONVITE_MS = 60 * 60 * 1000;
const CHAVE_SERVIDOR = "liberdade:servidor";
const CHAVE_CANAIS = "liberdade:canais";
const CHAVE_MEMBROS = "liberdade:membros";
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

// a call como o gerenciador entende: a chave é o nome da sala no LiveKit (canal ou hall-<servidor>)
function destinoDaCall(id: string, servidorId: string, hall: boolean): Destino {
    return { chave: id, token: () => (hall ? api.tokenHall(servidorId) : api.tokenVoz(id)) };
}

// nomes dos erros do navegador ao abrir microfone/câmera
const ERROS_DE_DISPOSITIVO = new Set(["NotAllowedError", "NotFoundError", "NotReadableError", "OverconstrainedError", "AbortError"]);

type ModalAberto =
    | { tipo: "servidor"; aba: AbaServidor }
    | { tipo: "convidar" }
    | { tipo: "canal"; tipoCanal: TipoCanal }
    | { tipo: "foto" }
    | { tipo: "editar-servidor" }
    | { tipo: "expulsar"; usuario: Usuario }
    | null;

// quem abre /convite/<id> sem estar logado passa pelo login e volta pra "/",
// então o id fica guardado até dar pra usar. Fica no localStorage, que vale pra todas
// as abas: o login do Discord pode voltar em outra (no celular, ele abre o app do Discord)
type ConviteGuardado = { id: string; ate: number };

function guardarConviteDaUrl() {
    const id = location.pathname.startsWith("/convite/") ? extrairIdConvite(location.pathname) : null;
    if (id) {
        salvarArmazenado(CHAVE_CONVITE, { id, ate: Date.now() + VALIDADE_CONVITE_MS } satisfies ConviteGuardado);
        history.replaceState(null, "", "/");
    }
}

function convitePendente() {
    const guardado = lerArmazenado<ConviteGuardado | null>(CHAVE_CONVITE, null);
    return guardado && guardado.ate > Date.now() ? guardado.id : null;
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
    // contagem de mensagens não lidas por servidor (o badge +1 na barra)
    const [naoLidos, setNaoLidos] = useState<Record<string, number>>({});
    // último canal aberto em cada servidor (só os de texto são lembrados entre visitas)
    const [canalPorServidor, setCanalPorServidor] = useState<Record<string, string>>(() => lerArmazenado(CHAVE_CANAIS, {}));
    // a call em que você quer estar; quem leva a conexão até lá é o gerenciador (lib/gerenciadorCall)
    const [voz, setVoz] = useState<Voz | null>(null);
    const [gerenciador] = useState(() => new GerenciadorCall(OPCOES_SALA));
    const estadoCall = useSyncExternalStore(gerenciador.assinar, gerenciador.lerEstado);
    // entrando = pediu a call e a conexão ainda não chegou nela
    const entrandoEm = voz && estadoCall.conectadoEm !== voz.canal.id ? voz.canal.id : null;
    const [micPreferido, setMicPreferido] = useState(() => lerArmazenado(CHAVE_MIC, true));
    const [surdo, setSurdo] = useState(false);
    // em tela estreita a lista de membros cobre o conteúdo, então sempre começa fechada
    const [membrosVisivel, setMembrosVisivel] = useState(() => window.innerWidth >= 1100 && lerArmazenado(CHAVE_MEMBROS, true));
    const [modal, setModal] = useState<ModalAberto>(null);
    const [paletaAberta, setPaletaAberta] = useState(false);
    const [menuAberto, setMenuAberto] = useState(false);
    const [mundoAberto, setMundoAberto] = useState(false);

    useEffect(() => salvarArmazenado(CHAVE_MIC, micPreferido), [micPreferido]);
    // só salva quando você mesmo mostra/oculta (abrir no celular não muda a escolha do computador)
    const alternarMembros = useCallback(() => {
        setMembrosVisivel((v) => {
            salvarArmazenado(CHAVE_MEMBROS, !v);
            return !v;
        });
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

    const { servidor: servidorCarregado, setServidor, recarregar: recarregarServidor } = useServidor(eu ? servidorId : null, tratarErro);
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

    // servidor aberto num ref: o ouvinte abaixo lê sempre o atual sem re-assinar
    const servidorIdRef = useRef(servidorId);
    useEffect(() => {
        servidorIdRef.current = servidorId;
    }, [servidorId]);

    // mensagem nova num servidor que não estou vendo → +1 no badge daquele servidor
    useEffect(() => {
        if (!euId) return;
        return gateway.assinar((evento) => {
            if (evento.tipo !== "MENSAGEM_CRIADA") return;
            if (evento.mensagem.autor.id === euId) return;        // não conta o que eu mandei
            if (evento.servidorId === servidorIdRef.current) return; // já estou nesse servidor
            setNaoLidos((n) => ({ ...n, [evento.servidorId]: (n[evento.servidorId] ?? 0) + 1 }));
        });
    }, [euId]);

    // servidor renomeado (por você ou outro admin): atualiza o nome na lista de servidores.
    // O servidor aberto se atualiza sozinho no useServidor
    useEffect(() => {
        if (!euId) return;
        return gateway.assinar((evento) => {
            if (evento.tipo !== "UPDATE_SERVER") return;
            setServidores((lista) => lista && lista.map((s) => (s.id === evento.servidorId ? { ...s, nome: evento.nome } : s)));
        });
    }, [euId]);

    // você foi expulso de um servidor: ele some da barra, a chamada de lá cai e você vai pra outro
    const servidoresRef = useRef(servidores);
    useEffect(() => {
        servidoresRef.current = servidores;
    }, [servidores]);

    useEffect(() => {
        if (!euId) return;
        return gateway.assinar((evento) => {
            if (evento.tipo !== "MEMBROS" || evento.usuarioId !== euId) return;
            const daqui = evento.servidorId;
            const lista = servidoresRef.current ?? [];
            const nome = lista.find((s) => s.id === daqui)?.nome;
            setServidores((atual) => atual && atual.filter((s) => s.id !== daqui));
            setVoz((v) => (v && v.servidorId === daqui ? null : v));
            if (servidorIdRef.current === daqui) setServidorId(lista.find((s) => s.id !== daqui)?.id ?? null);
            toast.info(nome ? `Você foi removido de ${nome}.` : "Você foi removido de um servidor.");
        });
    }, [euId, toast]);

    // som de entrada/saída na call em que você está (menos o seu próprio)
    useSonsDeVoz(voz, eu);

    useEffect(() => {
        if (!euId) return;
        let ativo = true;

        (async () => {
            const convite = convitePendente();
            removerArmazenado(CHAVE_CONVITE);

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
        setMenuAberto(false);
        salvarArmazenado(CHAVE_SERVIDOR, id);
        // abriu o servidor: zera o badge dele
        setNaoLidos((n) => (n[id] ? { ...n, [id]: 0 } : n));
    }, []);

    const selecionarCanal = useCallback((idServidor: string, canal: Canal) => {
        setCanalPorServidor((mapa) => ({ ...mapa, [idServidor]: canal.id }));
        if (canal.tipo === "TEXTO") {
            salvarArmazenado(CHAVE_CANAIS, { ...lerArmazenado<Record<string, string>>(CHAVE_CANAIS, {}), [idServidor]: canal.id });
        }
        setMenuAberto(false);
    }, []);

    // ---------- chamada ----------

    // entrar numa call é só dizer qual: muda na hora aqui, e o gerenciador conecta (o token,
    // a troca e as falhas são com ele). O gateway avisa os outros (ENTROU_NA_CALL)
    function entrarNaVoz(canal: Canal) {
        if (!servidor || voz?.canal.id === canal.id) return;
        setVoz({ canal, servidorId: servidor.id, servidorNome: servidor.nome, desde: Date.now() });
    }

    // call do hall do mundo 3D (hall + corredor do andar). mudo: entra com o microfone desligado
    // (quem chega no 3D vindo da tela normal não sai falando com quem está passando)
    function entrarNoHall(opcoes?: { mudo?: boolean }) {
        if (!servidor) return;
        const id = `hall-${servidor.id}`;
        if (voz?.canal.id === id) return;
        if (opcoes?.mudo) setMicPreferido(false);
        setVoz({ canal: { id, nome: "Hall", tipo: "VOZ" }, servidorId: servidor.id, servidorNome: servidor.nome, desde: Date.now(), hall: true });
    }

    // a call pedida vai pro gerenciador
    const idVoz = voz?.canal.id;
    const vozHall = !!voz?.hall;
    const vozServidor = voz?.servidorId;
    useEffect(() => {
        gerenciador.ir(idVoz && vozServidor ? destinoDaCall(idVoz, vozServidor, vozHall) : null);
    }, [gerenciador, idVoz, vozServidor, vozHall]);

    // a call não deu (ou caiu de vez): volta pra "sem call" e avisa
    useEffect(() => {
        const avisos: Record<MotivoPerda, string> = {
            "sem-permissao": "Você não tem acesso a essa sala de voz.",
            falhou: "Não foi possível conectar à sala de voz.",
            "outra-aba": "Você entrou na call em outra aba ou aparelho.",
            removido: "Você foi desconectado da sala.",
        };
        gerenciador.onPerda = (chave, motivo) => {
            setVoz((v) => (v?.canal.id === chave ? null : v));
            toast.erro(avisos[motivo]);
        };
        return () => {
            gerenciador.onPerda = null;
        };
    }, [gerenciador, toast]);

    // ao abrir o 3D: busca antes os tokens das salas do andar e do hall (trocar de sala fica rápido)
    const aquecerCalls = useCallback((servidorAndar: string, canaisVoz: string[]) => {
        gerenciador.aquecer([
            destinoDaCall(`hall-${servidorAndar}`, servidorAndar, true),
            ...canaisVoz.map((id) => destinoDaCall(id, servidorAndar, false)),
        ]);
    }, [gerenciador]);

    // sair do 3D: a call do hall só existe lá dentro (numa sala de verdade, continua)
    const fecharMundo = useCallback(() => {
        setMundoAberto(false);
        setVoz((v) => (v?.hall ? null : v));
    }, []);

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

    function abrirChamada() {
        if (!voz) return;
        if (voz.hall) {
            setMundoAberto(true);
            return;
        }
        irParaServidor(voz.servidorId);
        selecionarCanal(voz.servidorId, voz.canal);
    }

    async function sairDaConta() {
        setVoz(null);
        setMundoAberto(false);
        await api.sair().catch(() => {});
        setEu(null);
        setServidores(null);
        setServidorId(null);
    }

    // erros do LiveKitRoom (a conexão em si é com o gerenciador, que avisa pelo onPerda)
    const aoErroNaSala = useCallback((err: Error) => {
        if (err.name === "ConnectionError") return;
        // falha de microfone/câmera (sem permissão, sem aparelho, em uso por outro programa)
        // já é avisada pelo onMediaDeviceFailure
        if (ERROS_DE_DISPOSITIVO.has(err.name)) return;
        toast.erro(err.message);
    }, [toast]);

    // único lugar que avisa falha de câmera/microfone (os botões só desfazem o estado)
    const aoFalharDispositivo = useCallback((falha?: MediaDeviceFailure, tipo?: MediaDeviceKind) => {
        // sem tipo = compartilhamento de tela: quem avisa é o botão da tela,
        // e fechar a janela de escolher a tela nem é erro
        if (tipo !== "audioinput" && tipo !== "videoinput") return;
        const [oDispositivo, dispositivo] = tipo === "videoinput" ? ["a câmera", "câmera"] : ["o microfone", "microfone"];
        if (falha === MediaDeviceFailure.PermissionDenied) {
            toast.erro(`Sem permissão pra usar ${oDispositivo}. Libere nas configurações do navegador.`);
        } else if (falha === MediaDeviceFailure.NotFound) {
            toast.erro(`Nenhum${tipo === "videoinput" ? "a" : ""} ${dispositivo} encontrad${tipo === "videoinput" ? "a" : "o"}.`);
        } else if (falha === MediaDeviceFailure.DeviceInUse) {
            toast.erro(`${oDispositivo[0].toUpperCase()}${oDispositivo.slice(1)} está sendo usad${tipo === "videoinput" ? "a" : "o"} por outro programa.`);
        } else {
            toast.erro(`Não consegui acessar ${oDispositivo}. Confira as permissões do navegador.`);
        }
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
        // dedup: o CANAL_CRIADO do WS pode ter adicionado antes da resposta do POST
        setServidor((s) => (s && !s.canais.some((c) => c.id === novo.id) ? { ...s, canais: [...s.canais, novo] } : s));
        setModal(null);
        // abre o canal novo (numa sala de voz, abre a tela dela sem entrar sozinho)
        selecionarCanal(servidor.id, novo);
    }

    function aoEditarServidor(atualizado: { id: string; nome: string }) {
        // atualiza na hora pra quem editou; o UPDATE_SERVER chega pros outros (e pra você também, sem efeito)
        setServidores((lista) => lista && lista.map((s) => (s.id === atualizado.id ? { ...s, nome: atualizado.nome } : s)));
        setServidor((s) => (s && s.id === atualizado.id ? { ...s, nome: atualizado.nome } : s));
        setModal(null);
        toast.sucesso("Servidor atualizado");
    }

    // igual à regra do back: admin expulsa só membro comum (os outros admins e você ficam de fora).
    // O dono sempre é ADMIN, mas fica protegido pelo id também, por garantia
    function podeExpulsar(alvo: Usuario) {
        if (!servidor || !eu || !souAdmin || alvo.id === eu.id || alvo.id === servidor.dono.id) return false;
        return servidor.membros.some((m) => m.usuario.id === alvo.id && m.permissao !== "ADMIN");
    }

    // o erro sobe pro modal mostrar; deu certo: some da lista na hora (o evento chega depois)
    async function expulsar(usuario: Usuario) {
        if (!servidor) return;
        const idServidor = servidor.id;
        await api.expulsarMembro(idServidor, usuario.id);
        setServidor((s) => (s && s.id === idServidor ? removerMembro(s, usuario.id) : s));
        setModal(null);
        toast.sucesso(`Você expulsou ${usuario.nome} do servidor.`);
    }

    function aoTrocarFoto(atualizado: Usuario, removida: boolean) {
        const trocar = (u: Usuario) => (u.id === atualizado.id ? { ...u, avatarUrl: atualizado.avatarUrl } : u);
        setEu((u) => u && trocar(u));
        // você também aparece no servidor aberto: lista de membros e salas de voz
        setServidor((s) => s && {
            ...s,
            membros: s.membros.map((m) => ({ ...m, usuario: trocar(m.usuario) })),
            canais: s.canais.map((c) => (c.participantes ? { ...c, participantes: c.participantes.map(trocar) } : c)),
        });
        setModal(null);
        toast.sucesso(removida ? "Foto de perfil removida" : "Foto de perfil atualizada");
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
            { id: "editar-servidor", grupo: "Ações", titulo: "Editar servidor", dica: servidor.nome, icone: <Settings size={16} />, acao: () => setModal({ tipo: "editar-servidor" }) },
        );
    }
    itensPaleta.push(
        { id: "novo-servidor", grupo: "Ações", titulo: "Criar servidor", icone: <Plus size={16} />, acao: () => setModal({ tipo: "servidor", aba: "criar" }) },
        { id: "entrar-convite", grupo: "Ações", titulo: "Entrar com convite", icone: <Ticket size={16} />, acao: () => setModal({ tipo: "servidor", aba: "entrar" }) },
    );
    if (servidor) {
        itensPaleta.push({
            id: "mundo-3d",
            grupo: "Ações",
            titulo: mundoAberto ? "Sair do mundo 3D" : "Abrir o mundo 3D",
            dica: servidor.nome,
            icone: <Building2 size={16} />,
            acao: () => (mundoAberto ? fecharMundo() : setMundoAberto(true)),
        });
        itensPaleta.push({
            id: "membros",
            grupo: "Ações",
            titulo: membrosVisivel ? "Ocultar membros" : "Mostrar membros",
            icone: <Users size={16} />,
            acao: alternarMembros,
        });
    }
    if (voz) {
        itensPaleta.push({ id: "sair-sala", grupo: "Ações", titulo: "Sair da sala de voz", dica: voz.canal.nome, icone: <PhoneOff size={16} />, acao: sairDaVoz });
    }
    itensPaleta.push(
        { id: "foto-perfil", grupo: "Ações", titulo: "Alterar foto de perfil", icone: <Camera size={16} />, acao: () => setModal({ tipo: "foto" }) },
        { id: "sair-conta", grupo: "Ações", titulo: "Sair da conta", icone: <LogOut size={16} />, acao: sairDaConta },
    );

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
        return <Login convidado={convitePendente() !== null} />;
    }

    const abrirMenu = () => setMenuAberto(true);
    let conteudo: ReactNode;

    if (servidores === null || (servidorId && !servidor)) {
        conteudo = <VistaCarregando onMenu={abrirMenu} />;
    } else if (servidores.length === 0) {
        conteudo = (
            <SemServidor
                onCriar={() => setModal({ tipo: "servidor", aba: "criar" })}
                onEntrar={() => setModal({ tipo: "servidor", aba: "entrar" })}
                onMenu={abrirMenu}
            />
        );
    } else if (!servidor || !canalAtual) {
        conteudo = (
            <SemCanais
                nome={servidor?.nome ?? ""}
                souAdmin={souAdmin}
                onCriar={() => setModal({ tipo: "canal", tipoCanal: "TEXTO" })}
                onMenu={abrirMenu}
            />
        );
    } else if (canalAtual.tipo === "TEXTO") {
        conteudo = (
            <CanalTexto
                key={canalAtual.id}
                canal={canalAtual}
                eu={eu}
                membros={membros}
                membrosVisivel={membrosVisivel}
                onMembros={alternarMembros}
                onBuscar={() => setPaletaAberta(true)}
                onMenu={abrirMenu}
            />
        );
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
                onMenu={abrirMenu}
            />
        );
    }

    const mostrarMembros = !!servidor && membrosVisivel && canalAtual?.tipo === "TEXTO";

    return (
        // a sala de voz fica em volta de tudo: a chamada continua enquanto você navega.
        // A conexão é do gerenciador (sem token aqui o LiveKitRoom não conecta nem desconecta
        // sozinho); ele só dá o contexto pros componentes e publica o microfone ao conectar
        <LiveKitRoom
            room={gerenciador.room}
            serverUrl={undefined}
            token={undefined}
            connect
            audio={micPreferido && !surdo}
            video={false}
            className={`app ${menuAberto ? "menu-aberto" : ""} ${mostrarMembros ? "com-membros" : ""}`}
            onError={aoErroNaSala}
            onMediaDeviceFailure={aoFalharDispositivo}
        >
            <ControleVozProvider
                micPreferido={micPreferido}
                setMicPreferido={setMicPreferido}
                surdo={surdo}
                setSurdo={setSurdo}
                audioEspacial={mundoAberto}
                cinema={voz?.canal.modelo === "CINEMA"}
            >
                <ChatSalaProvider desde={voz?.desde ?? null}>
                    <FocoChamadaProvider desde={voz?.desde ?? null}>
                        <PerfilProvider
                            eu={eu}
                            membros={membros}
                            servidorId={servidorId}
                            onEditarFoto={() => setModal({ tipo: "foto" })}
                            podeExpulsar={podeExpulsar}
                            onExpulsar={(usuario) => setModal({ tipo: "expulsar", usuario })}
                        >
                            <YoutubeSalaProvider canalId={voz ? voz.canal.id : null} noMundo={mundoAberto}>
                                <ControleSalaProvider canalId={voz ? voz.canal.id : null}>
                                    <div className="navegacao">
                                        <BarraServidores
                                            servidores={servidores ?? []}
                                            atualId={servidorId}
                                            servidorDaChamada={voz?.servidorId ?? null}
                                            naoLidos={naoLidos}
                                            onEscolher={irParaServidor}
                                            onAdicionar={() => setModal({ tipo: "servidor", aba: "criar" })}
                                        />
                                        <PainelCanais
                                            servidor={servidor}
                                            carregando={servidores === null || (!!servidorId && !servidor)}
                                            canalAtualId={canalAtual?.id ?? null}
                                            voz={voz}
                                            entrandoEm={entrandoEm}
                                            eu={eu}
                                            souAdmin={souAdmin}
                                            membros={membros}
                                            onCanal={abrirCanal}
                                            onApagarCanal={apagarCanal}
                                            onConvidar={() => setModal({ tipo: "convidar" })}
                                            onNovoCanal={(tipoCanal) => setModal({ tipo: "canal", tipoCanal })}
                                            onEditarServidor={() => setModal({ tipo: "editar-servidor" })}
                                            onAbrirChamada={abrirChamada}
                                            onSairChamada={sairDaVoz}
                                            onEditarFoto={() => setModal({ tipo: "foto" })}
                                            onSairConta={sairDaConta}
                                            onMundo3D={() => {
                                                setMenuAberto(false);
                                                setMundoAberto(true);
                                            }}
                                        />
                                    </div>

                                    {menuAberto && <div className="fundo-escuro" onClick={() => setMenuAberto(false)} />}

                                    <main className="principal">{conteudo}</main>

                                    {mostrarMembros && servidor && (
                                        <>
                                            <div className="fundo-escuro so-sobreposto" onClick={() => setMembrosVisivel(false)} />
                                            <ListaMembros servidor={servidor} eu={eu} emChamada={emChamada} />
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
                                    {modal?.tipo === "expulsar" && servidor && (
                                        <ExpulsarMembro
                                            usuario={modal.usuario}
                                            servidorNome={servidor.nome}
                                            onFechar={() => setModal(null)}
                                            onConfirmar={() => expulsar(modal.usuario)}
                                        />
                                    )}
                                    {modal?.tipo === "editar-servidor" && servidor && (
                                        <EditarServidor servidor={servidor} onFechar={() => setModal(null)} onSalvo={aoEditarServidor} />
                                    )}
                                    {modal?.tipo === "foto" && (
                                        <FotoPerfil eu={eu} onFechar={() => setModal(null)} onPronto={aoTrocarFoto} />
                                    )}
                                    {mundoAberto && (
                                        <Suspense fallback={<MundoCarregando />}>
                                            <Mundo3D
                                                servidor={servidor}
                                                servidores={servidores ?? []}
                                                eu={eu}
                                                membros={membros}
                                                voz={voz}
                                                entrandoEm={entrandoEm}
                                                tentandoDeNovo={!!entrandoEm && estadoCall.falhas > 0}
                                                onEntrarSala={abrirCanal}
                                                onSairSala={sairDaVoz}
                                                onEntrarHall={entrarNoHall}
                                                onAquecerCalls={aquecerCalls}
                                                onTrocarAndar={irParaServidor}
                                                onMembroDesconhecido={recarregarServidor}
                                                onFechar={fecharMundo}
                                            />
                                        </Suspense>
                                    )}
                                    {paletaAberta && <Paleta itens={itensPaleta} onFechar={() => setPaletaAberta(false)} />}
                                </ControleSalaProvider>
                            </YoutubeSalaProvider>
                        </PerfilProvider>
                    </FocoChamadaProvider>
                </ChatSalaProvider>
            </ControleVozProvider>
        </LiveKitRoom>
    );
}

function MundoCarregando() {
    return (
        <div className="mundo">
            <div className="mundo-carregando">
                <Loader2 size={20} className="girar" />
                <span>Abrindo o prédio…</span>
            </div>
        </div>
    );
}

function VistaCarregando({ onMenu }: { onMenu: () => void }) {
    return (
        <div className="vista">
            <Cabecalho titulo="" onMenu={onMenu} />
            <div className="vista-centro">
                <Loader2 size={22} className="girar texto-fraco" />
            </div>
        </div>
    );
}

type SemCanaisProps = { nome: string; souAdmin: boolean; onCriar: () => void; onMenu: () => void };

function SemCanais({ nome, souAdmin, onCriar, onMenu }: SemCanaisProps) {
    return (
        <div className="vista">
            <Cabecalho titulo={nome} onMenu={onMenu} />
            <div className="vista-centro">
                <div className="estado-vazio">
                    <strong>Este servidor ainda não tem canais</strong>
                    {souAdmin ? (
                        <button className="botao botao-primario" onClick={onCriar}>
                            <Plus size={16} /> Criar canal
                        </button>
                    ) : (
                        <span>Quando um admin criar um canal, ele aparece aqui.</span>
                    )}
                </div>
            </div>
        </div>
    );
}
