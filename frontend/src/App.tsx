import { useState, type FormEvent } from "react";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";

type Conexao = { token: string; url: string };

export default function App() {
    // nome aleatório pra duas abas já entrarem com identity diferente
    const [nome, setNome] = useState(() => `user-${Math.floor(Math.random() * 1000)}`);
    const [sala, setSala] = useState("teste");
    const [camera, setCamera] = useState(true);
    const [microfone, setMicrofone] = useState(true);
    const [conexao, setConexao] = useState<Conexao | null>(null);
    const [erro, setErro] = useState<string | null>(null);
    const [carregando, setCarregando] = useState(false);

    async function entrar(e: FormEvent) {
        e.preventDefault();
        setErro(null);
        setCarregando(true);

        try {
            const params = new URLSearchParams({ nome: nome.trim(), sala: sala.trim() || "teste" });
            const res = await fetch(`/livekit/token?${params}`);
            const dados = await res.json().catch(() => null);

            if (!res.ok || !dados) {
                throw new Error(dados?.message ?? `Servidor respondeu ${res.status}. O backend tá rodando na porta 3000?`);
            }

            setConexao(dados);
        } catch (err) {
            setErro(err instanceof Error ? err.message : String(err));
        } finally {
            setCarregando(false);
        }
    }

    if (conexao) {
        return (
            <LiveKitRoom
                serverUrl={conexao.url}
                token={conexao.token}
                connect
                video={camera}
                audio={microfone}
                data-lk-theme="default"
                className="sala"
                onDisconnected={() => setConexao(null)}
                onError={(err) => setErro(err.message)}
            >
                <VideoConference />
            </LiveKitRoom>
        );
    }

    return (
        <main className="entrada">
            <form className="card" onSubmit={entrar}>
                <div className="logo">🕊️</div>
                <h1>Liberdade</h1>
                <p className="sub">Entre numa sala pra conversar por voz, vídeo ou chat.</p>

                <label>
                    Seu nome
                    <input value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus />
                </label>

                <label>
                    Sala
                    <input value={sala} onChange={(e) => setSala(e.target.value)} placeholder="teste" />
                </label>

                <div className="toggles">
                    <label className="toggle">
                        <input type="checkbox" checked={camera} onChange={(e) => setCamera(e.target.checked)} />
                        Câmera
                    </label>
                    <label className="toggle">
                        <input type="checkbox" checked={microfone} onChange={(e) => setMicrofone(e.target.checked)} />
                        Microfone
                    </label>
                </div>

                {erro && <p className="erro">{erro}</p>}

                <button type="submit" disabled={carregando || !nome.trim()}>
                    {carregando ? "Entrando..." : "Entrar"}
                </button>
            </form>
        </main>
    );
}
