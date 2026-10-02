import { api } from "../api";

export function Login() {
    return (
        <main className="login">
            <div className="login-card">
                <div className="login-logo">🕊️</div>
                <h1>Boas-vindas ao Liberdade</h1>
                <p>Servidores, canais de voz e vídeo com a galera.</p>
                <a className="botao botao-primario botao-grande" href={api.loginUrl}>
                    Entrar com Discord
                </a>
            </div>
        </main>
    );
}
