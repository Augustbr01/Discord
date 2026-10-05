import { Headphones, HeadphoneOff, LogOut, Mic, MicOff } from "lucide-react";
import type { Usuario } from "../api";
import { useControleVoz } from "../contexto/ControleVoz";
import { Avatar } from "./ui/Avatar";
import { Dica } from "./ui/Dica";

type Props = { eu: Usuario; salaAtual: string | null; onSair: () => void };

// rodapé da lista de canais: você, microfone, áudio e sair da conta
export function PainelUsuario({ eu, salaAtual, onSair }: Props) {
    const { micLigado, micPendente, alternarMic, surdo, alternarSurdo } = useControleVoz();

    return (
        <div className="painel-usuario">
            <Avatar nome={eu.nome} url={eu.avatarUrl} tamanho={32} />
            <div className="painel-usuario-texto">
                <strong className="truncar">{eu.nome}</strong>
                {salaAtual && <span className="truncar">Em {salaAtual}</span>}
            </div>

            <Dica texto={micLigado ? "Desativar microfone" : "Ativar microfone"}>
                <button
                    className={`botao-icone ${micLigado ? "" : "botao-icone-desligado"}`}
                    onClick={alternarMic}
                    disabled={micPendente}
                    aria-pressed={!micLigado}
                    aria-label={micLigado ? "Desativar microfone" : "Ativar microfone"}
                >
                    {micLigado ? <Mic size={18} /> : <MicOff size={18} />}
                </button>
            </Dica>

            <Dica texto={surdo ? "Ativar áudio" : "Desativar áudio"}>
                <button
                    className={`botao-icone ${surdo ? "botao-icone-desligado" : ""}`}
                    onClick={alternarSurdo}
                    aria-pressed={surdo}
                    aria-label={surdo ? "Ativar áudio" : "Desativar áudio"}
                >
                    {surdo ? <HeadphoneOff size={18} /> : <Headphones size={18} />}
                </button>
            </Dica>

            <Dica texto="Sair da conta">
                <button className="botao-icone" onClick={onSair} aria-label="Sair da conta">
                    <LogOut size={18} />
                </button>
            </Dica>
        </div>
    );
}
