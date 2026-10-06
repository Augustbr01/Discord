import { useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { api, mensagemDeErro, type Convite, type ServidorDetalhe } from "../../api";
import { Dialogo } from "../ui/Dialogo";

const DURACOES = [
    { rotulo: "30 minutos", segundos: 30 * 60 },
    { rotulo: "1 hora", segundos: 60 * 60 },
    { rotulo: "6 horas", segundos: 6 * 60 * 60 },
    { rotulo: "1 dia", segundos: 24 * 60 * 60 },
    { rotulo: "7 dias", segundos: 7 * 24 * 60 * 60 },
    { rotulo: "Nunca", segundos: 0 },
];

export function Convidar({ servidor, onFechar }: { servidor: ServidorDetalhe; onFechar: () => void }) {
    const [segundos, setSegundos] = useState(7 * 24 * 60 * 60);
    const [convite, setConvite] = useState<Convite | null>(null);
    const [copiado, setCopiado] = useState(false);
    const [gerando, setGerando] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    // numa página embutida isolada a origem vale "null": aí o link fica só com o caminho
    const origem = location.origin === "null" ? "" : location.origin;
    const link = convite ? `${origem}/convite/${convite.id}` : "";

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
        try {
            await navigator.clipboard.writeText(link);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
        } catch {
            setErro("Não deu pra copiar automaticamente. Selecione o link e copie.");
        }
    }

    return (
        <Dialogo titulo={`Convidar para ${servidor.nome}`} descricao="Quem abrir o link entra direto no servidor." onFechar={onFechar}>
            <div className="formulario">
                <label className="campo-rotulado">
                    <span className="rotulo">O link expira em</span>
                    <select
                        className="campo"
                        value={segundos}
                        onChange={(e) => {
                            setSegundos(Number(e.target.value));
                            setConvite(null);
                        }}
                    >
                        {DURACOES.map((d) => (
                            <option key={d.rotulo} value={d.segundos}>{d.rotulo}</option>
                        ))}
                    </select>
                </label>

                {convite ? (
                    <div className="campo-rotulado">
                        <span className="rotulo">Link de convite</span>
                        <div className="link-convite">
                            <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Link de convite" />
                            <button className="botao botao-primario botao-pequeno" onClick={copiar}>
                                {copiado ? <Check size={15} /> : <Copy size={15} />}
                                {copiado ? "Copiado" : "Copiar"}
                            </button>
                        </div>
                        <span className="texto-fraco link-validade">
                            {convite.expiraEm
                                ? `Válido até ${new Date(convite.expiraEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}.`
                                : "Este link não expira."}
                        </span>
                    </div>
                ) : (
                    <button className="botao botao-primario botao-largo" onClick={gerar} disabled={gerando}>
                        {gerando && <Loader2 size={16} className="girar" />}
                        Gerar link
                    </button>
                )}

                {erro && <p className="texto-erro">{erro}</p>}
            </div>
        </Dialogo>
    );
}
