import type { Canal } from "../api";
import { IconeHash } from "./Icones";

// ainda não existem rotas de mensagem no back; quando existirem, o chat entra aqui
export function CanalTexto({ canal }: { canal: Canal }) {
    return (
        <div className="canal-texto">
            <div className="canal-texto-vazio">
                <div className="canal-texto-icone"><IconeHash tamanho={40} /></div>
                <h2>Boas-vindas a #{canal.nome}!</h2>
                <p>Este é o começo do canal. O chat de texto chega em breve. Por enquanto, entre num canal de voz.</p>
            </div>

            <form className="caixa-mensagem" onSubmit={(e) => e.preventDefault()}>
                <input placeholder={`Conversar em #${canal.nome}`} disabled />
            </form>
        </div>
    );
}
