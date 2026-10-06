import { useEffect, useState } from "react";
import { Bird } from "lucide-react";
import { api } from "../api";
import { Assento, Roda } from "./chamada/Roda";

// quem aparece na roda de exemplo (só ilustração da tela de entrada)
const RODA_EXEMPLO = ["bia.nogueira", "caio_m", "duda", "rafa lins", "tainá", "joãozinho", "lu.fontes"];

export function Login() {
    const falando = useVezDeFalar(RODA_EXEMPLO.length);

    return (
        <main className="login">
            <section className="login-texto">
                <span className="login-marca">
                    <Bird size={22} strokeWidth={1.9} />
                    liberdade
                </span>

                <h1>Um lugar só da sua galera.</h1>
                <p>Servidores, canais de texto e salas de voz com vídeo e tela compartilhada.</p>

                {import.meta.env.VITE_DEMO === "1" ? (
                    <button className="botao botao-primario botao-grande" onClick={() => location.reload()}>
                        Entrar na demonstração
                    </button>
                ) : (
                    <a className="botao botao-primario botao-grande" href={api.loginUrl}>
                        Continuar com Discord
                    </a>
                )}

                <small>Usamos o Discord só pra confirmar quem é você. Nada é publicado na sua conta.</small>
            </section>

            <div className="login-roda" aria-hidden="true">
                <Roda
                    quantidade={RODA_EXEMPLO.length}
                    centro={
                        <>
                            <strong className="roda-titulo">Resenha</strong>
                            <span className="roda-meta">{RODA_EXEMPLO.length} pessoas na sala</span>
                        </>
                    }
                >
                    {RODA_EXEMPLO.map((nome, i) => (
                        <Assento key={nome} indice={i} nome={nome} falando={i === falando} mudo={i === 4} />
                    ))}
                </Roda>
            </div>
        </main>
    );
}

// a vez de falar passa de uma pessoa pra outra, como numa conversa (parado com movimento reduzido)
function useVezDeFalar(total: number) {
    const [vez, setVez] = useState(0);

    useEffect(() => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const ordem = [0, 2, 0, 5, 3, 1, 6, 2];
        let passo = 0;
        const t = setInterval(() => {
            passo = (passo + 1) % ordem.length;
            setVez(ordem[passo] % total);
        }, 2200);
        return () => clearInterval(t);
    }, [total]);

    return vez;
}
