import { useState } from "react";
import { api, mensagemDeErro, type Convite, type ServidorDetalhe } from "../api";
import { Modal } from "./Modal";

const DURACOES = [
    { rotulo: "30 minutos", segundos: 30 * 60 },
    { rotulo: "1 hora", segundos: 60 * 60 },
    { rotulo: "6 horas", segundos: 6 * 60 * 60 },
    { rotulo: "12 horas", segundos: 12 * 60 * 60 },
    { rotulo: "1 dia", segundos: 24 * 60 * 60 },
    { rotulo: "7 dias", segundos: 7 * 24 * 60 * 60 },
    { rotulo: "Nunca", segundos: 0 },
];

type Props = { servidor: ServidorDetalhe; onFechar: () => void };

export function Convidar({ servidor, onFechar }: Props) {
    const [segundos, setSegundos] = useState(7 * 24 * 60 * 60);
    const [convite, setConvite] = useState<Convite | null>(null);
    const [copiado, setCopiado] = useState(false);
    const [gerando, setGerando] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    const link = convite ? `${location.origin}/convite/${convite.id}` : "";

    async function gerar() {
        setGerando(true);
        setErro(null);
        setCopiado(false);
        try {
            setConvite(await api.criarConvite(servidor.id, segundos || undefined));
        } catch (err) {
            setErro(mensagemDeErro(err));
        } finally {
            setGerando(false);
        }
    }

    async function copiar() {
        await navigator.clipboard.writeText(link);
        setCopiado(true);
    }

    return (
        <Modal titulo={`Convidar para ${servidor.nome}`} onFechar={onFechar}>
            <div className="form-modal">
                <label>
                    Expira em
                    <select value={segundos} onChange={(e) => { setSegundos(Number(e.target.value)); setConvite(null); }}>
                        {DURACOES.map((d) => <option key={d.rotulo} value={d.segundos}>{d.rotulo}</option>)}
                    </select>
                </label>

                {convite ? (
                    <>
                        <div className="campo-copiar">
                            <input readOnly value={link} onFocus={(e) => e.target.select()} />
                            <button className={`botao ${copiado ? "botao-sucesso" : "botao-primario"}`} onClick={copiar}>
                                {copiado ? "Copiado" : "Copiar"}
                            </button>
                        </div>
                        <p className="dica">
                            {convite.expiraEm
                                ? `Expira em ${new Date(convite.expiraEm).toLocaleString("pt-BR")}`
                                : "Este convite nunca expira"}
                        </p>
                    </>
                ) : (
                    <button className="botao botao-primario" onClick={gerar} disabled={gerando}>
                        {gerando ? "Gerando..." : "Gerar link de convite"}
                    </button>
                )}

                {erro && <p className="texto-erro">{erro}</p>}
            </div>
        </Modal>
    );
}
