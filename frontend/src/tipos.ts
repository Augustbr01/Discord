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
    // alguém começou (ABRIU) ou parou (FECHOU) de compartilhar a tela numa sala de voz
    | { tipo: "TELA"; canalId: string; usuarioId: string; statusTela: "ABRIU" | "FECHOU" }
    | { tipo: "CANAL_CRIADO"; servidorId: string; canal: Canal }
    | { tipo: "CANAL_APAGADO"; servidorId: string; canalId: string }
    | { tipo: "UPDATE_SERVER"; servidorId: string; nome: string }
    | { tipo: "MENSAGEM_CRIADA"; servidorId: string; canalId: string; mensagem: Mensagem }
    | { tipo: "MENSAGEM_EDITADA"; servidorId: string; canalId: string; mensagem: Mensagem }
    | { tipo: "MENSAGEM_DELETADA"; servidorId: string; canalId: string; mensagem: { id: string } }
    | { tipo: "DIGITANDO"; canalId: string; usuarioId: string };

// o que o CLIENTE manda pelo WebSocket (entrada). O servidor carimba a identidade
// (usuarioId) a partir do socket — o cliente só diz "onde".
export type MensagemCliente = { tipo: "DIGITANDO"; canalId: string };
