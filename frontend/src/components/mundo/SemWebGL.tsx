// Quando o navegador não consegue desenhar em 3D. O WebGL depende da placa de vídeo:
// navegador com a aceleração por hardware desligada, ou embutido em outro programa
// (ex.: o navegador do VS Code instalado por Snap) costuma não ter acesso a ela.
import { Component, type ReactNode } from "react";
import { MonitorX, RotateCcw, TriangleAlert, X } from "lucide-react";

export type SuporteWebGL = { ok: boolean; software: boolean; placa: string };

// testa antes de montar a cena: dá pra criar um contexto WebGL? É de placa de vídeo ou de software?
export function verificarWebGL(): SuporteWebGL {
    try {
        const canvas = document.createElement("canvas");
        const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext | null;
        if (!gl) return { ok: false, software: false, placa: "" };
        const info = gl.getExtension("WEBGL_debug_renderer_info");
        const placa = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
        // libera o contexto de teste (o navegador limita quantos podem existir)
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        return { ok: true, software: /llvmpipe|swiftshader|software|softpipe/i.test(placa), placa };
    } catch {
        return { ok: false, software: false, placa: "" };
    }
}

// pega o erro da cena (ex.: "Error creating WebGL context") e mostra a explicação no lugar
export class Limite3D extends Component<{ fallback: ReactNode; children: ReactNode }, { erro: boolean }> {
    state = { erro: false };

    static getDerivedStateFromError() {
        return { erro: true };
    }

    render() {
        return this.state.erro ? this.props.fallback : this.props.children;
    }
}

export function SemWebGL({ onTentar, onFechar }: { onTentar: () => void; onFechar: () => void }) {
    return (
        <div className="mundo-sem-3d">
            <div className="mundo-sem-3d-cartao">
                <span className="mundo-sem-3d-icone"><MonitorX size={26} /></span>
                <strong>O 3D não abriu neste navegador</strong>
                <p>
                    Ele não conseguiu usar a placa de vídeo (WebGL). <b>Feche e abra o navegador de novo</b>: quando a placa de
                    vídeo trava algumas vezes, o Chrome desliga a aceleração até ser reiniciado.
                </p>
                <p>
                    Se continuar, confira se a <b>aceleração por hardware</b> está ligada nas configurações do navegador.
                </p>
                <p className="texto-fraco">
                    Navegadores embutidos em outros programas (como o do VS Code) muitas vezes não têm acesso à placa de vídeo.
                </p>
                <div className="mundo-sem-3d-acoes">
                    <button className="botao botao-fantasma" onClick={onFechar}>Voltar</button>
                    <button className="botao botao-primario" onClick={onTentar}>
                        <RotateCcw size={16} /> Tentar de novo
                    </button>
                </div>
            </div>
        </div>
    );
}

// abriu, mas desenhando sem placa de vídeo: funciona, só que bem devagar
export function AvisoSoftware({ onFechar }: { onFechar: () => void }) {
    return (
        <div className="mundo-aviso-software" role="status">
            <TriangleAlert size={16} />
            <span>O navegador está desenhando o 3D sem a placa de vídeo, então vai ficar lento. Use o Chrome ou o Firefox do computador com a aceleração por hardware ligada.</span>
            <button className="botao-icone botao-icone-mini" onClick={onFechar} aria-label="Fechar aviso">
                <X size={15} />
            </button>
        </div>
    );
}

// a placa de vídeo "reiniciou" no meio (driver, falta de memória): oferece montar a cena de novo
export function ContextoPerdido({ onRecarregar }: { onRecarregar: () => void }) {
    return (
        <div className="mundo-sem-3d">
            <div className="mundo-sem-3d-cartao">
                <span className="mundo-sem-3d-icone"><MonitorX size={26} /></span>
                <strong>O 3D parou</strong>
                <p>A placa de vídeo reiniciou no meio do caminho. Sua call continua normal.</p>
                <div className="mundo-sem-3d-acoes">
                    <button className="botao botao-primario" onClick={onRecarregar}>
                        <RotateCcw size={16} /> Recarregar o 3D
                    </button>
                </div>
            </div>
        </div>
    );
}
