import { Plus, Ticket } from "lucide-react";
import { Cabecalho } from "./ui/Cabecalho";

type Props = { onCriar: () => void; onEntrar: () => void; onMenu: () => void };

// quando você ainda não está em nenhum servidor
export function SemServidor({ onCriar, onEntrar, onMenu }: Props) {
    return (
        <div className="vista">
            <Cabecalho titulo="Liberdade" onMenu={onMenu} />

            <div className="sem-servidor">
                <h1>Você ainda não está em nenhum servidor</h1>
                <p>Crie um servidor pra você e sua galera, ou entre com um link de convite.</p>

                <div className="sem-servidor-opcoes">
                    <button className="opcao" onClick={onCriar}>
                        <span className="opcao-icone"><Plus size={20} /></span>
                        <span className="opcao-texto">
                            <strong>Criar um servidor</strong>
                            <span>Você vira o dono e já ganha um canal de texto e uma sala de voz.</span>
                        </span>
                    </button>

                    <button className="opcao" onClick={onEntrar}>
                        <span className="opcao-icone"><Ticket size={20} /></span>
                        <span className="opcao-texto">
                            <strong>Entrar com convite</strong>
                            <span>Cole o link que alguém te mandou.</span>
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
}
