import { useCallback, useEffect, useState } from "react";
import { api, mensagemDeErro, naoLogado, type Canal, type ServidorDetalhe, type ServidorResumo, type Usuario } from "./api";
import { Login } from "./components/Login";
import { BarraServidores } from "./components/BarraServidores";
import { PainelCanais } from "./components/PainelCanais";
import { ListaMembros } from "./components/ListaMembros";
import { CanalTexto } from "./components/CanalTexto";
import { CanalVoz } from "./components/CanalVoz";
import { AdicionarServidor, extrairIdConvite } from "./components/AdicionarServidor";
import { Convidar } from "./components/Convidar";
import { IconeHash, IconeMembros, IconeVoz } from "./components/Icones";

const CHAVE_CONVITE = "convitePendente";

// quem abre /convite/<id> sem estar logado passa pelo login do Discord e volta pra "/",
// então o id fica guardado até dar pra usar
function guardarConviteDaUrl() {
    const id = location.pathname.startsWith("/convite/") ? extrairIdConvite(location.pathname) : null;
    if (id) {
        sessionStorage.setItem(CHAVE_CONVITE, id);
        history.replaceState(null, "", "/");
    }
}

export default function App() {
    // undefined = ainda verificando, null = deslogado
    const [eu, setEu] = useState<Usuario | null | undefined>(undefined);
    const [servidores, setServidores] = useState<ServidorResumo[]>([]);
    const [servidorId, setServidorId] = useState<string | null>(null);
    const [servidor, setServidor] = useState<ServidorDetalhe | null>(null);
    const [canal, setCanal] = useState<Canal | null>(null);
    const [modal, setModal] = useState<"adicionar" | "convidar" | null>(null);
    const [mostrarMembros, setMostrarMembros] = useState(true);
    const [aviso, setAviso] = useState<string | null>(null);

    const tratarErro = useCallback((err: unknown) => {
        if (naoLogado(err)) {
            setEu(null);
            return;
        }
        setAviso(mensagemDeErro(err));
    }, []);

    // 1. quem sou eu?
    useEffect(() => {
        guardarConviteDaUrl();
        api.eu().then(setEu).catch(() => setEu(null));
    }, []);

    // 2. logado: usa convite pendente (se tiver) e carrega os servidores
    useEffect(() => {
        if (!eu) return;

        (async () => {
            const convite = sessionStorage.getItem(CHAVE_CONVITE);
            sessionStorage.removeItem(CHAVE_CONVITE);

            let abrir: string | null = null;
            if (convite) {
                try {
                    abrir = (await api.entrarConvite(convite)).servidor.id;
                } catch (err) {
                    tratarErro(err);
                }
            }

            try {
                const lista = await api.listarServidores();
                setServidores(lista);
                setServidorId(abrir ?? lista[0]?.id ?? null);
            } catch (err) {
                tratarErro(err);
            }
        })();
    }, [eu, tratarErro]);

    // 3. servidor selecionado: carrega canais e membros e abre o primeiro canal de texto
    useEffect(() => {
        setServidor(null);
        setCanal(null);
        if (!servidorId) return;

        let ativo = true;
        api.obterServidor(servidorId)
            .then((s) => {
                if (!ativo) return;
                setServidor(s);
                setCanal(s.canais.find((c) => c.tipo === "TEXTO") ?? s.canais[0] ?? null);
            })
            .catch((err) => ativo && tratarErro(err));

        return () => {
            ativo = false;
        };
    }, [servidorId, tratarErro]);

    // aviso some sozinho
    useEffect(() => {
        if (!aviso) return;
        const t = setTimeout(() => setAviso(null), 4000);
        return () => clearTimeout(t);
    }, [aviso]);

    const sairDaVoz = useCallback(() => {
        setCanal((atual) => {
            if (atual?.tipo !== "VOZ") return atual;
            return servidor?.canais.find((c) => c.tipo === "TEXTO") ?? null;
        });
    }, [servidor]);

    function aoAdicionarServidor(novo: ServidorResumo) {
        setServidores((lista) => (lista.some((s) => s.id === novo.id) ? lista : [...lista, novo]));
        setServidorId(novo.id);
        setModal(null);
    }

    async function sair() {
        await api.sair().catch(() => {});
        setEu(null);
        setServidores([]);
        setServidorId(null);
    }

    if (eu === undefined) {
        return <div className="estado-centro tela-cheia"><div className="girando" /></div>;
    }

    if (eu === null) {
        return <Login />;
    }

    const souAdmin = servidor?.membros.some((m) => m.usuario.id === eu.id && m.permissao === "ADMIN") ?? false;

    return (
        <div className={`app ${servidor && mostrarMembros && canal?.tipo !== "VOZ" ? "com-membros" : ""}`}>
            <BarraServidores
                servidores={servidores}
                selecionadoId={servidorId}
                onSelecionar={setServidorId}
                onAdicionar={() => setModal("adicionar")}
            />

            <PainelCanais
                servidor={servidor}
                canalId={canal?.id ?? null}
                vozConectadaId={canal?.tipo === "VOZ" ? canal.id : null}
                eu={eu}
                souAdmin={souAdmin}
                onCanal={setCanal}
                onConvidar={() => setModal("convidar")}
                onSair={sair}
            />

            <main className="conteudo">
                {canal && (
                    <header className="conteudo-cabecalho">
                        {canal.tipo === "TEXTO" ? <IconeHash /> : <IconeVoz />}
                        <strong>{canal.nome}</strong>
                        {canal.tipo === "TEXTO" && (
                            <button
                                className={`botao-icone ${mostrarMembros ? "ativo" : ""}`}
                                onClick={() => setMostrarMembros((v) => !v)}
                                title="Lista de membros"
                            >
                                <IconeMembros />
                            </button>
                        )}
                    </header>
                )}

                <div className="conteudo-corpo">
                    {canal?.tipo === "TEXTO" && <CanalTexto canal={canal} />}
                    {canal?.tipo === "VOZ" && <CanalVoz key={canal.id} canal={canal} onSair={sairDaVoz} onErro={tratarErro} />}
                    {!canal && servidores.length === 0 && (
                        <div className="estado-centro">
                            <div className="estado-emoji">🕊️</div>
                            <h2>Você ainda não está em nenhum servidor</h2>
                            <p>Crie o seu ou entre num com um link de convite.</p>
                            <button className="botao botao-primario" onClick={() => setModal("adicionar")}>
                                Adicionar servidor
                            </button>
                        </div>
                    )}
                    {!canal && servidorId && (
                        <div className="estado-centro"><div className="girando" /></div>
                    )}
                </div>
            </main>

            {servidor && mostrarMembros && canal?.tipo !== "VOZ" && <ListaMembros servidor={servidor} />}

            {modal === "adicionar" && <AdicionarServidor onFechar={() => setModal(null)} onPronto={aoAdicionarServidor} />}
            {modal === "convidar" && servidor && <Convidar servidor={servidor} onFechar={() => setModal(null)} />}

            {aviso && <div className="aviso" role="status">{aviso}</div>}
        </div>
    );
}
