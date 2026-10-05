// FNV-1a: transforma um texto num número estável (o mesmo texto sempre dá o mesmo número)
export function hash(texto: string) {
    let h = 2166136261;
    for (let i = 0; i < texto.length; i++) {
        h ^= texto.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

// tons de cinza pros avatares sem foto: neutros, só pra diferenciar uma pessoa da outra
const TONS = ["#2a2a2f", "#303036", "#36363c", "#3d3d44"];

export function tomNeutro(texto: string) {
    return TONS[hash(texto) % TONS.length];
}

export function iniciais(nome: string) {
    const partes = nome.trim().split(/[\s._-]+/).filter(Boolean);
    if (partes.length === 0) return "?";
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return (partes[0][0] + partes[1][0]).toUpperCase();
}

// os avatares padrão do Discord são coloridos; esses viram iniciais em cinza
export function avatarReal(url: string | null | undefined) {
    if (!url) return null;
    return /cdn\.discordapp\.com\/embed\/avatars\//.test(url) ? null : url;
}

// "Sessão" e "sessao" viram a mesma coisa na busca
export function normalizar(texto: string) {
    return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function estaDigitando(e: KeyboardEvent) {
    const el = e.target as HTMLElement | null;
    if (!el) return false;
    return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

export function cronometro(ms: number) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const dois = (n: number) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${dois(m)}:${dois(s)}` : `${dois(m)}:${dois(s)}`;
}

export function hora(data: number | string | Date) {
    return new Date(data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function mesmoDia(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// "Hoje", "Ontem" ou "12 de outubro de 2026"
export function rotuloDia(data: Date) {
    const hoje = new Date();
    const ontem = new Date();
    ontem.setDate(hoje.getDate() - 1);
    if (mesmoDia(data, hoje)) return "Hoje";
    if (mesmoDia(data, ontem)) return "Ontem";
    return data.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

// "Hoje às 14:32", "Ontem às 09:10" ou "12/10/2026 14:32"
export function quando(data: string | Date) {
    const d = new Date(data);
    const dia = rotuloDia(d);
    if (dia === "Hoje" || dia === "Ontem") return `${dia} às ${hora(d)}`;
    return `${d.toLocaleDateString("pt-BR")} ${hora(d)}`;
}

// separa os links do texto pra virarem <a>
const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])/g;

export function partesTexto(texto: string) {
    return texto.split(URL_RE).map((valor, i) => ({ link: i % 2 === 1, valor }));
}

// aceita o link inteiro (https://.../convite/<id>) ou só o id
export function extrairIdConvite(texto: string) {
    return texto.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] ?? null;
}

export function idLocal() {
    return typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function lerArmazenado<T>(chave: string, padrao: T): T {
    try {
        const valor = localStorage.getItem(chave);
        return valor === null ? padrao : (JSON.parse(valor) as T);
    } catch {
        return padrao;
    }
}

export function salvarArmazenado(chave: string, valor: unknown) {
    try {
        localStorage.setItem(chave, JSON.stringify(valor));
    } catch {
        // sem armazenamento (aba anônima bloqueada etc.): só não lembra
    }
}

export const ehMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.userAgent);
export const teclaAtalho = ehMac ? "⌘" : "Ctrl";
