import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
    ChevronDown, ChevronUp, Headphones, HeadphoneOff, Loader2, Mic, MicOff, MonitorUp, MonitorX, PhoneOff, RefreshCw, Settings2, Video,
    VideoOff,
} from "lucide-react";
import {
    FPS_TELA, PRESETS_TELA, RESOLUCOES_TELA, configPesada, presetDaConfig, useControleVoz,
} from "../../contexto/ControleVoz";
import { useCliqueFora } from "../../hooks/useCliqueFora";
import { estaDigitando } from "../../lib/util";
import { Dica } from "../ui/Dica";
import { Dispositivos } from "./Dispositivos";

// barra de controles da chamada
// semTela: sem o botão de compartilhar tela (a call do hall do 3D não tem tela)
export function Controles({ onSair, semTela = false }: { onSair: () => void; semTela?: boolean }) {
    const { conectado, micLigado, micPendente, alternarMic, surdo, alternarSurdo, camera, tela } = useControleVoz();

    // atalho: M liga/desliga o microfone
    useEffect(() => {
        const aoTeclar = (e: KeyboardEvent) => {
            if (estaDigitando(e) || e.ctrlKey || e.metaKey || e.altKey) return;
            if (e.key.toLowerCase() === "m") alternarMic();
        };
        window.addEventListener("keydown", aoTeclar);
        return () => window.removeEventListener("keydown", aoTeclar);
    }, [alternarMic]);

    return (
        <div className="controles">
            <Controle
                dica={micLigado ? "Desativar microfone (M)" : "Ativar microfone (M)"}
                desligado={!micLigado}
                pendente={micPendente}
                onClick={alternarMic}
            >
                {micLigado ? <Mic size={20} /> : <MicOff size={20} />}
            </Controle>

            <Controle dica={surdo ? "Ativar áudio" : "Desativar áudio"} desligado={surdo} onClick={alternarSurdo}>
                {surdo ? <HeadphoneOff size={20} /> : <Headphones size={20} />}
            </Controle>

            <Controle
                dica={camera.ligada ? "Desligar câmera" : "Ligar câmera"}
                ligado={camera.ligada}
                pendente={camera.pendente || !conectado}
                onClick={camera.alternar}
            >
                {camera.ligada ? <Video size={20} /> : <VideoOff size={20} />}
            </Controle>

            {/* celular não compartilha tela: o botão ficava desabilitado sem explicação
                (a dica que explicava não aparece no toque) */}
            {!semTela && tela.suportada && <ControleTela />}

            <MenuNoControle dica="Dispositivos" icone={<Settings2 size={20} />}>
                <Dispositivos />
            </MenuNoControle>

            <span className="controles-divisor" />

            <Dica texto="Sair da sala">
                <button className="controle controle-sair" onClick={onSair} aria-label="Sair da sala">
                    <PhoneOff size={20} />
                </button>
            </Dica>
        </div>
    );
}

// compartilhar tela: o botão começa/para; a seta ao lado abre qualidade e áudio.
// Qualidade: presets prontos e, embaixo, resolução e fps separados pra quem quer escolher
function ControleTela() {
    const { conectado, tela } = useControleVoz();
    const [aberto, setAberto] = useState(false);
    const [personalizar, setPersonalizar] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const fechar = useCallback(() => setAberto(false), []);
    useCliqueFora(ref, aberto, fechar);

    // só aparece quando o navegador compartilha tela (ver Controles)
    const dica = tela.ativa ? "Parar de compartilhar" : "Compartilhar tela";
    const desativado = !conectado || tela.pendente;

    return (
        <div className="controle-grupo" ref={ref}>
            <Dica texto={dica}>
                <button
                    className={`controle controle-com-seta ${tela.ativa ? "controle-ligado" : ""}`}
                    onClick={tela.alternar}
                    disabled={desativado}
                    aria-label={dica}
                    aria-pressed={tela.ativa}
                >
                    {tela.pendente ? <Loader2 size={20} className="girar" /> : tela.ativa ? <MonitorX size={20} /> : <MonitorUp size={20} />}
                </button>
            </Dica>
            <Dica texto="Opções de compartilhamento">
                <button
                    className={`controle controle-seta ${tela.ativa ? "controle-ligado" : ""} ${aberto ? "aberto" : ""}`}
                    onClick={() => {
                        // combinação que não é nenhum preset: já abre no seletor
                        if (!aberto) setPersonalizar(!presetDaConfig(tela.config));
                        setAberto(!aberto);
                    }}
                    aria-label="Opções de compartilhamento"
                    aria-expanded={aberto}
                >
                    <ChevronUp size={14} />
                </button>
            </Dica>

            {aberto && (
                <div className="menu menu-cima menu-tela" role="dialog" aria-label="Opções de compartilhamento">
                    <span className="rotulo">Qualidade</span>
                    <div className="opcoes-tela" role="radiogroup" aria-label="Qualidade">
                        {PRESETS_TELA.map((preset) => {
                            const ativa = presetDaConfig(tela.config)?.id === preset.id;
                            return (
                                <button
                                    key={preset.id}
                                    role="radio"
                                    aria-checked={ativa}
                                    className={`opcao-tela ${ativa ? "ativa" : ""}`}
                                    onClick={() => tela.definirConfig(preset.config)}
                                >
                                    <span className="opcao-tela-radio" />
                                    <span className="opcao-tela-texto">
                                        <strong>{preset.titulo}</strong>
                                        <span>{preset.detalhe}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <button
                        className={`personalizar-tela ${personalizar ? "aberto" : ""}`}
                        onClick={() => setPersonalizar((v) => !v)}
                        aria-expanded={personalizar}
                    >
                        <span>{presetDaConfig(tela.config) ? "Personalizar" : "Personalizado"}</span>
                        <ChevronDown size={14} />
                    </button>

                    {personalizar && (
                        <div className="personalizado-tela">
                            <div className="seletor-tela">
                                <span className="rotulo">Resolução</span>
                                <div className="segmentos" role="radiogroup" aria-label="Resolução">
                                    {RESOLUCOES_TELA.map((r) => (
                                        <button
                                            key={r.id}
                                            role="radio"
                                            aria-checked={tela.config.resolucao === r.id}
                                            className={`segmento ${tela.config.resolucao === r.id ? "ativa" : ""}`}
                                            onClick={() => tela.definirConfig({ resolucao: r.id })}
                                        >
                                            {r.titulo}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="seletor-tela">
                                <span className="rotulo">FPS</span>
                                <div className="segmentos" role="radiogroup" aria-label="FPS">
                                    {FPS_TELA.map((fps) => (
                                        <button
                                            key={fps}
                                            role="radio"
                                            aria-checked={tela.config.fps === fps}
                                            className={`segmento ${tela.config.fps === fps ? "ativa" : ""}`}
                                            onClick={() => tela.definirConfig({ fps })}
                                        >
                                            {fps}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <p className="menu-tela-nota">
                                {tela.config.resolucao === "nativa"
                                    ? "Nativa: a resolução da tela que você compartilhar, até 4K. "
                                    : ""}
                                {configPesada(tela.config)
                                    ? "Pesado: precisa de PC forte e internet muito boa."
                                    : tela.config.fps === 15
                                        ? "15 fps deixa texto e código mais nítidos."
                                        : tela.config.fps === 60
                                            ? "60 fps: se apertar, cai a resolução, não o fps."
                                            : "Equilibra nitidez e fluidez."}
                            </p>
                        </div>
                    )}

                    <label className="opcao-audio">
                        <input type="checkbox" checked={tela.comAudio} onChange={(e) => tela.definirAudio(e.target.checked)} />
                        <span>
                            <strong>Compartilhar o áudio</strong>
                            <span>Som da aba ou do sistema, quando o navegador deixar</span>
                        </span>
                    </label>

                    {tela.ativa ? (
                        <>
                            <p className="menu-tela-nota">As mudanças valem a partir do próximo compartilhamento.</p>
                            <button
                                className="botao botao-pequeno botao-largo botao-contorno"
                                onClick={() => {
                                    fechar();
                                    tela.trocar();
                                }}
                            >
                                <RefreshCw size={14} />
                                Trocar o que estou mostrando
                            </button>
                        </>
                    ) : (
                        <button
                            className="botao botao-pequeno botao-largo botao-primario"
                            disabled={!conectado || tela.pendente}
                            onClick={() => {
                                fechar();
                                tela.alternar();
                            }}
                        >
                            <MonitorUp size={14} />
                            Compartilhar agora
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

type MenuProps = { dica: string; icone: ReactNode; children: ReactNode };

// controle que abre um menu pra cima (dispositivos)
function MenuNoControle({ dica, icone, children }: MenuProps) {
    const [aberto, setAberto] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const fechar = useCallback(() => setAberto(false), []);
    useCliqueFora(ref, aberto, fechar);

    return (
        <div className="controles-config" ref={ref}>
            <Controle dica={dica} ligado={aberto} onClick={() => setAberto((v) => !v)}>
                {icone}
            </Controle>
            {aberto && <div className="menu menu-cima">{children}</div>}
        </div>
    );
}

type ControleProps = {
    dica: string;
    desligado?: boolean;
    ligado?: boolean;
    pendente?: boolean;
    onClick: () => void;
    children: ReactNode;
};

function Controle({ dica, desligado, ligado, pendente, onClick, children }: ControleProps) {
    return (
        <Dica texto={dica}>
            <button
                className={`controle ${desligado ? "controle-desligado" : ""} ${ligado ? "controle-ligado" : ""}`}
                onClick={onClick}
                disabled={pendente}
                aria-label={dica}
            >
                {children}
            </button>
        </Dica>
    );
}
