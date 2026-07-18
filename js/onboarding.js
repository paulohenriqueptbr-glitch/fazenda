import { $, state, currentUserId, todayIso, writeLocal } from "./state.js";
import { validateNumber, isValidDate, isNotFutureDate, showToast } from "./ui.js";
import { saveClientProfile, savePriceQuote, insertAnimal, upsertMilk } from "./crud.js";
import { el, render, populateCowSelects } from "./render.js";

export const hideOnboarding = () => {
  if (el.onboardingModal) el.onboardingModal.classList.add("hidden");
};

export const maybeShowOnboarding = () => {
  if (!el.onboardingModal || !currentUserId) return;
  const profile = state.clientProfile;
  if (profile?.onboardingDone) { hideOnboarding(); return; }
  el.onboardingModal.classList.remove("hidden");
  const farmInput = $("#onboardingFarmName");
  const ownerInput = $("#onboardingOwnerName");
  const whatsappInput = $("#onboardingWhatsapp");
  const priceInput = $("#onboardingPrice");
  const dateInput = $("#onboardingFirstDate");
  if (farmInput) farmInput.value = profile?.farmName || "";
  if (ownerInput) ownerInput.value = profile?.ownerName || "";
  if (whatsappInput) whatsappInput.value = profile?.whatsapp || "";
  if (priceInput) priceInput.value = state.priceQuote ? String(state.priceQuote) : "";
  if (dateInput && !dateInput.value) dateInput.value = todayIso();
};

export const completeOnboarding = async (skip = false) => {
  const profile = state.clientProfile || {};
  const formData = el.onboardingForm ? new FormData(el.onboardingForm) : new FormData();
  const nextProfile = {
    ...profile, farmName: String(formData.get("farmName") || profile.farmName || "").trim(),
    ownerName: String(formData.get("ownerName") || profile.ownerName || "").trim(),
    whatsapp: String(formData.get("whatsapp") || profile.whatsapp || "").trim(), onboardingDone: true,
  };
  if (!skip) {
    const price = validateNumber(formData.get("price") || "0", 0, 100);
    const firstAnimal = String(formData.get("firstAnimal") || "").trim();
    const firstLitersRaw = formData.get("firstLiters");
    const firstLiters = firstLitersRaw ? validateNumber(firstLitersRaw, 0, 1000) : null;
    const firstDate = String(formData.get("firstDate") || todayIso());
    if (!nextProfile.farmName) throw new Error("Informe o nome da fazenda.");
    if (price === null) throw new Error("Preço do litro inválido.");
    if (!isValidDate(firstDate) || !isNotFutureDate(firstDate)) throw new Error("Data da primeira produção inválida.");
    await savePriceQuote(price);
    if (firstAnimal) await insertAnimal({ identification: firstAnimal, type: "Bovino de Leite", status: "Em lactação", user_id: currentUserId });
    if (firstLiters !== null) await upsertMilk({ date: firstDate, liters: firstLiters, user_id: currentUserId });
  }
  await saveClientProfile(nextProfile);
  writeLocal();
  hideOnboarding();
  populateCowSelects();
  render();
  showToast(skip ? "Onboarding pulado. Você pode configurar depois." : "Primeira configuração concluída!");
};
