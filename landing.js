const landingConfig = window.CONTROLE_LEITE_CONFIG || {};
const landingWhatsapp = String(landingConfig.supportWhatsapp || "").replace(/\D/g, "");
const landingEmail = String(landingConfig.supportEmail || "");
const landingPlanPrice = Number(landingConfig.planPrice || 39);
const landingTrialDays = Number(landingConfig.trialDays || 14);

const money = (value) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const makeContactUrl = (message, subject = "Controle Fazenda") => {
  const encoded = encodeURIComponent(message);
  if (landingWhatsapp) return `https://wa.me/${landingWhatsapp}?text=${encoded}`;
  if (landingEmail) return `mailto:${landingEmail}?subject=${encodeURIComponent(subject)}&body=${encoded}`;
  return "privacy.html#contato";
};

const setupLandingLinks = () => {
  const subscribeMessage = `Olá, quero assinar o Controle Fazenda. Plano: ${money(landingPlanPrice)}/mês.`;
  const supportMessage = "Olá, preciso de suporte no Controle Fazenda.";

  document.querySelectorAll("[data-subscribe-link]").forEach((link) => {
    const url = makeContactUrl(subscribeMessage, "Assinatura Controle Fazenda");
    link.href = url;
    if (url.startsWith("https://")) {
      link.target = "_blank";
      link.rel = "noopener";
    }
  });

  document.querySelectorAll("[data-support-link]").forEach((link) => {
    const url = makeContactUrl(supportMessage, "Suporte Controle Fazenda");
    link.href = url;
    if (url.startsWith("https://")) {
      link.target = "_blank";
      link.rel = "noopener";
    }
  });
};

const planPriceEl = document.getElementById("landingPlanPrice");
const trialDaysEl = document.getElementById("landingTrialDays");

if (planPriceEl) planPriceEl.textContent = `${money(landingPlanPrice)}/mês`;
if (trialDaysEl) trialDaysEl.textContent = `${landingTrialDays} dias grátis`;

setupLandingLinks();
