// Service worker mínimo do Visatto: permite instalar o painel como app.
// Não guarda nada em cache (pedidos e cardápio precisam estar sempre atualizados);
// sem internet, mostra um aviso simples em vez da tela de erro do navegador.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(
    fetch(e.request).catch(
      () =>
        new Response(
          '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:sans-serif;text-align:center;padding:40px;background:#fbf7f1"><h2>Sem internet</h2><p>Confira a conexão e tente de novo.</p><button onclick="location.reload()" style="padding:12px 20px;border-radius:12px;border:0;background:#E4572E;color:#fff;font-weight:700">Tentar de novo</button></body>',
          { headers: { "Content-Type": "text/html; charset=utf-8" } },
        ),
    ),
  );
});
