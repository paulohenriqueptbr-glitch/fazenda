/* ===== Controle Fazenda — app.js ===== */

const LOCAL_KEY = "controle-leite-data";

const state = {
  milk: [],
  animals: [],
  lactations: [],
  breeding: [],
  medication: [],
  priceQuote: 0,
};

/* --- Supabase setup --- */
const config = window.CONTROLE_LEITE_CONFIG || {};
const hasSupabase = Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase);
const db = hasSupabase
  ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey)
  : null;

/* --- Helpers --- */
const $ = (sel) => document.querySelector(sel);
const todayIso = () => new Date().toISOString().slice(0, 10);
const monthKey = () => todayIso().slice(0, 7);
const localId = () =>
  crypto.randomUUID ? crypto.randomUUID() : String(Date.now());

const formatLiters = (v) =>
  `${Number(v || 0).toLocaleString("pt-BR")} L`;
const formatMoney = (v) =>
  Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const formatDate = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString(
    "pt-BR"
  );
};

const escapeHtml = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    })[c]
  );

/* ===== AUTH (Login / Logout) ===== */
const loginScreen = $("#loginScreen");
const appShell = $("#appShell");
const loginForm = $("#loginForm");
const loginError = $("#loginError");
const logoutBtn = $("#logoutBtn");
const userEmailEl = $("#userEmail");

const showApp = (email) => {
  loginScreen.classList.add("hidden");
  appShell.classList.add("visible");
  if (userEmailEl) userEmailEl.textContent = email || "";
};

const showLogin = () => {
  loginScreen.classList.remove("hidden");
  appShell.classList.remove("visible");
  loginError.classList.remove("visible");
};

const showLoginError = (msg) => {
  loginError.textContent = msg;
  loginError.classList.add("visible");
};

// Check existing session on load
const checkSession = async () => {
  if (!hasSupabase || !db) {
    // No Supabase — skip auth, show app directly
    showApp("Modo local");
    initApp();
    return;
  }

  try {
    const {
      data: { session },
    } = await db.auth.getSession();
    if (session?.user) {
      showApp(session.user.email);
      initApp();
    } else {
      showLogin();
    }
  } catch (err) {
    console.error("Session check error:", err);
    showLogin();
  }
};

// Login form submit
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.classList.remove("visible");

  const email = $("#loginEmail").value.trim();
  const password = $("#loginPassword").value;

  if (!hasSupabase || !db) {
    showApp("Modo local");
    initApp();
    return;
  }

  try {
    const { data, error } = await db.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      showLoginError(error.message === "Invalid login credentials"
        ? "E-mail ou senha incorretos."
        : error.message);
      return;
    }

    showApp(data.user.email);
    initApp();
  } catch (err) {
    showLoginError("Erro ao conectar. Tente novamente.");
    console.error(err);
  }
});

// Logout
logoutBtn.addEventListener("click", async () => {
  if (hasSupabase && db) {
    await db.auth.signOut();
  }
  showLogin();
});

/* ===== DOM refs (inside app) ===== */
const el = {
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
  milkForm: $("#milkForm"),
  milkDate: $("#milkDate"),
  animalForm: $("#animalForm"),
  lactationForm: $("#lactationForm"),
  breedingForm: $("#breedingForm"),
  medicationForm: $("#medicationForm"),
  priceQuoteForm: $("#priceQuoteForm"),
  priceQuoteInput: $("#priceQuoteInput"),
  priceQuoteValue: $("#priceQuoteValue"),
  refreshButton: $("#refreshButton"),
};

/* --- Local storage --- */
const readLocal = () => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) || {};
  } catch {
    return {};
  }
};

const writeLocal = () =>
  localStorage.setItem(LOCAL_KEY, JSON.stringify(state));

/* --- Status badge --- */
const setStatus = (msg, kind = "local") => {
  el.syncStatus.textContent = msg;
  el.syncStatus.dataset.kind = kind;
};

/* --- Data loading --- */
const loadLocal = () => {
  const d = readLocal();
  state.milk = d.milk || [];
  state.animals = d.animals || [];
  state.lactations = d.lactations || [];
  state.breeding = d.breeding || [];
  state.medication = d.medication || [];
  state.priceQuote = d.priceQuote || 0;
  setStatus("Local", "local");
};

const loadSupabase = async () => {
  setStatus("Sincronizando…", "syncing");

  const [milkR, animalR, lactR, breedR, medR] = await Promise.all([
    db.from("milk_records").select("*").order("date", { ascending: false }),
    db
      .from("animals")
      .select("*")
      .order("created_at", { ascending: false }),
    db
      .from("lactation_records")
      .select("*")
      .order("start_date", { ascending: false }),
    db
      .from("breeding_records")
      .select("*")
      .order("insemination_date", { ascending: false }),
    db
      .from("medication_records")
      .select("*")
      .order("administration_date", { ascending: false }),
  ]);

  const err =
    milkR.error ||
    animalR.error ||
    lactR.error ||
    breedR.error ||
    medR.error;
  if (err) throw err;

  state.milk = milkR.data || [];
  state.animals = animalR.data || [];
  state.lactations = lactR.data || [];
  state.breeding = breedR.data || [];
  state.medication = medR.data || [];

  // price quote from local storage (not in Supabase yet)
  const local = readLocal();
  state.priceQuote = local.priceQuote || 0;

  setStatus("Online", "online");
};

const loadData = async () => {
  if (!hasSupabase) {
    loadLocal();
    render();
    return;
  }

  try {
    await loadSupabase();
  } catch (e) {
    console.error("Supabase error:", e);
    loadLocal();
    setStatus("Erro Supabase", "error");
  }

  populateCowSelects();
  render();
};

/* --- Populate cow selects --- */
const populateCowSelects = () => {
  const opts = state.animals
    .map(
      (a) =>
        `<option value="${escapeHtml(a.identification)}">${escapeHtml(
          a.identification
        )}</option>`
    )
    .join("");
  if ($("#lactCowId")) $("#lactCowId").innerHTML = opts;
  if ($("#breedCowId")) $("#breedCowId").innerHTML = opts;
  if ($("#medCowId")) $("#medCowId").innerHTML = opts;
};

/* ===== CRUD ===== */

// Milk
const upsertMilk = async (record) => {
  if (!hasSupabase) {
    state.milk = state.milk.filter((r) => r.date !== record.date);
    state.milk.push({ ...record, id: localId() });
    writeLocal();
    return;
  }
  const { error } = await db
    .from("milk_records")
    .upsert(record, { onConflict: "date" });
  if (error) throw error;
  await loadSupabase();
};

// Animals
const insertAnimal = async (animal) => {
  if (!hasSupabase) {
    state.animals.unshift({
      ...animal,
      id: localId(),
      created_at: new Date().toISOString(),
    });
    writeLocal();
    return;
  }
  const { error } = await db.from("animals").insert(animal);
  if (error) throw error;
  await loadSupabase();
};

// Lactation
const insertLactation = async (record) => {
  if (!hasSupabase) {
    state.lactations.unshift({
      ...record,
      id: localId(),
      created_at: new Date().toISOString(),
    });
    writeLocal();
    return;
  }
  const row = {
    cow_id: record.cow_id,
    start_date: record.start_date,
    end_date: record.end_date || null,
    daily_liters: record.daily_liters,
  };
  const { error } = await db.from("lactation_records").insert(row);
  if (error) throw error;
  await loadSupabase();
};

// Breeding
const insertBreeding = async (record) => {
  if (!hasSupabase) {
    state.breeding.unshift({
      ...record,
      id: localId(),
      created_at: new Date().toISOString(),
    });
    writeLocal();
    return;
  }
  const row = {
    cow_id: record.cow_id,
    insemination_date: record.insemination_date,
    expected_calving_date: record.expected_calving_date,
  };
  const { error } = await db.from("breeding_records").insert(row);
  if (error) throw error;
  await loadSupabase();
};

// Medication
const insertMedication = async (record) => {
  if (!hasSupabase) {
    state.medication.unshift({
      ...record,
      id: localId(),
      created_at: new Date().toISOString(),
    });
    writeLocal();
    return;
  }
  const row = {
    cow_id: record.cow_id,
    medication_name: record.medication_name,
    dosage: record.dosage,
    administration_date: record.administration_date,
  };
  const { error } = await db.from("medication_records").insert(row);
  if (error) throw error;
  await loadSupabase();
};

/* ===== Render ===== */
const empty = (txt) => `<p class="empty">${escapeHtml(txt)}</p>`;

const renderPriceQuote = () => {
  const q = Number(state.priceQuote || 0);
  const fmt = q.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (el.priceQuoteDisplay)
    el.priceQuoteDisplay.textContent = `R$ ${fmt}/L`;
  if (el.priceQuoteValue)
    el.priceQuoteValue.textContent = `R$ ${fmt} por litro`;
};

const renderSummary = () => {
  const price = Number(state.priceQuote || 0);
  const todayRec = state.milk.find((r) => r.date === todayIso());
  const todayLiters = Number(todayRec?.liters || 0);

  const monthRecs = state.milk.filter((r) =>
    r.date?.startsWith(monthKey())
  );
  const monthLiters = monthRecs.reduce(
    (s, r) => s + Number(r.liters || 0),
    0
  );

  const lactating = state.animals.filter(
    (a) => a.status === "Em lactação"
  ).length;

  el.todayTotal.textContent = formatLiters(todayLiters);
  el.todayValue.textContent = formatMoney(todayLiters * price);
  el.monthTotal.textContent = formatLiters(monthLiters);
  el.monthValue.textContent = formatMoney(monthLiters * price);
  el.animalTotal.textContent = state.animals.length;
  el.lactatingTotal.textContent = `${lactating} em lactação`;
};

const renderMilk = () => {
  const price = Number(state.priceQuote || 0);
  const recs = [...state.milk].sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  el.historyList.innerHTML = recs.length
    ? recs
        .map(
          (r) => `
        <article class="item">
          <div>
            <span>${formatDate(r.date)}</span>
            <small>${formatMoney(price)} por litro</small>
          </div>
          <strong>${formatLiters(r.liters)} | ${formatMoney(
            Number(r.liters) * price
          )}</strong>
        </article>`
        )
        .join("")
    : empty("Nenhuma produção registrada.");
};

const renderAnimals = () => {
  el.animalList.innerHTML = state.animals.length
    ? state.animals
        .map(
          (a) => `
        <article class="item">
          <div>
            <span>${escapeHtml(a.identification)}</span>
            <small>${escapeHtml(a.type)}</small>
          </div>
          <strong>${escapeHtml(a.status)}</strong>
        </article>`
        )
        .join("")
    : empty("Nenhum animal cadastrado.");
};

const renderLactations = () => {
  el.lactationList.innerHTML = state.lactations.length
    ? state.lactations
        .map(
          (l) => `
        <article class="item">
          <div>
            <span>${escapeHtml(l.cow_id)}</span>
            <small>${formatDate(l.start_date)} → ${
            l.end_date ? formatDate(l.end_date) : "atual"
          }</small>
          </div>
          <strong>${formatLiters(l.daily_liters)} / dia</strong>
        </article>`
        )
        .join("")
    : empty("Nenhuma lactação registrada.");
};

const renderBreeding = () => {
  el.breedingList.innerHTML = state.breeding.length
    ? state.breeding
        .map(
          (b) => `
        <article class="item">
          <div>
            <span>${escapeHtml(b.cow_id)}</span>
            <small>Inseminação: ${formatDate(b.insemination_date)}</small>
          </div>
          <strong>Parto: ${formatDate(b.expected_calving_date)}</strong>
        </article>`
        )
        .join("")
    : empty("Nenhuma reprodução registrada.");
};

const renderMedication = () => {
  el.medicationList.innerHTML = state.medication.length
    ? state.medication
        .map(
          (m) => `
        <article class="item">
          <div>
            <span>${escapeHtml(m.cow_id)}</span>
            <small>${formatDate(m.administration_date)}</small>
          </div>
          <strong>${escapeHtml(m.medication_name)} — ${escapeHtml(
            m.dosage
          )}</strong>
        </article>`
        )
        .join("")
    : empty("Nenhuma medicação registrada.");
};

const render = () => {
  renderPriceQuote();
  renderSummary();
  renderMilk();
  renderAnimals();
  renderLactations();
  renderBreeding();
  renderMedication();
};

/* ===== Event listeners (only bound once) ===== */
let appInitialized = false;

const initApp = () => {
  if (appInitialized) {
    loadData();
    return;
  }
  appInitialized = true;

  // Tab navigation
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".tab, .panel")
        .forEach((e) => e.classList.remove("active"));
      btn.classList.add("active");
      $(`#${btn.dataset.tab}`).classList.add("active");
    });
  });

  // Milk form
  el.milkForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const record = {
      date: $("#milkDate").value,
      liters: Number.parseFloat($("#liters").value || "0"),
    };
    await upsertMilk(record);
    el.milkForm.reset();
    el.milkDate.value = todayIso();
    render();
  });

  // Animal form
  el.animalForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await insertAnimal({
      identification: $("#animalName").value.trim(),
      type: $("#animalType").value,
      status: $("#animalStatus").value,
    });
    el.animalForm.reset();
    populateCowSelects();
    render();
  });

  // Lactation form
  el.lactationForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await insertLactation({
      cow_id: $("#lactCowId").value,
      start_date: $("#lactStart").value,
      end_date: $("#lactEnd").value || null,
      daily_liters: Number.parseFloat($("#lactLiters").value || "0"),
    });
    el.lactationForm.reset();
    render();
  });

  // Breeding form
  el.breedingForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await insertBreeding({
      cow_id: $("#breedCowId").value,
      insemination_date: $("#inseminationDate").value,
      expected_calving_date: $("#expectedCalving").value,
    });
    el.breedingForm.reset();
    render();
  });

  // Medication form
  el.medicationForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await insertMedication({
      cow_id: $("#medCowId").value,
      medication_name: $("#medName").value.trim(),
      dosage: $("#medDosage").value.trim(),
      administration_date: $("#medDate").value,
    });
    el.medicationForm.reset();
    render();
  });

  // Price quote form
  el.priceQuoteForm.addEventListener("submit", (e) => {
    e.preventDefault();
    state.priceQuote = Number.parseFloat(
      el.priceQuoteInput.value || "0"
    );
    writeLocal();
    render();
    el.priceQuoteForm.reset();
  });

  // Refresh button
  el.refreshButton.addEventListener("click", loadData);

  // Set today's date
  el.milkDate.value = todayIso();

  // Load data
  loadData();
};

/* ===== Service Worker ===== */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("service-worker.js")
  );
}

/* ===== Boot ===== */
checkSession();
