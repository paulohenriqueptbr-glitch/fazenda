
const subscriptionLabels = {
  trial: "Teste",
  active: "Ativa",
  overdue: "Vencida",
  blocked: "Bloqueada",
  canceled: "Cancelada",
};

const daysUntil = (isoDate) => {
  if (!isoDate || !isValidDate(isoDate)) return null;
  const today = new Date(todayIso() + "T00:00:00");
  const dueDate = new Date(isoDate + "T00:00:00");
  return Math.ceil((dueDate - today) / (24 * 60 * 60 * 1000));
};

const subscriptionMessage = (profile) => {
  const days = daysUntil(profile.subscriptionDueDate);
  const label = subscriptionLabels[profile.subscriptionStatus] || "Indefinida";

  if (profile.subscriptionStatus === "blocked") return "Acesso bloqueado. Fale com o suporte para regularizar.";
  if (profile.subscriptionStatus === "overdue") return "Assinatura vencida. Regularize para manter o acesso.";
  if (days === null) return `${label}. Vencimento ainda não definido.`;
  if (days < 0) return `${label}. Venceu em ${formatDate(profile.subscriptionDueDate)}.`;
  if (days === 0) return `${label}. Vence hoje.`;
  return `${label}. Vence em ${days} dia${days === 1 ? "" : "s"}.`;
};

const applySubscriptionAccess = (profile) => {
  const blocked = ["blocked", "canceled"].includes(profile.subscriptionStatus);
  document.body.classList.toggle("subscription-blocked", blocked);
  document
    .querySelectorAll("#milkForm input, #milkForm button, #animalForm input, #animalForm select, #animalForm button, #lactationForm input, #lactationForm select, #lactationForm button, #breedingForm input, #breedingForm select, #breedingForm button, #medicationForm input, #medicationForm select, #medicationForm button, #cropForm input, #cropForm select, #cropForm textarea, #cropForm button, #stockForm input, #stockForm select, #stockForm textarea, #stockForm button, #reminderForm input, #reminderForm select, #reminderForm textarea, #reminderForm button")
    .forEach((control) => {
      control.disabled = blocked;
    });
};

const renderClientPanel = () => {
  const profile = normalizeClientProfile(state.clientProfile);
  const subscription = normalizeSubscription(state.subscription);
  const displayProfile = { ...profile, ...subscription };
  state.clientProfile = profile;
  state.subscription = subscription;
  applySubscriptionAccess(displayProfile);

  if (el.farmNameInput) el.farmNameInput.value = profile.farmName || "";
  if (el.ownerNameInput) el.ownerNameInput.value = profile.ownerName || "";
  if (el.clientWhatsappInput) el.clientWhatsappInput.value = profile.whatsapp || "";
  if (el.subscriptionStatusInput) el.subscriptionStatusInput.value = displayProfile.subscriptionStatus || "trial";
  if (el.subscriptionDueDateInput) el.subscriptionDueDateInput.value = displayProfile.subscriptionDueDate || "";
  if (el.planPriceValue) el.planPriceValue.textContent = `${formatMoney(planPrice)}/mês`;
  if (el.trialDaysValue) el.trialDaysValue.textContent = `${trialDays} dias grátis`;
  if (el.pixKeyValue) el.pixKeyValue.textContent = "Solicite a chave pelo WhatsApp";
  if (el.copyPixButton) el.copyPixButton.disabled = false;
  if (el.subscribeButton) {
    el.subscribeButton.setAttribute("href", subscribeUrl());
    if (subscribeUrl().startsWith("https://")) {
      el.subscribeButton.setAttribute("target", "_blank");
      el.subscribeButton.setAttribute("rel", "noopener noreferrer");
    }
  }

  if (el.clientSummary) {
    const label = subscriptionLabels[displayProfile.subscriptionStatus] || "Indefinida";
    el.clientSummary.innerHTML = `
      <article>
        <span>Fazenda</span>
        <strong>${escapeHtml(profile.farmName || "Não informada")}</strong>
      </article>
      <article>
        <span>Responsável</span>
        <strong>${escapeHtml(profile.ownerName || "Não informado")}</strong>
      </article>
      <article>
        <span>Assinatura</span>
        <strong class="subscription-pill ${escapeHtml(displayProfile.subscriptionStatus || "trial")}">${escapeHtml(label)}</strong>
      </article>
      <article>
        <span>Vencimento</span>
        <strong>${escapeHtml(displayProfile.subscriptionDueDate ? formatDate(displayProfile.subscriptionDueDate) : "A definir")}</strong>
      </article>
      <p>${escapeHtml(subscriptionMessage(displayProfile))}</p>
    `;
  }
};
