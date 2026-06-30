import {
  $, config, hasSupabase, db, canUseLocalAccount, canUseLocalAccountWithPassword,
  supabaseUnavailableMessage, currentUserId, setCurrentUserId,
  SAVED_LOGIN_EMAIL_KEY, MAX_LOGIN_ATTEMPTS, todayIso, userStorageKey,
  state, normalizeClientProfile, normalizeSubscription,
  readLocal, loadLocal, writeLocal,
} from "./state.js";
import { showToast } from "./ui.js";
import { error } from "./logger.js";

// ─── Local Auth Helpers ───────────────────────────────────────────────────
const LOCAL_ADMIN_HASH_KEY = "local-admin-hash";
const LOCAL_ADMIN_SALT_KEY = "local-admin-salt";
const LOCAL_ADMIN_EMAIL_KEY = "local-admin-email";
const LOCAL_ADMIN_ATTEMPTS_KEY = "local-admin-attempts";
const LOCAL_ADMIN_LOCKOUT_KEY = "local-admin-lockout";
const DEFAULT_LOCAL_PASSWORD = "admin123";
const PBKDF2_ITERATIONS = 100000;

const generateSalt = () => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(salt).map((b) => b.toString(16).padStart(2, "0")).join("");
};

const hashPassword = async (password, salt) => {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const saltBytes = encoder.encode(salt);
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial, 256
  );
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

const getStoredAttempts = () => {
  try {
    const data = JSON.parse(localStorage.getItem(LOCAL_ADMIN_ATTEMPTS_KEY) || "{}");
    const lockout = parseInt(localStorage.getItem(LOCAL_ADMIN_LOCKOUT_KEY) || "0", 10);
    if (lockout && Date.now() > lockout) {
      localStorage.removeItem(LOCAL_ADMIN_ATTEMPTS_KEY);
      localStorage.removeItem(LOCAL_ADMIN_LOCKOUT_KEY);
      return { count: 0, lockoutUntil: 0 };
    }
    return { count: data.count || 0, lockoutUntil: lockout || 0 };
  } catch { return { count: 0, lockoutUntil: 0 }; }
};

const recordFailedAttempt = () => {
  const { count } = getStoredAttempts();
  const newCount = count + 1;
  localStorage.setItem(LOCAL_ADMIN_ATTEMPTS_KEY, JSON.stringify({ count: newCount }));
  if (newCount >= MAX_LOGIN_ATTEMPTS) {
    localStorage.setItem(LOCAL_ADMIN_LOCKOUT_KEY, String(Date.now() + 15 * 60 * 1000));
  }
};

const clearAttempts = () => {
  localStorage.removeItem(LOCAL_ADMIN_ATTEMPTS_KEY);
  localStorage.removeItem(LOCAL_ADMIN_LOCKOUT_KEY);
};

const loginLocal = async (email, password) => {
  const storedHash = localStorage.getItem(LOCAL_ADMIN_HASH_KEY);
  const storedSalt = localStorage.getItem(LOCAL_ADMIN_SALT_KEY);

  // Check lockout
  const { count: attemptCount, lockoutUntil } = getStoredAttempts();
  if (lockoutUntil && Date.now() < lockoutUntil) {
    const minutes = Math.ceil((lockoutUntil - Date.now()) / 60000);
    throw new Error(`Conta bloqueada. Tente novamente em ${minutes} minuto(s).`);
  }
  if (attemptCount >= MAX_LOGIN_ATTEMPTS) {
    throw new Error("Muitas tentativas. Aguarde 15 minutos.");
  }

  // If no hash stored yet, create one with default password
  if (!storedHash) {
    // First login: hash default password with new salt and store
    const salt = generateSalt();
    const defaultHash = await hashPassword(DEFAULT_LOCAL_PASSWORD, salt);
    localStorage.setItem(LOCAL_ADMIN_HASH_KEY, defaultHash);
    localStorage.setItem(LOCAL_ADMIN_SALT_KEY, salt);
    if (password !== DEFAULT_LOCAL_PASSWORD) {
      recordFailedAttempt();
      throw new Error("Senha inválida");
    }
  } else {
    const salt = storedSalt || generateSalt();
    // If no salt stored, re-hash with new salt on next successful login
    const inputHash = await hashPassword(password, salt);
    if (inputHash !== storedHash) {
      recordFailedAttempt();
      throw new Error("Senha inválida");
    }
    // Migrate: if no salt was stored, save it now
    if (!storedSalt) {
      localStorage.setItem(LOCAL_ADMIN_SALT_KEY, salt);
    }
  }

  clearAttempts();
  localStorage.setItem(LOCAL_ADMIN_EMAIL_KEY, email);
  return { email };
};

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
  const checkbox = $("#rememberLoginEmail");
  if (checkbox && !checkbox.checked) {
    // If checkbox not checked, don't restore (but still allow manual entry)
    return;
  }
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

export const handleSupabaseError = (err, context = "") => {
  error(`Erro Supabase${context ? ` [${context}]` : ""}:`, err);
  const message = supabaseErrorMessage(err);
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

// ─── Check session ──────────────────────────────────────────────────────────
export const checkSession = async (initAppFn) => {
  if (!hasSupabase || !db) {
    // No Supabase — try local mode
    const savedEmail = localStorage.getItem(LOCAL_ADMIN_EMAIL_KEY) || localStorage.getItem(SAVED_LOGIN_EMAIL_KEY);
    if (canUseLocalAccountWithPassword || canUseLocalAccount) {
      if (savedEmail) {
        // Allow offline use with local data
        setCurrentUserId("local-admin");
        showApp(savedEmail);
        initAppFn();
        if (!navigator.onLine) showToast("Offline - dados locais", "error");
        return;
      }
    }
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
      // No Supabase session — check if offline with saved local email
      if (!navigator.onLine) {
        const savedEmail = localStorage.getItem(LOCAL_ADMIN_EMAIL_KEY) || localStorage.getItem(SAVED_LOGIN_EMAIL_KEY);
        if (savedEmail) {
          setCurrentUserId("local-admin");
          showApp(savedEmail);
          initAppFn();
          showToast("Offline - dados locais", "error");
          return;
        }
        showLogin();
        showLoginError("Sem internet. Conecte-se uma vez online para usar o app.");
        return;
      }
      showLogin();
    }
  } catch (err) {
    error("Session check error:", err);
    // Offline fallback — check for saved local email
    if (!navigator.onLine) {
      const savedEmail = localStorage.getItem(LOCAL_ADMIN_EMAIL_KEY) || localStorage.getItem(SAVED_LOGIN_EMAIL_KEY);
      if (savedEmail) {
        setCurrentUserId("local-admin");
        showApp(savedEmail);
        initAppFn();
        showToast("Offline - dados locais", "error");
        return;
      }
    }
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
        const result = await loginLocal(email.toLowerCase(), password);
        setCurrentUserId("local-admin");
        if ($("#rememberLoginEmail")?.checked) saveLoginEmail(email);
        showApp(result.email || "admin local");
        initAppFn();
        showToast("Modo local ativo.");
        return;
      } catch (err) {
        showLoginError(err.message || "Usuário ou senha incorretos.");
        return;
      }
    }

    // Persistent lockout check for Supabase login
    const { count: attemptCount, lockoutUntil } = getStoredAttempts();
    if (lockoutUntil && Date.now() < lockoutUntil) {
      const minutes = Math.ceil((lockoutUntil - Date.now()) / 60000);
      showLoginError(`Conta bloqueada. Tente novamente em ${minutes} minuto(s).`);
      return;
    }
    if (attemptCount >= MAX_LOGIN_ATTEMPTS) {
      showLoginError("Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.");
      return;
    }
    if (!hasSupabase || !db) { showLoginError(supabaseUnavailableMessage()); return; }
    if (!navigator.onLine) { showLoginError("Sem internet. Conecte para fazer login."); return; }

    try {
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error) {
        recordFailedAttempt();
        const { count: newCount } = getStoredAttempts();
        const { delay } = await import("./state.js");
        await delay(Math.min(newCount * 2000, 30000));
        const message = error.message === "Invalid login credentials"
          ? `E-mail ou senha incorretos. Tentativa ${newCount}/${MAX_LOGIN_ATTEMPTS}.`
          : supabaseErrorMessage(error);
        showLoginError(message);
        return;
      }
      clearAttempts();
      setCurrentUserId(data.user.id);
      if ($("#rememberLoginEmail")?.checked) saveLoginEmail(data.user.email || email);
      showApp(data.user.email);
      initAppFn();
    } catch (err) {
      showLoginError("Erro ao conectar. Tente novamente.");
      error(err);
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
        clearAttempts();
        setCurrentUserId(data.session.user.id);
        saveLoginEmail(data.session.user.email || email);
        showApp(data.session.user.email);
        initAppFn();
        return;
      }
      setAuthMode("login");
      // Always save email on signup for convenience
      saveLoginEmail(email);
      restoreLoginEmail();
      showLoginError("Conta criada. Confira seu e-mail para confirmar o cadastro.", "success");
    } catch (err) {
      showLoginError("Erro ao criar conta. Tente novamente.");
      error(err);
    } finally { submitButton.disabled = false; }
  });

  logoutBtn.addEventListener("click", async () => {
    if (hasSupabase && db) await db.auth.signOut();
    setCurrentUserId(null);
    showLogin();
  });
};
