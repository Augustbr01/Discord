// abrir junto com o sistema, já escondido na bandeja (--oculto).
// Windows e macOS têm API pra isso; no Linux é um .desktop em ~/.config/autostart
import { app } from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const ARG_OCULTO = "--oculto";

const arquivoLinux = () => path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config"), "autostart", "liberdade.desktop");

export function inicioAutomaticoLigado() {
    if (process.platform === "linux") return fs.existsSync(arquivoLinux());
    return app.getLoginItemSettings({ args: [ARG_OCULTO] }).openAtLogin;
}

export function definirInicioAutomatico(ligar: boolean) {
    if (process.platform !== "linux") {
        app.setLoginItemSettings({ openAtLogin: ligar, args: [ARG_OCULTO] });
        return;
    }
    const arquivo = arquivoLinux();
    if (!ligar) {
        fs.rmSync(arquivo, { force: true });
        return;
    }
    // no AppImage o executável de verdade é o .AppImage (process.execPath fica num mount temporário)
    const exe = process.env.APPIMAGE ?? process.execPath;
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    fs.writeFileSync(
        arquivo,
        ["[Desktop Entry]", "Type=Application", "Name=Liberdade", `Exec="${exe}" ${ARG_OCULTO}`, "X-GNOME-Autostart-enabled=true", ""].join("\n"),
    );
}

// abriu pelo início automático: fica só na bandeja
export function abriuOculto() {
    if (process.argv.includes(ARG_OCULTO)) return true;
    return process.platform === "darwin" && app.getLoginItemSettings().wasOpenedAtLogin;
}
