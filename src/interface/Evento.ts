import type { TipoCanal } from "../../generated/prisma/enums"

type Canal = {
    id: string,
    tipo : TipoCanal
    criado_em : Date
    nome: string,
}

type Mensagem = {
    id: string
    conteudo : string,
    criadoEm : Date
    editadaEm : Date | null
    autor: {id: string;nome:string;avatarUrl: string | null}
}

export type Evento =
    | { tipo: "ENTROU_NA_CALL"; canalId: string; usuarioId: string }
    | { tipo: "SAIU_DA_CALL"; canalId: string; usuarioId: string }
    | { tipo: "MENSAGEM_CRIADA";servidor_id: string;canalId: string; mensagem: Mensagem }
    | { tipo: "CANAL_CRIADO"; servidorId: string ;canal: Canal }
    | {tipo: "CANAL_APAGADO"; servidorId : string ;canalId: string }
    | {tipo: "UPDATE_SERVER"; servidorId: string; nome : string}
    | {tipo: "DIGITANDO"; usuarioId : string,canalId: string}