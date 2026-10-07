import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { api, mensagemDeErro, type ServidorDetalhe } from "../../api";
import { IconeServidor } from "../ui/Avatar";
import { Dialogo } from "../ui/Dialogo";

// igual ao maxLength do body de POST /servidor/editar no back (e ao VarChar(100) do banco)
const LIMITE_NOME = 100;

type Props = {
    servidor: ServidorDetalhe;
    onFechar: () => void;
    onSalvo: (atualizado: { id: string; nome: string }) => void;
};

export function EditarServidor({ servidor, onFechar, onSalvo }: Props) {
    const [nome, setNome] = useState(servidor.nome);
    const [enviando, setEnviando] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    const final = nome.trim();
    const mudou = final !== servidor.nome;

    async function salvar(e: FormEvent) {
        e.preventDefault();
        if (!final || !mudou) return;
        setEnviando(true);
        setErro(null);
        try {
            onSalvo(await api.editarServidor(servidor.id, final));
        } catch (err) {
            setErro(mensagemDeErro(err));
        } finally {
            setEnviando(false);
        }
    }

    return (
        <Dialogo titulo="Editar servidor" descricao="Todos os membros veem a mudança na hora." onFechar={onFechar}>
            <form className="formulario" onSubmit={salvar}>
                <div className="previa-servidor">
                    <IconeServidor nome={final || servidor.nome} url={servidor.iconeUrl} tamanho={48} />
                    <span className="truncar">{final || servidor.nome}</span>
                </div>

                <label className="campo-rotulado">
                    <span className="rotulo">Nome do servidor</span>
                    <input
                        className="campo"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        maxLength={LIMITE_NOME}
                        autoFocus
                        onFocus={(e) => e.target.select()}
                    />
                </label>

                {erro && <p className="texto-erro">{erro}</p>}

                <div className="formulario-acoes">
                    <button type="button" className="botao botao-fantasma" onClick={onFechar}>Cancelar</button>
                    <button className="botao botao-primario" disabled={enviando || !final || !mudou}>
                        {enviando && <Loader2 size={16} className="girar" />}
                        Salvar
                    </button>
                </div>
            </form>
        </Dialogo>
    );
}
