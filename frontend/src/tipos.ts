import type { Canal, ConexaoVoz, Mensagem, Usuario } from "./api";

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

// eventos que o servidor empurra pelo WebSocket (/api/gateway).
// precisa bater com o `Evento` do back (eventosConexao.ts)
export type EventoGateway =
    | { tipo: "ENTROU_NA_CALL"; canalId: string; usuarioId: string }
    | { tipo: "SAIU_DA_CALL"; canalId: string; usuarioId: string }
    | { tipo: "CANAL_CRIADO"; servidorId: string; canal: Canal }
    | { tipo: "MENSAGEM_CRIADA"; canalId: string; mensagem: Mensagem };
