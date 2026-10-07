import { useState } from "react";
import { Loader2 } from "lucide-react";
import { mensagemDeErro, type Usuario } from "../../api";
import { Avatar } from "../ui/Avatar";
import { Dialogo } from "../ui/Dialogo";

type Props = {
    usuario: Usuario;
    servidorNome: string;
    onFechar: () => void;
    // chama a API; se der erro, o modal mostra e continua aberto
    onConfirmar: () => Promise<void>;
};

// confirmação antes de expulsar alguém do servidor
export function ExpulsarMembro({ usuario, servidorNome, onFechar, onConfirmar }: Props) {
    const [enviando, setEnviando] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    async function confirmar() {
        setEnviando(true);
        setErro(null);
        try {
            await onConfirmar(); // deu certo: quem chamou fecha
        } catch (err) {
            setErro(mensagemDeErro(err));
            setEnviando(false);
        }
    }

    return (
        <Dialogo titulo="Expulsar do servidor" onFechar={onFechar}>
            <div className="formulario">
                <div className="expulsar-quem">
                    <Avatar nome={usuario.nome} url={usuario.avatarUrl} tamanho={40} />
                    <div>
                        <strong className="truncar">{usuario.nome}</strong>
                        <span>sai de {servidorNome}</span>
                    </div>
                </div>

                <p className="texto-fraco">
                    A pessoa deixa de ver os canais e as mensagens, e só volta se receber um novo convite.
                </p>

                {erro && <p className="texto-erro">{erro}</p>}

                <div className="formulario-acoes">
                    <button type="button" className="botao botao-fantasma" onClick={onFechar}>Cancelar</button>
                    {/* foco aqui: Enter confirma, Esc cancela */}
                    <button type="button" className="botao botao-perigo" onClick={confirmar} disabled={enviando} autoFocus>
                        {enviando && <Loader2 size={16} className="girar" />}
                        Expulsar
                    </button>
                </div>
            </div>
        </Dialogo>
    );
}
