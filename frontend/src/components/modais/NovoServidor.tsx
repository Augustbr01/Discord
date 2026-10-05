import { useState, type FormEvent } from "react";
import { Link2, Loader2 } from "lucide-react";
import { api, mensagemDeErro, type ServidorResumo } from "../../api";
import { extrairIdConvite } from "../../lib/util";
import { IconeServidor } from "../ui/Avatar";
import { Dialogo } from "../ui/Dialogo";

export type AbaServidor = "criar" | "entrar";

type Props = {
    abaInicial: AbaServidor;
    onFechar: () => void;
    onPronto: (servidor: ServidorResumo, aba: AbaServidor) => void;
};

export function NovoServidor({ abaInicial, onFechar, onPronto }: Props) {
    const [aba, setAba] = useState<AbaServidor>(abaInicial);
    const [nome, setNome] = useState("");
    const [convite, setConvite] = useState("");
    const [enviando, setEnviando] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    async function executar(acao: () => Promise<ServidorResumo>) {
        setEnviando(true);
        setErro(null);
        try {
            onPronto(await acao(), aba);
        } catch (err) {
            setErro(mensagemDeErro(err));
        } finally {
            setEnviando(false);
        }
    }

    function criar(e: FormEvent) {
        e.preventDefault();
        executar(() => api.criarServidor(nome.trim()));
    }

    function entrar(e: FormEvent) {
        e.preventDefault();
        const id = extrairIdConvite(convite);
        if (!id) {
            setErro("Esse link de convite não parece válido.");
            return;
        }
        executar(async () => (await api.entrarConvite(id)).servidor);
    }

    function trocarAba(nova: AbaServidor) {
        setAba(nova);
        setErro(null);
    }

    return (
        <Dialogo
            titulo="Adicionar servidor"
            descricao={aba === "criar" ? "Crie um servidor novo. Você será o dono." : "Entre num servidor existente com um convite."}
            onFechar={onFechar}
        >
            <div className="abas" role="tablist">
                <button role="tab" aria-selected={aba === "criar"} className={aba === "criar" ? "ativa" : ""} onClick={() => trocarAba("criar")}>
                    Criar
                </button>
                <button role="tab" aria-selected={aba === "entrar"} className={aba === "entrar" ? "ativa" : ""} onClick={() => trocarAba("entrar")}>
                    Entrar com convite
                </button>
            </div>

            {aba === "criar" ? (
                <form className="formulario" onSubmit={criar}>
                    <div className="previa-servidor">
                        <IconeServidor nome={nome.trim() || "Novo servidor"} tamanho={48} />
                        <span className="truncar">{nome.trim() || "Novo servidor"}</span>
                    </div>

                    <label className="campo-rotulado">
                        <span className="rotulo">Nome do servidor</span>
                        <input
                            className="campo"
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            maxLength={100}
                            placeholder="Ex.: Galera da facul"
                            autoFocus
                        />
                    </label>

                    {erro && <p className="texto-erro">{erro}</p>}

                    <div className="formulario-acoes">
                        <button type="button" className="botao botao-fantasma" onClick={onFechar}>Cancelar</button>
                        <button className="botao botao-primario" disabled={enviando || !nome.trim()}>
                            {enviando && <Loader2 size={16} className="girar" />}
                            Criar servidor
                        </button>
                    </div>
                </form>
            ) : (
                <form className="formulario" onSubmit={entrar}>
                    <label className="campo-rotulado">
                        <span className="rotulo">Link ou código do convite</span>
                        <span className="campo campo-com-icone">
                            <Link2 size={16} />
                            <input
                                value={convite}
                                onChange={(e) => setConvite(e.target.value)}
                                placeholder="https://…/convite/0199a2b4-…"
                                autoFocus
                            />
                        </span>
                    </label>

                    {erro && <p className="texto-erro">{erro}</p>}

                    <div className="formulario-acoes">
                        <button type="button" className="botao botao-fantasma" onClick={onFechar}>Cancelar</button>
                        <button className="botao botao-primario" disabled={enviando || !convite.trim()}>
                            {enviando && <Loader2 size={16} className="girar" />}
                            Entrar no servidor
                        </button>
                    </div>
                </form>
            )}
        </Dialogo>
    );
}
