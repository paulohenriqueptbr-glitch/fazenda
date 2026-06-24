
const checkSession = async () => {
  if (!hasSupabase || !db) {
    showLogin();
    showLoginError(supabaseUnavailableMessage(), canUseLocalAccountWithPassword ? "success" : "error");
    return;
  }

  try {
    const {
      data: { session },
    } = await db.auth.getSession();

    if (session?.user) {
      currentUserId = session.user.id;
      showApp(session.user.email);
      initApp();
    } else {
      showLogin();
      if (!navigator.onLine) {
        showLoginError("Sem internet. Entre uma vez online antes de usar offline.");
      }
    }
  } catch (error) {
    console.error("Session check error:", error);
    showLogin();
  }
};

showLoginButton.addEventListener("click", () => setAuthMode("login"));
showSignupButton.addEventListener("click", () => setAuthMode("signup"));

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.classList.remove("visible", "success");

  const email = $("#loginEmail").value.trim();
  const password = $("#loginPassword").value;

  // Login local: validação feita no servidor via /api/local-login
  if (canUseLocalAccountWithPassword && email.toLowerCase() === "admin") {
    try {
      const res = await fetch("/api/local-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: email.toLowerCase(), password }),
      });
      const json = await res.json();
      if (json.ok) {
        failedLoginAttempts = 0;
        currentUserId = "local-admin";
        saveLoginEmail(email);
        showApp("admin local");
        initApp();
        showToast("Modo local ativo.");
        return;
      }
      failedLoginAttempts += 1;
      showLoginError(json.message || "Usuário ou senha incorretos.");
      return;
    } catch (error) {
      console.error("Erro no fetch de login local:", error);
      showLoginError("Não foi possível conectar ao servidor local. Verifique se o servidor está rodando.");
      return;
    }
  }

  if (failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
    showLoginError("Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.");
    return;
  }

  if (!hasSupabase || !db) {
    showLoginError(supabaseUnavailableMessage());
    return;
  }

  if (!navigator.onLine) {
    showLoginError("Sem internet. Conecte para fazer login.");
    return;
  }

  try {
    const { data, error } = await db.auth.signInWithPassword({ email, password });

    if (error) {
      failedLoginAttempts += 1;
      await delay(Math.min(failedLoginAttempts * 2000, 30000));
      const message =
        error.message === "Invalid login credentials"
          ? `E-mail ou senha incorretos. Tentativa ${failedLoginAttempts}/${MAX_LOGIN_ATTEMPTS}.`
          : supabaseErrorMessage(error);
      showLoginError(message);
      return;
    }

    failedLoginAttempts = 0;
    currentUserId = data.user.id;
    saveLoginEmail(data.user.email || email);
    showApp(data.user.email);
    initApp();
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
    showLoginError(
      canUseLocalAccount
        ? "No modo local não é possível criar contas. Use o login de administrador."
        : supabaseUnavailableMessage()
    );
    return;
  }

  if (!navigator.onLine) {
    showLoginError("Sem internet. Conecte para criar uma conta.");
    return;
  }

  if (password.length < 6) {
    showLoginError("Use uma senha com pelo menos 6 caracteres.");
    return;
  }

  if (password !== passwordConfirm) {
    showLoginError("As senhas não conferem.");
    return;
  }

  if (!$("#signupPrivacyConsent").checked) {
    showLoginError("Aceite a política de privacidade para criar a conta.");
    return;
  }

  try {
    submitButton.disabled = true;
    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
      },
    });

    if (error) {
      showLoginError(authErrorMessage(error));
      return;
    }

    signupForm.reset();

    if (data.session?.user) {
      failedLoginAttempts = 0;
      currentUserId = data.session.user.id;
      saveLoginEmail(data.session.user.email || email);
      showApp(data.session.user.email);
      initApp();
      scheduleInstallPromptAfterSignup();
      return;
    }

    setAuthMode("login");
    $("#loginEmail").value = email;
    showLoginError("Conta criada. Confira seu e-mail para confirmar o cadastro.", "success");
    scheduleInstallPromptAfterSignup();
  } catch (error) {
    showLoginError("Erro ao criar conta. Tente novamente.");
    console.error(error);
  } finally {
    submitButton.disabled = false;
  }
});

logoutBtn.addEventListener("click", async () => {
  if (hasSupabase && db) {
    await db.auth.signOut();
  }

  currentUserId = null;
  showLogin();
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  hideInstallPrompt();
  showToast("Terrasyn instalado com sucesso.");
});

installPromptAction?.addEventListener("click", async () => {
  if (isIosDevice() || !deferredInstallPrompt) {
    hideInstallPrompt();
    return;
  }

  const promptEvent = deferredInstallPrompt;
  deferredInstallPrompt = null;
  hideInstallPrompt();
  await promptEvent.prompt();
});

installPromptLater?.addEventListener("click", hideInstallPrompt);
installPromptClose?.addEventListener("click", hideInstallPrompt);
installPromptModal?.addEventListener("click", (event) => {
  if (event.target === installPromptModal) hideInstallPrompt();
});

// ─── Push Notifications ───────────────────────────────────────────────────────