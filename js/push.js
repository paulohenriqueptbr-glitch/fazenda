// ─── Push Notifications ─────────────────────────────────────────────────────
// Módulo responsável por notificações push e alertas do service worker

import {
  config, hasSupabase, db, state, todayIso, addDaysIso, userStorageKey,
} from "./state.js";
import { getMedicationInterval } from "./alerts.js";
import { warn } from "./logger.js";

const VAPID_PUBLIC_KEY = config.vapidPublicKey || "";

export const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export const savePushSubscription = async (subscription, remove = false) => {
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
  } catch (err) { warn("push-subscription:", err); }
};

export const initPushNotifications = async () => {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !VAPID_PUBLIC_KEY) return;
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) { await savePushSubscription(existing); return; }
  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") return;
  try {
    const subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
    await savePushSubscription(subscription);
  } catch (err) { warn("Erro ao inscrever notificações push:", err); }
};

const formatDatePush = (isoDate) => {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
};

export const checkPushAlerts = async () => {
  if (!("serviceWorker" in navigator) || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker.ready;
  const today = todayIso();
  const in7days = addDaysIso(today, 7);
  const alerts = [];

  for (const b of state.breeding) {
    if (!b.expected_calving_date) continue;
    if (b.expected_calving_date >= today && b.expected_calving_date <= in7days) {
      const animal = state.animals.find((a) => a.id === b.cow_id);
      const name = animal?.identification || b.cow_id || "Animal";
      const diff = Math.round((new Date(b.expected_calving_date) - new Date(today)) / 86400000);
      alerts.push({ title: "Parto Previsto", body: diff === 0 ? `${name} está com parto previsto para hoje!` : `${name} tem parto previsto em ${diff} dia${diff > 1 ? "s" : ""}.`, tag: `calving-${b.id}`, url: "/?tab=breeding" });
    }
  }

  for (const m of state.medication) {
    if (!m.administration_date) continue;
    const interval = getMedicationInterval(m.medication_name, m.reapply_interval_days);
    const nextDate = addDaysIso(m.administration_date, interval.days);

    const todayDate = new Date(today);
    const nextDateObj = new Date(nextDate);
    const diffMs = nextDateObj - todayDate;
    const diffDaysCalc = Math.round(diffMs / 86400000);

    const notifyDays = [3, 1, 0, -1];
    if (!notifyDays.includes(diffDaysCalc)) continue;

    const animal = state.animals.find((a) => String(a.id) === String(m.cow_id));
    const name = animal?.identification || m.cow_id || "Animal";

    let title, body;
    if (diffDaysCalc === 3) {
      title = `📋 Reaplicar ${m.medication_name || "medicação"} em 3 dias`;
      body = `${name}: reaplicar em ${diffDaysCalc} dias. Intervalo: ${interval.days} dias. Última aplicação: ${formatDatePush(m.administration_date)}.`;
    } else if (diffDaysCalc === 1) {
      title = `⏰ Amanhã: reaplicar ${m.medication_name || "medicação"}`;
      body = `${name}: reaplicar AMANHÃ. Intervalo: ${interval.days} dias.`;
    } else if (diffDaysCalc === 0) {
      title = `🔴 HOJE: reaplicar ${m.medication_name || "medicação"}`;
      body = `${name}: hoje é o dia de reaplicar! Intervalo: ${interval.days} dias.`;
    } else if (diffDaysCalc === -1) {
      title = `⚠️ Reaplicar ${m.medication_name || "medicação"} — 1 dia atrasado`;
      body = `${name}: reaplicação atrasada em 1 dia! Intervalo: ${interval.days} dias.`;
    }

    alerts.push({
      title,
      body,
      tag: `med-reapply-${m.id}-${nextDate}-${diffDaysCalc}`,
      url: "/?tab=medication"
    });
  }

  const hour = new Date().getHours();
  const todayRegistered = state.milk.some((r) => r.date === today);
  if (!todayRegistered && hour >= 8) alerts.push({ title: "Produção Pendente", body: "Você ainda não registrou a produção de leite de hoje.", tag: "milk-pending", url: "/?tab=milk" });

  const shownKey = userStorageKey("push_shown_tags");
  let shown = [];
  try { shown = JSON.parse(localStorage.getItem(shownKey) || "[]"); } catch { shown = []; }

  for (const alert of alerts) {
    if (shown.includes(alert.tag)) continue;
    reg.showNotification(alert.title, { body: alert.body, icon: "./icons/icon-192.png", badge: "./icons/icon-192.png", tag: alert.tag, data: { url: alert.url } });
    shown.push(alert.tag);
  }

  try { localStorage.setItem(shownKey, JSON.stringify(shown.slice(-50))); } catch { /* noop */ }
};

export default {
  initPushNotifications,
  checkPushAlerts,
  savePushSubscription,
};
