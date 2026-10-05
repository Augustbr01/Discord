import { useConnectionState, useTrackToggle } from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";
import { MonitorUp, MonitorX, PhoneOff, Signal, Video, VideoOff } from "lucide-react";
import { useAgora } from "../../hooks/useAgora";
import { cronometro } from "../../lib/util";
import type { Voz } from "../../tipos";
import { Dica } from "../ui/Dica";

type Props = { voz: Voz; onAbrir: () => void; onSair: () => void };

// fica no rodapé da lista de canais enquanto você está numa sala
export function PainelVoz({ voz, onAbrir, onSair }: Props) {
    const estado = useConnectionState();
    const camera = useTrackToggle({ source: Track.Source.Camera, onDeviceError: () => {} });
    const tela = useTrackToggle({
        source: Track.Source.ScreenShare,
        captureOptions: { audio: true, selfBrowserSurface: "exclude" },
        onDeviceError: () => {},
    });
    const agora = useAgora();

    const conectado = estado === ConnectionState.Connected;
    const status = conectado
        ? "Voz conectada"
        : estado === ConnectionState.Reconnecting ? "Reconectando…" : "Conectando…";

    return (
        <div className={`painel-voz ${conectado ? "" : "esperando"}`}>
            <div className="painel-voz-topo">
                <span className="painel-voz-sinal"><Signal size={16} /></span>
                <button className="painel-voz-info" onClick={onAbrir} title="Abrir a sala">
                    <strong>{status}</strong>
                    <span className="truncar">{voz.canal.nome} · {voz.servidorNome}</span>
                </button>
                <span className="painel-voz-tempo">{conectado ? cronometro(agora - voz.desde) : ""}</span>
                <Dica texto="Desconectar">
                    <button className="botao-icone botao-icone-perigo" onClick={onSair} aria-label="Desconectar">
                        <PhoneOff size={17} />
                    </button>
                </Dica>
            </div>

            <div className="painel-voz-acoes">
                <button
                    className={`painel-voz-botao ${camera.enabled ? "ligado" : ""}`}
                    onClick={() => camera.toggle()}
                    disabled={!conectado || camera.pending}
                >
                    {camera.enabled ? <Video size={16} /> : <VideoOff size={16} />}
                    Câmera
                </button>
                <button
                    className={`painel-voz-botao ${tela.enabled ? "ligado" : ""}`}
                    onClick={() => tela.toggle()}
                    disabled={!conectado || tela.pending}
                >
                    {tela.enabled ? <MonitorX size={16} /> : <MonitorUp size={16} />}
                    Tela
                </button>
            </div>
        </div>
    );
}
