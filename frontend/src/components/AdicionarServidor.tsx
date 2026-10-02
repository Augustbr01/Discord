import { useState, type FormEvent } from "react";
import { api, mensagemDeErro, type ServidorResumo } from "../api";
import { Modal } from "./Modal";

type Props = { onFechar: () => void; onPronto: (servidor: ServidorResumo) => void };

// aceita o link inteiro (https://.../convite/<id>) ou só o id
export function extrairIdConvite(texto: string) {
    return texto.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] ?? null;
}

export function AdicionarServidor({ onFechar, onPronto }: Props) {
    const [nome, setNome] = useState("");
    const [convite, setConvite] = useState("");
    const [enviando, setEnviando] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    async function executar(acao: () => Promise<ServidorResumo>) {
        setEnviando(true);
        setErro(null);
        try {
            onPronto(await acao());
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
            setErro("Link de convite inválido");
            return;
        }
        executar(async () => (await api.entrarConvite(id)).servidor);
    }

    return (
        <Modal titulo="Adicionar servidor" subtitulo="Crie o seu ou entre num com um convite." onFechar={onFechar}>
            <form className="form-modal" onSubmit={criar}>
                <label>
                    Nome do servidor
                    <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={100}
                        placeholder="Servidor da galera" autoFocus />
                </label>
                <button className="botao botao-primario" disabled={enviando || !nome.trim()}>Criar servidor</button>
            </form>

            <div className="divisor"><span>ou</span></div>

            <form className="form-modal" onSubmit={entrar}>
                <label>
                    Link de convite
                    <input value={convite} onChange={(e) => setConvite(e.target.value)}
                        placeholder="https://.../convite/0199a2b4-..." />
                </label>
                <button className="botao botao-secundario" disabled={enviando || !convite.trim()}>Entrar no servidor</button>
            </form>

            {erro && <p className="texto-erro">{erro}</p>}
        </Modal>
    );
}
