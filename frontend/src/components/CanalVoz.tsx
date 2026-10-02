import { useEffect, useState } from "react";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import { api, mensagemDeErro, type Canal, type ConexaoVoz } from "../api";

type Props = { canal: Canal; onSair: () => void; onErro: (err: unknown) => void };

export function CanalVoz({ canal, onSair, onErro }: Props) {
    const [conexao, setConexao] = useState<ConexaoVoz | null>(null);
    const [erro, setErro] = useState<string | null>(null);

    useEffect(() => {
        let ativo = true;
        setConexao(null);
        setErro(null);

        api.tokenVoz(canal.id)
            .then((c) => ativo && setConexao(c))
            .catch((err) => {
                if (!ativo) return;
                setErro(mensagemDeErro(err));
                onErro(err);
            });

        return () => {
            ativo = false;
        };
    }, [canal.id, onErro]);

    if (erro) {
        return <div className="estado-centro"><p className="texto-erro">{erro}</p></div>;
    }

    if (!conexao) {
        return <div className="estado-centro"><div className="girando" /><p>Conectando a {canal.nome}...</p></div>;
    }

    return (
        <LiveKitRoom
            serverUrl={conexao.url}
            token={conexao.token}
            connect
            audio
            video={false}
            data-lk-theme="default"
            className="sala-voz"
            onDisconnected={onSair}
            onError={(err) => setErro(err.message)}
        >
            <VideoConference />
        </LiveKitRoom>
    );
}
