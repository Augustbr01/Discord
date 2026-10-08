// Configurações do 3D: mouse, campo de visão, movimento e velocímetro.
import { useEffect, useRef, type RefObject } from "react";
import { RotateCcw, X } from "lucide-react";
import { CONFIG_PADRAO, LIMITES, mudarConfig, useConfigMundo } from "./config";

export function ConfigMundo({ onFechar }: { onFechar: () => void }) {
    const cfg = useConfigMundo();

    return (
        <div className="mundo-modal" onClick={onFechar}>
            <div className="mundo-config" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Configurações do 3D">
                <div className="mundo-config-topo">
                    <strong>Configurações</strong>
                    <button className="botao-icone" onClick={onFechar} aria-label="Fechar">
                        <X size={18} />
                    </button>
                </div>

                <div className="mundo-config-corpo">
                    <section>
                        <h3>Mouse</h3>
                        <label className="mundo-config-linha">
                            <span>
                                Sensibilidade
                                <small>Velocidade com que a câmera gira ao mover o mouse.</small>
                            </span>
                            <input
                                type="number"
                                min={LIMITES.sensibilidade.min}
                                max={LIMITES.sensibilidade.max}
                                step={0.01}
                                value={cfg.sensibilidade}
                                onChange={(e) => {
                                    const v = Number(e.target.value);
                                    if (Number.isFinite(v) && v > 0) mudarConfig({ sensibilidade: Math.min(LIMITES.sensibilidade.max, v) });
                                }}
                            />
                        </label>
                        <input
                            type="range"
                            className="mundo-config-barra"
                            min={LIMITES.sensibilidade.min}
                            max={6}
                            step={0.01}
                            value={Math.min(6, cfg.sensibilidade)}
                            onChange={(e) => mudarConfig({ sensibilidade: Number(e.target.value) })}
                            aria-label="Sensibilidade"
                        />
                        <Alternar
                            titulo="Entrada bruta"
                            detalhe="Ignora a aceleração do mouse configurada no sistema operacional. Passa a valer na próxima vez que o mouse for capturado."
                            ligado={cfg.entradaBruta}
                            onMudar={(v) => mudarConfig({ entradaBruta: v })}
                        />
                        <Alternar titulo="Inverter eixo vertical" ligado={cfg.inverterY} onMudar={(v) => mudarConfig({ inverterY: v })} />
                    </section>

                    <section>
                        <h3>Visão</h3>
                        <label className="mundo-config-linha">
                            <span>
                                Campo de visão
                                <small>Ângulo de visão horizontal, em graus. Padrão: 90.</small>
                            </span>
                            <strong className="mundo-config-valor">{cfg.fov}</strong>
                        </label>
                        <input
                            type="range"
                            className="mundo-config-barra"
                            min={LIMITES.fov.min}
                            max={LIMITES.fov.max}
                            step={1}
                            value={cfg.fov}
                            onChange={(e) => mudarConfig({ fov: Number(e.target.value) })}
                            aria-label="Campo de visão"
                        />
                    </section>

                    <section>
                        <h3>Movimento</h3>
                        <Alternar
                            titulo="Pulo contínuo"
                            detalhe="Com Espaço pressionado, o personagem pula novamente assim que toca o chão."
                            ligado={cfg.autoBhop}
                            onMudar={(v) => mudarConfig({ autoBhop: v })}
                        />
                        <Alternar titulo="Mostrar velocidade" detalhe="Exibe a velocidade de deslocamento, em km/h." ligado={cfg.mostrarVelocidade} onMudar={(v) => mudarConfig({ mostrarVelocidade: v })} />
                        <Alternar titulo="Mostrar hitboxes" detalhe="Exibe o contorno das áreas de colisão de paredes e móveis." ligado={cfg.mostrarHitbox} onMudar={(v) => mudarConfig({ mostrarHitbox: v })} />
                    </section>

                    <section className="mundo-config-teclas">
                        <h3>Teclas</h3>
                        <p>
                            <kbd>Shift</kbd> andar devagar · <kbd>Espaço</kbd> ou rodinha para baixo: pular · <kbd>Ctrl</kbd> parado: agachar; correndo: deslizar · <kbd>C</kbd> deitar / levantar · <kbd>Ctrl</kbd> + rodinha: zoom
                        </p>
                    </section>
                </div>

                <div className="mundo-config-rodape">
                    <button className="botao botao-fantasma botao-pequeno" onClick={() => mudarConfig(CONFIG_PADRAO)}>
                        <RotateCcw size={15} />
                        Voltar ao padrão
                    </button>
                </div>
            </div>
        </div>
    );
}

type AlternarProps = { titulo: string; detalhe?: string; ligado: boolean; onMudar: (ligado: boolean) => void };

function Alternar({ titulo, detalhe, ligado, onMudar }: AlternarProps) {
    return (
        <label className="mundo-config-linha">
            <span>
                {titulo}
                {detalhe && <small>{detalhe}</small>}
            </span>
            <input type="checkbox" className="mundo-config-chave" checked={ligado} onChange={(e) => onMudar(e.target.checked)} />
        </label>
    );
}

// velocidade no chão em km/h, atualizada a cada quadro sem re-renderizar
export function Velocimetro({ velocidade }: { velocidade: RefObject<number> }) {
    const ref = useRef<HTMLSpanElement>(null);
    useEffect(() => {
        let quadro = 0;
        const atualizar = () => {
            if (ref.current) ref.current.textContent = `${Math.round(velocidade.current * 3.6)} km/h`;
            quadro = requestAnimationFrame(atualizar);
        };
        atualizar();
        return () => cancelAnimationFrame(quadro);
    }, [velocidade]);
    return <span ref={ref} className="mundo-velocidade" aria-hidden />;
}
