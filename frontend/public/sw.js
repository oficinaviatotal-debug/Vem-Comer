/*
 * Vem Comer - aviso no celular com o app fechado (Web Push).
 *
 * Este arquivo e o "robo" que o navegador deixa acordado para receber a notificacao do servidor mesmo com o app fechado.
 * Ele NAO guarda paginas nem mexe em nenhuma requisicao do app (nao ha "fetch" aqui): so mostra o aviso e abre o painel
 * quando a pessoa toca nele. Por isso nao pode deixar o app preso numa versao velha.
 *
 * O servidor manda um texto curto em JSON: { title, body, tag, url }. Nunca leva nome, telefone, endereco nem valor,
 * porque o aviso aparece com a tela bloqueada. O endereco (url) so vale se for dentro do proprio site.
 */

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

function insideSite(value) {
  return typeof value === "string" && value.charAt(0) === "/" && value.charAt(1) !== "/" ? value : "/";
}

function text(value, limit, fallback) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, limit) : fallback;
}

self.addEventListener("push", function (event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = {};
  }
  if (!data || typeof data !== "object") data = {};

  var title = text(data.title, 80, "Vem Comer");
  var options = {
    body: text(data.body, 160, ""),
    tag: text(data.tag, 100, "vem-comer"),
    renotify: true,
    icon: "/icon-192.png",
    vibrate: [250, 100, 250],
    data: { url: insideSite(data.url) },
  };

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (windows) {
      // Com o painel aberto e na frente ele mesmo apita e vibra (alertDevice.ts): nao repete por cima.
      var looking = windows.some(function (client) {
        return client.visibilityState === "visible" && client.focused;
      });
      if (looking) return undefined;
      return self.registration.showNotification(title, options);
    })
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var url = insideSite(event.notification.data && event.notification.data.url);

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (windows) {
      for (var i = 0; i < windows.length; i += 1) {
        if ("focus" in windows[i]) return windows[i].focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
