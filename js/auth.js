import {
  $, config, hasSupabase, db, canUseLocalAccount, canUseLocalAccountWithPassword,
  supabaseUnavailableMessage, currentUserId, setCurrentUserId,
  failedLoginAttempts, incrementFailedLoginAttempts, resetFailedLoginAttempts,
  SAVED_LOGIN_EMAIL_KEY, MAX_LOGIN_ATTEMPTS, todayIso, userStorageKey,
  state, normalizeClientProfile, normalizeSubscription,
  readLocal, loadLocal, writeLocal,
} from "./state.js";
import { showToast } from "./ui.js";

// ─── Elementos DOM ──────────────────────────────────────────────────────────
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

// ─── UI de autenticação ─────────────────────────────────────────────────────
export const showApp = (email) => {
  loginScreen.classList.add("hidden");
  appShell.classList.add("visible");
  if (userEmailEl) userEmailEl.textContent = email || "";
};

export const showLogin = (mode = "login") => {
  loginScreen.classList.remove("hidden");
  appShell.classList.remove("visible");
  setAuthMode(mode);
  restoreLoginEmail();
};

const showLoginError = (message, type = "error") => {
  loginError.textContent = message;
  loginError.classList.toggle("success", type === "success");
  loginError.classList.add("visible");
};

const setAuthMode = (mode) => {
  const isSignup = mode === "signup";
  loginForm.classList.toggle("hidden", isSignup);
  signupForm.classList.toggle("hidden", !isSignup);
  showLoginButton.classList.toggle("active", !isSignup);
  showSignupButton.classList.toggle("active", isSignup);
  if (authSubtitle) authSubtitle.textContent = isSignup ? "Crie sua conta para acessar o sistema" : "Faça login para acessar o sistema";
  if (authFooter) authFooter.textContent = isSignup ? "O acesso é protegido por e-mail e senha" : "Acesso restrito ao administrador da fazenda";
  loginError.classList.remove("visible", "success");
};

// ─── Email salvo ────────────────────────────────────────────────────────────
export const saveLoginEmail = (email) => {
  const value = String(email || "").trim();
  if (!value) return;
  try { localStorage.setItem(SAVED_LOGIN_EMAIL_KEY, value); } catch { /* noop */ }
};

const restoreLoginEmail = () => {
  const input = $("#loginEmail");
  if (!input || input.value) return;
  try { input.value = localStorage.getItem(SAVED_LOGIN_EMAIL_KEY) || ""; } catch { /* noop */ }
};

// ─── Erros ──────────────────────────────────────────────────────────────────
export const supabaseErrorMessage = (error) => {
  const raw = String(error?.message || error?.code || error || "").toLowerCase();
  if (raw.includes("jwt") || raw.includes("session")) return "Sua sessão expirou. Faça login novamente.";
  if (raw.includes("network") || raw.includes("fetch") || raw.includes("failed to fetch")) return "Sem conexão com o servidor. Os dados ficarão salvos para sincronizar.";
  if (raw.includes("row-level security") || raw.includes("permission denied") || raw.includes("42501")) return "Acesso negado pelo Supabase. Confira seu login e as políticas RLS.";
  if (raw.includes("429") || raw.includes("rate limit")) return "Muitas tentativas. Aguarde um momento e tente novamente.";
  if (raw.includes("violates check constraint") || raw.includes("23514")) return "Dados inválidos. Confira os valores informados.";
  if (raw.includes("duplicate key") || raw.includes("23505")) return "Já existe um registro com essas informações.";
  return "Erro ao comunicar com o servidor. Tente novamente.";
};

export const authErrorMessage = (error) => {
  const raw = String(error?.message || error?.code || error || "").toLowerCase();
  if (raw.includes("already registered") || raw.includes("already exists")) return "Este e-mail já está cadastrado.";
  if (raw.includes("password") && (raw.includes("6") || raw.includes("short"))) return "Use uma senha com pelo menos 6 caracteres.";
  if (raw.includes("invalid email")) return "Informe um e-mail válido.";
  return supabaseErrorMessage(error);
};

export const handleSupabaseError = (error, context = "") => {
  console.error(`Erro Supabase${context ? ` [${context}]` : ""}:`, error);
  const message = supabaseErrorMessage(error);
  showToast(message, "error");
  return message;
};

// ─── Sessão ─────────────────────────────────────────────────────────────────
export const requireSession = async () => {
  if (!hasSupabase || !db) return null;
  const { data: { session }, error } = await db.auth.getSession();
  if (error) throw error;
  if (!session?.user) {
    setCurrentUserId(null);
    showLogin();
    const err = new Error("Sua sessão expirou. Faça login novamente.");
    err.authRequired = true;
    throw err;
  }
  setCurrentUserId(session.user.id);
  return session;
};

export const isMissingOptionalTable = (error, table) =>
  Boolean(error) && ["crop_events", "reminders", "stock_items"].includes(table) &&
  (["42P01", "PGRST205"].includes(error.code) || String(error.message || "").toLowerCase().includes(table));

// ─── Check session ──────────────────────────────────────────────────────────
export const checkSession = async (initAppFn) => {
  if (!hasSupabase || !db) {
    showLogin();
    showLoginError(supabaseUnavailableMessage(), canUseLocalAccountWithPassword ? "success" : "error");
    return;
  }
  try {
    const { data: { session } } = await db.auth.getSession();
    if (session?.user) {
      setCurrentUserId(session.user.id);
      showApp(session.user.email);
      initAppFn();
    } else {
      showLogin();
      if (!navigator.onLine) showLoginError("Sem internet. Entre uma vez online antes de usar offline.");
    }
  } catch (error) {
    console.error("Session check error:", error);
    showLogin();
  }
};

// ─── Auth state change ──────────────────────────────────────────────────────
export const setupAuthStateListener = (initAppFn) => {
  if (!hasSupabase || !db) return;
  db.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || !session?.user) {
      setCurrentUserId(null);
      showLogin();
      return;
    }
    setCurrentUserId(session.user.id);
    showApp(session.user.email);
    initAppFn();
  });
};

// ─── Event listeners de login/signup/logout ─────────────────────────────────
export const setupAuthListeners = (initAppFn) => {
  showLoginButton.addEventListener("click", () => setAuthMode("login"));
  showSignupButton.addEventListener("click", () => setAuthMode("signup"));

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginError.classList.remove("visible", "success");
    const email = $("#loginEmail").value.trim();
    const password = $("#loginPassword").value;

    if (canUseLocalAccountWithPassword && email.toLowerCase() === "admin") {
      try {
        const res = await fetch("/api/local-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: email.toLowerCase(), password }),
        });
        const json = await res.json();
        if (json.ok) {
          resetFailedLoginAttempts();
          setCurrentUserId("local-admin");
          saveLoginEmail(email);
          showApp("admin local");
          initAppFn();
          showToast("Modo local ativo.");
          return;
        }
        incrementFailedLoginAttempts();
        showLoginError(json.message || "Usuário ou senha incorretos.");
        return;
      } catch { showLoginError("Erro ao verificar credenciais locais."); return; }
    }

    if (failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
      showLoginError("Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.");
      return;
    }
    if (!hasSupabase || !db) { showLoginError(supabaseUnavailableMessage()); return; }
    if (!navigator.onLine) { showLoginError("Sem internet. Conecte para fazer login."); return; }

    try {
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error) {
        incrementFailedLoginAttempts();
        const { delay } = await import("./state.js");
        await delay(Math.min(failedLoginAttempts * 2000, 30000));
        const message = error.message === "Invalid login credentials"
          ? `E-mail ou senha incorretos. Tentativa ${failedLoginAttempts}/${MAX_LOGIN_ATTEMPTS}.`
          : supabaseErrorMessage(error);
        showLoginError(message);
        return;
      }
      resetFailedLoginAttempts();
      setCurrentUserId(data.user.id);
      saveLoginEmail(data.user.email || email);
      showApp(data.user.email);
      initAppFn();
    } catch (error) {
      showLoginError("Erro ao conectar. Tente novamente.");
      console.error(error);
    }
  });

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginError.classList.remove("visible", "success");
    const name = $("#signupName").value.trim();
    const email = $("#signupEmail").value.trim();
    const password = $("#signupPassword").value;
    const passwordConfirm = $("#signupPasswordConfirm").value;
    const submitButton = signupForm.querySelector('button[type="submit"]');

    if (!hasSupabase || !db) {
      showLoginError(canUseLocalAccount ? "No modo local não é possível criar contas. Use o login de administrador." : supabaseUnavailableMessage());
      return;
    }
    if (!navigator.onLine) { showLoginError("Sem internet. Conecte para criar uma conta."); return; }
    if (password.length < 6) { showLoginError("Use uma senha com pelo menos 6 caracteres."); return; }
    if (password !== passwordConfirm) { showLoginError("As senhas não conferem."); return; }
    if (!$("#signupPrivacyConsent").checked) { showLoginError("Aceite a política de privacidade para criar a conta."); return; }

    try {
      submitButton.disabled = true;
      const { data, error } = await db.auth.signUp({ email, password, options: { data: { full_name: name } } });
      if (error) { showLoginError(authErrorMessage(error)); return; }
      signupForm.reset();
      if (data.session?.user) {
        resetFailedLoginAttempts();
        setCurrentUserId(data.session.user.id);
        saveLoginEmail(data.session.user.email || email);
        showApp(data.session.user.email);
        initAppFn();
        return;
      }
      setAuthMode("login");
      saveLoginEmail(email);
      restoreLoginEmail();
      showLoginError("Conta criada. Confira seu e-mail para confirmar o cadastro.", "success");
    } catch (error) {
      showLoginError("Erro ao criar conta. Tente novamente.");
      console.error(error);
    } finally { submitButton.disabled = false; }
  });

  logoutBtn.addEventListener("click", async () => {
    if (hasSupabase && db) await db.auth.signOut();
    setCurrentUserId(null);
    showLogin();
  });
};
