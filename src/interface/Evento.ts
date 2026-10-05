export type Evento =
    | { tipo: "ENTROU_NA_CALL"; canalId: string; usuarioId: string }
    | { tipo: "SAIU_DA_CALL"; canalId: string; usuarioId: string }
    | { tipo: "MENSAGEM_CRIADA"; canalId: string; mensagem: Mensagem }
    | { tipo: "CANAL_CRIADO"; canal: Canal };