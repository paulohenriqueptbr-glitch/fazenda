import { supportWhatsapp, supportEmail, planPrice } from "./state.js";
import { formatMoney } from "./ui.js";

export const contactUrl = (message, subject = "Suporte Terrasyn") => {
  const encoded = encodeURIComponent(message);
  if (supportWhatsapp) return `https://wa.me/${supportWhatsapp}?text=${encoded}`;
  if (supportEmail) return `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encoded}`;
  return "privacy.html#contato";
};

export const supportUrl = () => contactUrl("Olá, preciso de suporte no Terrasyn.");

export const subscribeUrl = () => contactUrl(`Olá, quero assinar o Terrasyn. Plano: ${formatMoney(planPrice)}/mês.`, "Assinatura Terrasyn");
