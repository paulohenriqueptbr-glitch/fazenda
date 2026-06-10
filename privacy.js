const privacyConfig = window.CONTROLE_LEITE_CONFIG || {};
const privacySupportWhatsapp = String(privacyConfig.supportWhatsapp || "").replace(/\D/g, "");
const privacySupportEmail = String(privacyConfig.supportEmail || "");
const privacySupportLink = document.querySelector("[data-support-link]");
const privacySupportMessage = encodeURIComponent("Olá, preciso de suporte no Agro+.");

if (privacySupportLink) {
  if (privacySupportWhatsapp) {
    privacySupportLink.href = `https://wa.me/${privacySupportWhatsapp}?text=${privacySupportMessage}`;
    privacySupportLink.target = "_blank";
    privacySupportLink.rel = "noopener noreferrer";
  } else if (privacySupportEmail) {
    privacySupportLink.href = `mailto:${privacySupportEmail}?subject=Suporte Agro+`;
  } else {
    privacySupportLink.textContent = "Configure o WhatsApp de suporte na Vercel";
    privacySupportLink.href = "index.html";
  }
}
