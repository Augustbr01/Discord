// Todas as chamadas ao backend ficam aqui. Se mudar uma rota no Fastify, ajuste só este arquivo.

// entrou_em: quando a pessoa criou a conta no Liberdade (só vem nos membros do GET /servidor/:id)
export type Usuario = { id: string; nome: string; avatarUrl: string | null; entrou_em?: string };
export type Permissao = "ADMIN" | "MEMBRO";
export type TipoCanal = "TEXTO" | "VOZ";
// como a sala de voz é montada no mundo 3D
export type ModeloSala = "PADRAO" | "CINEMA";
// participantes: quem está na sala agora; telas: ids de quem está compartilhando a tela
// (os dois só em canais de voz)
export type Canal = { id: string; nome: string; tipo: TipoCanal; modelo?: ModeloSala; participantes?: Usuario[]; telas?: string[] };
export type Membro = { permissao: Permissao; usuario: Usuario };
export type ServidorResumo = { id: string; nome: string; iconeUrl: string | null };
export type ServidorDetalhe = ServidorResumo & {
    dono: { id: string; nome: string };
    membros: Membro[];
    canais: Canal[];
};
export type Convite = { id: string; criadoEm: string; expiraEm: string | null };
export type ConexaoVoz = { token: string; url: string };

// rotas de mensagem ainda não existem no back:
// GET  /api/canal/:id/mensagens -> Mensagem[]  (as últimas, da mais antiga pra mais nova)
// POST /api/canal/:id/mensagens { conteudo } -> Mensagem
export type Mensagem = {
    id: string;
    conteudo: string;
    criadoEm: string;
    editadaEm: string | null;
    autor: Usuario;
};

// igual ao VarChar(1000) do model Mensagem
export const LIMITE_MENSAGEM = 1000;

// iguais ao schema da rota de avatar e ao limits.fileSize do multipart no back
export const TIPOS_AVATAR = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const LIMITE_AVATAR = 4 * 1024 * 1024;

export class ErroApi extends Error {
    status: number;

    constructor(status: number, mensagem: string) {
        super(mensagem);
        this.status = status;
    }
}

async function chamar<T>(caminho: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`/api${caminho}`, {
        ...init,
        // o Fastify recusa Content-Type JSON com corpo vazio, então só manda quando tem corpo.
        // FormData fica sem: o navegador monta o multipart/form-data (com o boundary) sozinho
        headers: init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : undefined,
    });

    if (res.status === 204) {
        return undefined as T;
    }

    const dados = await res.json().catch(() => null);

    if (!res.ok) {
        throw new ErroApi(res.status, dados?.mensagem ?? dados?.message ?? `Erro ${res.status}`);
    }

    return dados as T;
}

function post(corpo?: unknown): RequestInit {
    return corpo === undefined ? { method: "POST" } : { method: "POST", body: JSON.stringify(corpo) };
}

export const api = {
    loginUrl: "/api/auth/discord",

    eu: () => chamar<Usuario>("/dataUser"),
    sair: () => chamar<void>("/logout", post()),
    // o nome do campo ("avatar") precisa bater com o body do schema no back
    atualizarAvatar: (arquivo: File) => {
        const form = new FormData();
        form.append("avatar", arquivo);
        return chamar<Usuario>("/atualizar/imagem", { method: "POST", body: form });
    },
    // apaga a foto do R2 e volta pro avatar padrão do Discord
    removerAvatar: () => chamar<Usuario>("/excluir/imagem", post()),

    listarServidores: () => chamar<ServidorResumo[]>("/servidor/listar"),
    obterServidor: async (id: string): Promise<ServidorDetalhe> => {
        // o back manda `pessoasVoz: { canalId: [usuarioId] }`; aqui cruzamos com os
        // membros pra virar o `participantes: Usuario[]` que o painel de canais já espera.
        // `telas` (mesmo formato: { canalId: [usuarioId] }) diz quem está compartilhando a tela
        const bruto = await chamar<ServidorDetalhe & { pessoasVoz?: Record<string, string[]>; telas?: Record<string, string[]> }>(`/servidor/${id}`);
        const porId = new Map(bruto.membros.map((m) => [m.usuario.id, m.usuario]));
        const canais = bruto.canais.map((c) =>
            c.tipo === "VOZ"
                ? {
                      ...c,
                      participantes: (bruto.pessoasVoz?.[c.id] ?? [])
                          .map((uid) => porId.get(uid))
                          .filter((u): u is Usuario => u !== undefined),
                      telas: bruto.telas?.[c.id] ?? [],
                  }
                : c,
        );
        return { ...bruto, canais };
    },
    criarServidor: (nomeServidor: string) => chamar<ServidorResumo>("/servidor/criar", post({ nomeServidor })),
    // só admin; o back avisa os membros com UPDATE_SERVER
    editarServidor: (idServidor: string, nome: string) =>
        chamar<{ id: string; nome: string }>("/servidor/editar", post({ idServidor, nomeCanal: nome })),
    criarCanal: (servidorId: string, nomeCanal: string, tipoSala: TipoCanal, modeloSala?: ModeloSala) =>
        chamar<Canal>("/servidor/sala-criar", post({ servidorId, nomeCanal, tipoSala, ...(modeloSala ? { modeloSala } : {}) })),
    apagarCanal: (canalId: string) => chamar<void>(`/servidor/sala-deletar/${canalId}`, { method: "DELETE" }),
    // só admin; o back avisa o servidor com MEMBROS (acao EXPULSO)
    expulsarMembro: (idServidor: string, idMembro: string) =>
        chamar<void>("/expulsar/membro", post({ idServidor, idMembro })),

    // expiraEm = segundos até expirar; undefined = convite permanente
    criarConvite: (idServidor: string, expiraEm?: number) =>
        chamar<Convite>("/servidor/convite-criar", post(expiraEm ? { idServidor, expiraEm } : { idServidor })),
    entrarConvite: (idConvite: string) =>
        chamar<{ servidor: ServidorResumo }>(`/servidor/convite/${idConvite}`, post()),

    // idUltima = cursor: traz as mensagens ANTES dessa (pra rolar e carregar mais antigas)
    listarMensagens: (canalId: string, idUltima?: string) => {
        const qs = idUltima ? `?${new URLSearchParams({ idUltima })}` : "";
        return chamar<Mensagem[]>(`/servidor/mensagens/${canalId}${qs}`);
    },
    enviarMensagem: (canalId: string, conteudo: string) =>
        chamar<Mensagem>("/servidor/mensagem/criar", post({ canalId, mensagem: conteudo })),
    // só o autor; o back avisa o servidor com MENSAGEM_EDITADA
    editarMensagem: (mensagemId: string, canalId: string, conteudo: string) =>
        chamar<Mensagem>("/servidor/editar/mensagem", post({ mensagemId, canalId, mensagem: conteudo })),
    // só o autor; o back avisa o servidor com MENSAGEM_DELETADA
    apagarMensagem: (mensagemId: string, canalId: string) =>
        chamar<void>("/servidor/excluir/mensagem", post({ canalId, mensagemId })),

    tokenVoz: (canalId: string) =>
        chamar<ConexaoVoz>(`/livekit/token?${new URLSearchParams({ salaId: canalId })}`),
    // call do hall do mundo 3D (uma por servidor, escondida de quem está fora do 3D)
    tokenHall: (servidorId: string) =>
        chamar<ConexaoVoz>(`/livekit/token?${new URLSearchParams({ hall: servidorId })}`),
};

export function mensagemDeErro(err: unknown) {
    return err instanceof Error ? err.message : String(err);
}

// erros que podem significar sessão vencida (os hooks do back usam 400/401/404)
export function talvezDeslogado(err: unknown) {
    return err instanceof ErroApi && [400, 401, 404].includes(err.status);
}
