import type { Canal, Usuario } from "../api";
import type { Voz } from "../tipos";

// quem está numa sala: o que o back informou + você mesmo, se estiver conectado nela
export function pessoasNaSala(canal: Canal, voz: Voz | null, eu: Usuario): Usuario[] {
    const lista = canal.participantes ?? [];
    if (voz?.canal.id === canal.id && !lista.some((p) => p.id === eu.id)) {
        return [eu, ...lista];
    }
    return lista;
}
