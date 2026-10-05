import type { Canal, ConexaoVoz, Usuario } from "./api";

// a chamada em que você está (continua ativa enquanto você navega pelos canais)
export type Voz = {
    canal: Canal;
    servidorId: string;
    servidorNome: string;
    conexao: ConexaoVoz;
    desde: number;
};

// identity do LiveKit (= id do usuário) -> dados do membro
export type MapaMembros = Map<string, Usuario>;
