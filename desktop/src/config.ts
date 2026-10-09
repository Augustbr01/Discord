import path from "node:path";

// qual site o app abre: --site=<url> (o `npm run dev` aponta pro vite local), LIBERDADE_SITE ou
// o público. O app é só a janela: o site continua vindo do servidor, então um `npm run build`
// lá já atualiza o app de todo mundo
function lerSite() {
    const arg = process.argv.find((a) => a.startsWith("--site="))?.slice("--site=".length);
    return new URL(arg ?? process.env.LIBERDADE_SITE ?? "https://liberdade.augustdev.com.br").origin;
}

export const SITE = lerSite();
const LOCAL = new URL(SITE).hostname === "localhost";

export const PROTOCOLO = "liberdade";
export const ID_APP = "br.com.augustdev.liberdade";

// assets/ fica do lado de dist/ (no pacote também)
export const ASSETS = path.join(__dirname, "..", "assets");

// no localhost a porta não separa cookie, e o login do Discord volta pela porta do backend em
// modo dev (5173), não a do vite (5174): qualquer porta do localhost conta como o site
export function ehDoSite(url: string | null | undefined) {
    if (!url) return false;
    try {
        const u = new URL(url);
        return u.origin === SITE || (LOCAL && u.hostname === "localhost");
    } catch {
        return false;
    }
}
