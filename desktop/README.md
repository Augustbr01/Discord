# Liberdade desktop

App para Linux, Windows e macOS. É uma janela do Electron que abre o site público: um `npm run build` no frontend já atualiza o app de todo mundo. O app em si só precisa de versão nova quando muda algo aqui em `desktop/`.

## Rodar

```bash
cd desktop
npm install
npx install-electron   # o npm 11 não baixa o binário do Electron sozinho
npm start              # abre o site público
npm run dev            # abre o vite local (http://localhost:5174)
```

Outro endereço: `npm start -- --site=https://liberdade.phelipedev.com.br` ou `LIBERDADE_SITE=...`.

## O que o app faz além do site

| | Onde |
|---|---|
| Fechar a janela deixa o app na bandeja (a chamada continua) | `src/main.ts`, `src/bandeja.ts` |
| Bandeja com microfone/áudio, abrir com o sistema e sair | `src/bandeja.ts`, `src/inicioAutomatico.ts` |
| Atalhos globais Ctrl+Shift+M (microfone) e Ctrl+Shift+D (áudio), com som | `src/atalhos.ts` |
| Contador de não lidas no ícone (dock, barra de tarefas) e piscar quando chega mensagem | `src/bandeja.ts` |
| Seletor de tela/janela para compartilhar (macOS 15+ e Wayland usam o do sistema) | `src/seletorTela.ts`, `src/seletor.html` |
| Som junto com a tela: no Windows o do computador; no Linux só o programa que você escolher (venmic + PipeWire, como o Vesktop), nunca o som da chamada | `src/seletorTela.ts`, `src/audioTela.ts`, `src/seletorAudio.html` |
| Links `liberdade://convite/<id>` abrem o convite no app | `src/main.ts` |
| Uma instância só, tamanho/posição da janela lembrados, menu do botão direito com corretor | `src/main.ts`, `src/janela.ts` |
| Página de "sem conexão" que tenta de novo sozinha | `src/offline.html` |

O site conversa com o app pelo `window.liberdadeDesktop` (`src/preload.ts`, e do lado do site `frontend/src/lib/desktop.ts`). No navegador ele não existe e nada disso roda.

## Gerar os instaladores

```bash
npm run pacote:linux   # AppImage e .deb
npm run pacote:win     # instalador .exe
npm run pacote:mac     # .dmg (precisa rodar num Mac)
```

Saem em `release/`. Os ícones vêm de `npm run icones` (já estão gerados em `build/` e `assets/`).

- **macOS:** sem assinar e notarizar (conta Apple Developer), o Gatekeeper bloqueia o app em outros Macs.
- **Windows:** sem assinar, o SmartScreen avisa na primeira vez.
- **Linux (GNOME no Wayland):** os atalhos globais dependem do portal do sistema e podem não registrar. A bandeja alterna o microfone e o áudio do mesmo jeito.
