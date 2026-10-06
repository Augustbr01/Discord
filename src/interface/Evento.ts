import type { TipoCanal } from "../../generated/prisma/enums"

type Canal = {
    id: string,
    tipo : TipoCanal
    criado_em : Date
    nome: string,
}

type Mensagem = {
    conteudo : string,
    enviadaPorId: string,
    criada_em : string
}

export type Evento =
    | { tipo: "ENTROU_NA_CALL"; canalId: string; usuarioId: string }
    | { tipo: "SAIU_DA_CALL"; canalId: string; usuarioId: string }
    | { tipo: "MENSAGEM_CRIADA"; canalId: string; mensagem: Mensagem }
    | { tipo: "CANAL_CRIADO"; servidorId: string ;canal: Canal }
    | {tipo: "CANAL_APAGADO"; servidorId : string ;canalId: string }
    | {tipo: "UPDATE_SERVER"; servidorId: string; nome : string}