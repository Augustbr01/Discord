// As teclas do 3D, num lugar só: o card que aparece com o mouse solto e as configurações usam esta lista.
import { Fragment, type ReactNode } from "react";
import { Crosshair, Footprints, Hand, Mouse, MouseLeft } from "lucide-react";

// teclas especiais do mouse viram ícone
const MOUSE: Record<string, ReactNode> = {
    "@clique": <><MouseLeft size={14} /> Clique</>,
    "@rodinha": <><Mouse size={14} /> Rodinha</>,
    "@rodinha-baixo": <><Mouse size={14} /> ↓</>,
};

// junto: "+" = apertar ao mesmo tempo, "/" = qualquer uma; cruz: W A S D montado como no teclado
type Atalho = { teclas: string[]; junto?: "+" | "/"; cruz?: boolean; texto: string; detalhe?: string };

const GRUPOS: { titulo: string; icone: ReactNode; atalhos: Atalho[] }[] = [
    {
        titulo: "Movimento",
        icone: <Footprints size={14} />,
        atalhos: [
            { teclas: ["W", "A", "S", "D"], cruz: true, texto: "Andar" },
            { teclas: ["Shift"], texto: "Andar devagar" },
            { teclas: ["Espaço", "@rodinha-baixo"], junto: "/", texto: "Pular" },
            { teclas: ["Ctrl"], texto: "Agachar", detalhe: "correndo, desliza" },
            { teclas: ["C"], texto: "Deitar / levantar" },
        ],
    },
    {
        titulo: "Interação",
        icone: <Hand size={14} />,
        atalhos: [
            { teclas: ["E"], texto: "Interagir e sentar" },
            { teclas: ["@clique"], texto: "Abrir a tela", detalhe: "de quem compartilha" },
            { teclas: ["F"], texto: "Tela cheia", detalhe: "da tela compartilhada" },
            { teclas: ["T"], texto: "Tablet da sala" },
        ],
    },
    {
        titulo: "Câmera e jogo",
        icone: <Crosshair size={14} />,
        atalhos: [
            { teclas: ["Ctrl", "@rodinha"], junto: "+", texto: "Zoom" },
            { teclas: ["O"], texto: "Configurações" },
            { teclas: ["Esc"], texto: "Soltar o mouse" },
        ],
    },
];

function Tecla({ t }: { t: string }) {
    const mouse = MOUSE[t];
    return <kbd className={`tecla ${mouse ? "tecla-mouse" : t.length > 1 ? "tecla-larga" : ""}`}>{mouse ?? t}</kbd>;
}

export function ListaTeclas() {
    return (
        <div className="lista-teclas">
            {GRUPOS.map((g) => (
                <section key={g.titulo}>
                    <h4>
                        {g.icone}
                        {g.titulo}
                    </h4>
                    <dl>
                        {g.atalhos.map((a) => (
                            <div key={a.texto} className={a.cruz ? "com-cruz" : ""}>
                                <dt>
                                    {a.cruz ? (
                                        <span className="teclas-cruz">
                                            {a.teclas.map((t) => <Tecla key={t} t={t} />)}
                                        </span>
                                    ) : (
                                        a.teclas.map((t, i) => (
                                            <Fragment key={t}>
                                                {i > 0 && a.junto && <span className="lista-teclas-junto">{a.junto}</span>}
                                                <Tecla t={t} />
                                            </Fragment>
                                        ))
                                    )}
                                </dt>
                                <dd>
                                    {a.texto}
                                    {a.detalhe && <small>{a.detalhe}</small>}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </section>
            ))}
        </div>
    );
}
