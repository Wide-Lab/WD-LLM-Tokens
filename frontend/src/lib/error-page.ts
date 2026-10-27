/**
 * Página de falha do servidor, quando nem o React chegou a renderizar. É HTML cru, sem o CSS do
 * app, então repete à mão o estado de erro do wide-ui (cartão, tile `danger-bg`, botões de 36px)
 * com os valores claro e escuro do `tokens.css` — é a única cópia de valor fora dele, e por isso
 * mesmo fica restrita a esta página. O escuro segue o sistema: sem JS, não há como ler o tema
 * salvo.
 */
export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Esta página não carregou</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 13.5px/1.5 Inter, system-ui, -apple-system, sans-serif; background: #F7F7F8; color: #18181B; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; background: #fff; border: 1px solid #E4E4E7; border-radius: 8px; box-sizing: border-box; }
      .tile { width: 48px; height: 48px; margin: 0 auto 16px; border-radius: 8px; background: #FEF2F2; color: #B91C1C; display: grid; place-items: center; font-weight: 700; font-size: 20px; }
      h1 { font-size: 16px; font-weight: 600; margin: 0 0 4px; }
      p { color: #52525B; font-size: 13px; margin: 0 0 24px; }
      .actions { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
      a, button { height: 36px; padding: 0 14px; border-radius: 8px; font: inherit; font-weight: 500; cursor: pointer; text-decoration: none; border: 1px solid transparent; display: inline-flex; align-items: center; }
      .primary { background: #E30D4D; color: #fff; }
      .secondary { background: #fff; color: #18181B; border-color: #D4D4D8; }
      /* Sem o script do tema aqui, quem decide é o sistema: os valores escuros do \`tokens.css\`. */
      @media (prefers-color-scheme: dark) {
        body { background: #0E0E10; color: #EDEDEF; }
        .card { background: #17171A; border-color: #2A2A2F; }
        .tile { background: rgba(248, 113, 113, .10); color: #F87171; }
        p { color: #A1A1AA; }
        .secondary { background: #17171A; color: #EDEDEF; border-color: #3A3A40; }
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="tile" aria-hidden="true">!</div>
      <h1>Esta página não carregou</h1>
      <p>Algo falhou do nosso lado. Tente de novo ou volte para a visão geral.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Tentar de novo</button>
        <a class="secondary" href="/">Ir para a visão geral</a>
      </div>
    </div>
  </body>
</html>`;
}
