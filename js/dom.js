
const loginScreen = $("#loginScreen");
const appShell = $("#appShell");
const loginForm = $("#loginForm");
const signupForm = $("#signupForm");
const loginError = $("#loginError");
const logoutBtn = $("#logoutBtn");
const userEmailEl = $("#userEmail");
const authSubtitle = $("#authSubtitle");
const authFooter = $("#authFooter");
const showLoginButton = $("#showLoginButton");
const showSignupButton = $("#showSignupButton");
const installPromptModal = $("#installPromptModal");
const installPromptTitle = $("#installPromptTitle");
const installPromptMessage = $("#installPromptMessage");
const installPromptAction = $("#installPromptAction");
const installPromptLater = $("#installPromptLater");
const installPromptClose = $("#installPromptClose");
const iosInstallSteps = $("#iosInstallSteps");
let deferredInstallPrompt = null;

const el = {
  appShell,
  syncStatus: $("#syncStatus"),
  todayTotal: $("#todayTotal"),
  todayValue: $("#todayValue"),
  monthTotal: $("#monthTotal"),
  monthValue: $("#monthValue"),
  animalTotal: $("#animalTotal"),
  lactatingTotal: $("#lactatingTotal"),
  priceQuoteDisplay: $("#priceQuoteDisplay"),
  historyList: $("#historyList"),
  animalList: $("#animalList"),
  lactationList: $("#lactationList"),
  breedingList: $("#breedingList"),
  medicationList: $("#medicationList"),
  cropEventList: $("#cropEventList"),
  stockList: $("#stockList"),
  alertList: $("#alertList"),
  milkForm: $("#milkForm"),
  milkDate: $("#milkDate"),
  animalForm: $("#animalForm"),
  lactationForm: $("#lactationForm"),
  breedingForm: $("#breedingForm"),
  medicationForm: $("#medicationForm"),
  cropForm: $("#cropForm"),
  stockForm: $("#stockForm"),
  reminderForm: $("#reminderForm"),
  reminderDate: $("#reminderDate"),
  weatherForm: $("#weatherForm"),
  weatherCity: $("#weatherCity"),
  weatherForecast: $("#weatherForecast"),
  alertOverdueTotal: $("#alertOverdueTotal"),
  alertTodayTotal: $("#alertTodayTotal"),
  alertWeekTotal: $("#alertWeekTotal"),
  alertOpenTotal: $("#alertOpenTotal"),
  priceQuoteForm: $("#priceQuoteForm"),
  priceQuoteInput: $("#priceQuoteInput"),
  priceQuoteValue: $("#priceQuoteValue"),
  clientProfileForm: $("#clientProfileForm"),
  farmNameInput: $("#farmNameInput"),
  ownerNameInput: $("#ownerNameInput"),
  clientWhatsappInput: $("#clientWhatsappInput"),
  subscriptionStatusInput: $("#subscriptionStatusInput"),
  subscriptionDueDateInput: $("#subscriptionDueDateInput"),
  clientSummary: $("#clientSummary"),
  planPriceValue: $("#planPriceValue"),
  trialDaysValue: $("#trialDaysValue"),
  pixKeyValue: $("#pixKeyValue"),
  copyPixButton: $("#copyPixButton"),
  subscribeButton: $("#subscribeButton"),
  onboardingModal: $("#onboardingModal"),
  onboardingForm: $("#onboardingForm"),
  skipOnboardingButton: $("#skipOnboardingButton"),
  refreshButton: $("#refreshButton"),
  exportDataButton: $("#exportDataButton"),
  printReportButton: $("#printReportButton"),
  reportMonthTotal: $("#reportMonthTotal"),
  reportMonthValue: $("#reportMonthValue"),
  reportAverage: $("#reportAverage"),
  reportBestDay: $("#reportBestDay"),
  reportDetails: $("#reportDetails"),
  productionChart: $("#productionChart"),
};

const actionButtons = (type, id) => `
  <div class="item-actions">
    <button type="button" data-action="edit" data-type="${type}" data-id="${escapeHtml(id)}">Editar</button>
    <button type="button" data-action="delete" data-type="${type}" data-id="${escapeHtml(id)}">Excluir</button>
  </div>
`;

const recordActions = (type, record) => (record.id ? actionButtons(type, record.id) : "");

const reminderActions = (record) => {
  if (!record.id) return "";
  const actionLabel = record.done ? "Reabrir" : "Concluir";
  return `
    <div class="item-actions">
      <button type="button" data-action="toggle-reminder" data-type="reminder" data-id="${escapeHtml(record.id)}">${actionLabel}</button>
      <button type="button" data-action="edit" data-type="reminder" data-id="${escapeHtml(record.id)}">Editar</button>
      <button type="button" data-action="delete" data-type="reminder" data-id="${escapeHtml(record.id)}">Excluir</button>
    </div>
  `;
};