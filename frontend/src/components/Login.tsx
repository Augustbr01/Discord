import { ArrowRight, Bird } from "lucide-react";
import { api } from "../api";

export function Login() {
    return (
        <main className="login">
            <div className="login-cartao">
                <span className="login-marca">
                    <Bird size={26} strokeWidth={1.8} />
                </span>

                <h1>Entrar no Liberdade</h1>
                <p>Servidores, canais de texto e salas de voz com a sua galera.</p>

                <a className="botao botao-primario botao-grande botao-largo" href={api.loginUrl}>
                    Continuar com Discord
                    <ArrowRight size={18} />
                </a>

                <small>Usamos o Discord só pra confirmar quem é você. Nada é publicado na sua conta.</small>
            </div>
        </main>
    );
}
