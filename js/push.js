
const VAPID_PUBLIC_KEY = config.vapidPublicKey || "";

/** Converte a chave VAPID (base64url) para Uint8Array */
const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

/** Salva ou remove a subscription no servidor */
const savePushSubscription = async (subscription, remove = false) => {
  if (!hasSupabase || !db) return;
  try {
    const { data: { session } } = await db.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    await fetch("/api/push-subscription", {
      method: remove ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(remove ? { endpoint: subscription.endpoint } : { subscription }),
    });
  } catch (err) {
    console.warn("push-subscription:", err);
  }
};

/**
 * Solicita permissão e registra a subscription push.
 * Chamado uma vez após o login quando VAPID_PUBLIC_KEY estiver disponível.
 */
const initPushNotifications = async () => {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !VAPID_PUBLIC_KEY) return;

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();

  // Já inscrito — salva no servidor (caso troca de dispositivo) e sai
  if (existing) {
    await savePushSubscription(existing);
    return;
  }

  // Pede permissão apenas se ainda não foi decidido
  const permission = Notification.permission === "default"
    ? await Notification.requestPermission()
    : Notification.permission;

  if (permission !== "granted") return;

  try {
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    await savePushSubscription(subscription);
  } catch (err) {
    console.warn("Erro ao inscrever notificações push:", err);
  }
};

/**
 * Verifica alertas locais e exibe notificações nativas quando o app está em background.
 * Categorias: parto previsto, vacina/medicação vencendo, produção do dia pendente.
 */
const checkPushAlerts = async () => {
  if (!("serviceWorker" in navigator) || Notification.permission !== "granted") return;

  const reg = await navigator.serviceWorker.ready;
  const today = todayIso();
  const in7days = addDaysIso(today, 7);
  const alerts = [];

  // 1. Parto previsto nos próximos 7 dias
  for (const b of state.breeding) {
    if (!b.expected_calving) continue;
    if (b.expected_calving >= today && b.expected_calving <= in7days) {
      const animal = state.animals.find((a) => a.id === b.animal_id);
      const name = animal?.name || b.animal_id || "Animal";
      const diff = Math.round((new Date(b.expected_calving) - new Date(today)) / 86400000);
      alerts.push({
        title: "🐄 Parto Previsto",
        body: diff === 0
          ? `${name} está com parto previsto para hoje!`
          : `${name} tem parto previsto em ${diff} dia${diff > 1 ? "s" : ""}.`,
        tag: `calving-${b.id}`,
        url: "/?tab=breeding",
      });
    }
  }

  // 2. Medicação/vacina com data de retorno nos próximos 3 dias
  const in3days = addDaysIso(today, 3);
  for (const m of state.medication) {
    if (!m.return_date) continue;
    if (m.return_date >= today && m.return_date <= in3days) {
      const animal = state.animals.find((a) => a.id === m.animal_id);
      const name = animal?.name || m.animal_id || "Animal";
      const diff = Math.round((new Date(m.return_date) - new Date(today)) / 86400000);
      alerts.push({
        title: "💉 Retorno de Medicação",
        body: diff === 0
          ? `Retorno de ${m.medication || "medicação"} para ${name} é hoje!`
          : `Retorno de ${m.medication || "medicação"} para ${name} em ${diff} dia${diff > 1 ? "s" : ""}.`,
        tag: `med-${m.id}`,
        url: "/?tab=medication",
      });
    }
  }

  // 3. Produção do dia ainda não registrada (após às 8h)
  const hour = new Date().getHours();
  const todayRegistered = state.milk.some((r) => r.date === today);
  if (!todayRegistered && hour >= 8) {
    alerts.push({
      title: "🥛 Produção Pendente",
      body: "Você ainda não registrou a produção de leite de hoje.",
      tag: "milk-pending",
      url: "/?tab=milk",
    });
  }

  // Dispara apenas alertas que ainda não foram mostrados nesta sessão
  const shownKey = userStorageKey("push_shown_tags");
  let shown = [];
  try { shown = JSON.parse(localStorage.getItem(shownKey) || "[]"); } catch { shown = []; }

  for (const alert of alerts) {
    if (shown.includes(alert.tag)) continue;
    reg.showNotification(alert.title, {
      body: alert.body,
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-192.png",
      tag: alert.tag,
      data: { url: alert.url },
    });
    shown.push(alert.tag);
  }

  try { localStorage.setItem(shownKey, JSON.stringify(shown.slice(-50))); } catch { /* noop */ }
};

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("service-worker.js");

      // Detecta quando um novo SW termina de instalar (waiting)
      const onNewSW = (worker) => {
        if (!worker) return;
        const showUpdateBanner = () => {
          // Evita duplicar banner
          if (document.getElementById("swUpdateBanner")) return;

          const banner = document.createElement("div");
          banner.id = "swUpdateBanner";
          banner.className = "sw-update-banner";
          banner.innerHTML = `
            <span>🔄 Nova versão disponível</span>
            <button id="swUpdateBtn" class="sw-update-btn">Atualizar agora</button>
            <button id="swUpdateDismiss" class="sw-update-dismiss" aria-label="Fechar">✕</button>
          `;
          document.body.appendChild(banner);

          document.getElementById("swUpdateBtn").addEventListener("click", () => {
            worker.postMessage({ type: "SKIP_WAITING" });
            banner.remove();
          });
          document.getElementById("swUpdateDismiss").addEventListener("click", () => {
            banner.remove();
          });
        };

        if (worker.state === "installed") {
          showUpdateBanner();
        } else {
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed") showUpdateBanner();
          });
        }
      };

      // SW já estava esperando (usuário voltou com aba antiga)
      if (reg.waiting) onNewSW(reg.waiting);

      // SW novo detectado durante a sessão
      reg.addEventListener("updatefound", () => {
        onNewSW(reg.installing);
      });

      // Recarrega a página quando o novo SW assume o controle
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload();
      });
    } catch (err) {
      console.warn("Service Worker não registrado:", err);
    }
  });
}

if (hasSupabase && db) {
  db.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || !session?.user) {
      currentUserId = null;
      showLogin();
      return;
    }

    currentUserId = session.user.id;
    showApp(session.user.email);
    initApp();
  });
}

window.addEventListener("online", () => {
  if (hasSupabase && db) {
    setStatus("Conectando...", "syncing");
    processSyncQueue().then(() => checkSession());
  }
});

window.addEventListener("offline", () => {
  const q = getSyncQueue();
  setStatus(`Offline ${q.length > 0 ? '(' + q.length + ' pendentes)' : '(Modo Local)'}`, "error");
  updateSyncBadge();
});

setupSupportLinks();
checkSession();
