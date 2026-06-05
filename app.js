const LOCAL_KEY = "controle-fazenda-data";
const PRICE_QUOTE_KEY = "milk_price_quote";

const state = {
  milk: [],
  animals: [],
  lactations: [],
  breeding: [],
  medication: [],
  priceQuote: 0,
};

const config = window.CONTROLE_LEITE_CONFIG || {};
const hasSupabase = Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase);
const db = hasSupabase ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;

const $ = (selector) => document.querySelector(selector);
const todayIso = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
const monthKey = () => todayIso().slice(0, 7);
const localId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));

const formatLiters = (value) => `${Number(value || 0).toLocaleString("pt-BR")} L`;
const formatMoney = (value) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDate = (isoDate) => {
  if (!isoDate) return "-";
  const [year, month, day] = isoDate.split("-");
  return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString("pt-BR");
};

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character];
  });

const loginScreen = $("#loginScreen");
const appShell = $("#appShell");
const loginForm = $("#loginForm");
const loginError = $("#loginError");
const logoutBtn = $("#logoutBtn");
const userEmailEl = $("#userEmail");

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
  reportMonthTotal: $("#reportMonthTotal"),
  reportMonthValue: $("#reportMonthValue"),
  reportAverage: $("#reportAverage"),
  reportBestDay: $("#reportBestDay"),
  productionChart: $("#productionChart"),
};

const actionButtons = (type, id) => `
  <div class="item-actions">
    <button type="button" data-action="edit" data-type="${type}" data-id="${escapeHtml(id)}">Editar</button>
    <button type="button" data-action="delete" data-type="${type}" data-id="${escapeHtml(id)}">Excluir</button>
  </div>
`;

const recordActions = (type, record) => (record.id ? actionButtons(type, record.id) : "");

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

const showLoginError = (message) => {
  loginError.textContent = message;
  loginError.classList.add("visible");
};

const readLocal = () => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) || {};
  } catch {
    return {};
  }
};

const writeLocal = () => {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
};

const setStatus = (message, kind = "local") => {
  el.syncStatus.textContent = message;
  el.syncStatus.dataset.kind = kind;
};

const loadLocal = () => {
  const data = readLocal();
  state.milk = data.milk || [];
  state.animals = data.animals || [];
  state.lactations = data.lactations || [];
  state.breeding = data.breeding || [];
  state.medication = data.medication || [];
  state.priceQuote = data.priceQuote || 0;
  setStatus("Local", "local");
};

const loadPriceQuote = async () => {
  const { data, error } = await db
    .from("app_settings")
    .select("value")
    .eq("key", PRICE_QUOTE_KEY)
    .maybeSingle();

  if (error) throw error;

  state.priceQuote = Number(data?.value || 0);
};

const savePriceQuote = async (value) => {
  state.priceQuote = Number(value || 0);

  if (!hasSupabase) {
    writeLocal();
    return;
  }

  const { error } = await db.from("app_settings").upsert(
    {
      key: PRICE_QUOTE_KEY,
      value: String(state.priceQuote),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) throw error;
};

const loadSupabase = async () => {
  setStatus("Sincronizando", "syncing");

  const [milkResult, animalResult, lactationResult, breedingResult, medicationResult] = await Promise.all([
    db.from("milk_records").select("*").order("date", { ascending: false }),
    db.from("animals").select("*").order("created_at", { ascending: false }),
    db.from("lactation_records").select("*").order("start_date", { ascending: false }),
    db.from("breeding_records").select("*").order("insemination_date", { ascending: false }),
    db.from("medication_records").select("*").order("administration_date", { ascending: false }),
  ]);

  const error =
    milkResult.error ||
    animalResult.error ||
    lactationResult.error ||
    breedingResult.error ||
    medicationResult.error;

  if (error) throw error;

  state.milk = milkResult.data || [];
  state.animals = animalResult.data || [];
  state.lactations = lactationResult.data || [];
  state.breeding = breedingResult.data || [];
  state.medication = medicationResult.data || [];
  await loadPriceQuote();

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
  } catch (error) {
    console.error("Supabase error:", error);
    loadLocal();
    setStatus("Erro Supabase", "error");
  }

  populateCowSelects();
  render();
};

const populateCowSelects = () => {
  const options = state.animals
    .map(
      (animal) =>
        `<option value="${escapeHtml(animal.identification)}">${escapeHtml(animal.identification)}</option>`
    )
    .join("");

  $("#lactCowId").innerHTML = options;
  $("#breedCowId").innerHTML = options;
  $("#medCowId").innerHTML = options;
};

const upsertMilk = async (record) => {
  if (!hasSupabase) {
    state.milk = state.milk.filter((item) => item.date !== record.date);
    state.milk.push({ ...record, id: localId() });
    writeLocal();
    return;
  }

  const { error } = await db.from("milk_records").upsert(record, { onConflict: "date" });
  if (error) throw error;
  await loadSupabase();
};

const insertAnimal = async (animal) => {
  if (!hasSupabase) {
    state.animals.unshift({ ...animal, id: localId(), created_at: new Date().toISOString() });
    writeLocal();
    return;
  }

  const { error } = await db.from("animals").insert(animal);
  if (error) throw error;
  await loadSupabase();
};

const insertLactation = async (record) => {
  if (!hasSupabase) {
    state.lactations.unshift({ ...record, id: localId(), created_at: new Date().toISOString() });
    writeLocal();
    return;
  }

  const { error } = await db.from("lactation_records").insert({
    cow_id: record.cow_id,
    start_date: record.start_date,
    end_date: record.end_date || null,
    daily_liters: record.daily_liters,
  });

  if (error) throw error;
  await loadSupabase();
};

const insertBreeding = async (record) => {
  if (!hasSupabase) {
    state.breeding.unshift({ ...record, id: localId(), created_at: new Date().toISOString() });
    writeLocal();
    return;
  }

  const { error } = await db.from("breeding_records").insert({
    cow_id: record.cow_id,
    insemination_date: record.insemination_date,
    expected_calving_date: record.expected_calving_date,
  });

  if (error) throw error;
  await loadSupabase();
};

const insertMedication = async (record) => {
  if (!hasSupabase) {
    state.medication.unshift({ ...record, id: localId(), created_at: new Date().toISOString() });
    writeLocal();
    return;
  }

  const { error } = await db.from("medication_records").insert({
    cow_id: record.cow_id,
    medication_name: record.medication_name,
    dosage: record.dosage,
    administration_date: record.administration_date,
  });

  if (error) throw error;
  await loadSupabase();
};

const collections = {
  milk: { stateKey: "milk", table: "milk_records" },
  animal: { stateKey: "animals", table: "animals" },
  lactation: { stateKey: "lactations", table: "lactation_records" },
  breeding: { stateKey: "breeding", table: "breeding_records" },
  medication: { stateKey: "medication", table: "medication_records" },
};

const findRecord = (type, id) => {
  const config = collections[type];
  if (!config) return null;
  return state[config.stateKey].find((record) => String(record.id) === String(id));
};

const updateRecord = async (type, id, changes) => {
  const config = collections[type];
  if (!config || !id) return;

  if (!hasSupabase) {
    state[config.stateKey] = state[config.stateKey].map((record) =>
      String(record.id) === String(id) ? { ...record, ...changes } : record
    );
    writeLocal();
    return;
  }

  const { error } = await db.from(config.table).update(changes).eq("id", id);
  if (error) throw error;
  await loadSupabase();
};

const deleteRecord = async (type, id) => {
  const config = collections[type];
  if (!config || !id) return;

  if (!hasSupabase) {
    state[config.stateKey] = state[config.stateKey].filter((record) => String(record.id) !== String(id));
    writeLocal();
    return;
  }

  const { error } = await db.from(config.table).delete().eq("id", id);
  if (error) throw error;
  await loadSupabase();
};

const askText = (label, currentValue = "") => {
  const value = window.prompt(label, currentValue ?? "");
  return value === null ? null : value.trim();
};

const askNumber = (label, currentValue = 0) => {
  const value = window.prompt(label, String(currentValue ?? 0).replace(".", ","));
  if (value === null) return null;
  const normalized = value.replace(",", ".");
  const number = Number.parseFloat(normalized);
  return Number.isFinite(number) && number >= 0 ? number : null;
};

const editRecord = async (type, id) => {
  const record = findRecord(type, id);
  if (!record) return;

  if (type === "milk") {
    const liters = askNumber("Litros produzidos", record.liters);
    if (liters === null) return;
    await updateRecord(type, id, { liters });
  }

  if (type === "animal") {
    const animalType = askText("Tipo do animal", record.type);
    if (animalType === null || !animalType) return;
    const status = askText("Status do animal", record.status);
    if (status === null || !status) return;
    await updateRecord(type, id, { type: animalType, status });
  }

  if (type === "lactation") {
    const dailyLiters = askNumber("Litros por dia", record.daily_liters);
    if (dailyLiters === null) return;
    const endDate = askText("Data de fim (AAAA-MM-DD). Deixe vazio se estiver atual.", record.end_date || "");
    if (endDate === null) return;
    await updateRecord(type, id, { daily_liters: dailyLiters, end_date: endDate || null });
  }

  if (type === "breeding") {
    const expectedCalvingDate = askText("Parto previsto (AAAA-MM-DD)", record.expected_calving_date || "");
    if (expectedCalvingDate === null || !expectedCalvingDate) return;
    await updateRecord(type, id, { expected_calving_date: expectedCalvingDate });
  }

  if (type === "medication") {
    const medicationName = askText("Medicamento", record.medication_name);
    if (medicationName === null || !medicationName) return;
    const dosage = askText("Dosagem", record.dosage || "");
    if (dosage === null) return;
    const administrationDate = askText("Data de aplicação (AAAA-MM-DD)", record.administration_date);
    if (administrationDate === null || !administrationDate) return;
    await updateRecord(type, id, {
      medication_name: medicationName,
      dosage,
      administration_date: administrationDate,
    });
  }

  populateCowSelects();
  render();
};

const removeRecord = async (type, id) => {
  if (!findRecord(type, id)) return;
  const confirmed = window.confirm("Deseja excluir este registro?");
  if (!confirmed) return;

  await deleteRecord(type, id);
  populateCowSelects();
  render();
};

const handleRecordAction = async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const { action, type, id } = button.dataset;

  try {
    if (action === "edit") await editRecord(type, id);
    if (action === "delete") await removeRecord(type, id);
  } catch (error) {
    console.error(error);
    window.alert("Não foi possível concluir a ação. Verifique o Supabase e tente novamente.");
  }
};

const empty = (text) => `<p class="empty">${escapeHtml(text)}</p>`;

const renderPriceQuote = () => {
  const price = Number(state.priceQuote || 0);
  const formatted = price.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  el.priceQuoteDisplay.textContent = `R$ ${formatted}/L`;
  el.priceQuoteValue.textContent = `R$ ${formatted} por litro`;
};

const renderSummary = () => {
  const price = Number(state.priceQuote || 0);
  const todayRecord = state.milk.find((record) => record.date === todayIso());
  const todayLiters = Number(todayRecord?.liters || 0);
  const monthRecords = state.milk.filter((record) => record.date?.startsWith(monthKey()));
  const monthLiters = monthRecords.reduce((sum, record) => sum + Number(record.liters || 0), 0);
  const lactating = state.animals.filter((animal) => animal.status === "Em lactação").length;

  el.todayTotal.textContent = formatLiters(todayLiters);
  el.todayValue.textContent = formatMoney(todayLiters * price);
  el.monthTotal.textContent = formatLiters(monthLiters);
  el.monthValue.textContent = formatMoney(monthLiters * price);
  el.animalTotal.textContent = state.animals.length;
  el.lactatingTotal.textContent = `${lactating} em lactação`;
};

const renderMilk = () => {
  const price = Number(state.priceQuote || 0);
  const records = [...state.milk].sort((a, b) => b.date.localeCompare(a.date));

  el.historyList.innerHTML = records.length
    ? records
        .map(
          (record) => `
            <article class="item">
              <div>
                <span>${formatDate(record.date)}</span>
                <small>${formatMoney(price)} por litro</small>
              </div>
              <strong>${formatLiters(record.liters)} | ${formatMoney(Number(record.liters) * price)}</strong>
              ${recordActions("milk", record)}
            </article>
          `
        )
        .join("")
    : empty("Nenhuma produção registrada.");
};

const renderAnimals = () => {
  el.animalList.innerHTML = state.animals.length
    ? state.animals
        .map(
          (animal) => `
            <article class="item">
              <div>
                <span>${escapeHtml(animal.identification)}</span>
                <small>${escapeHtml(animal.type)}</small>
              </div>
              <strong>${escapeHtml(animal.status)}</strong>
              ${recordActions("animal", animal)}
            </article>
          `
        )
        .join("")
    : empty("Nenhum animal cadastrado.");
};

const renderLactations = () => {
  el.lactationList.innerHTML = state.lactations.length
    ? state.lactations
        .map(
          (record) => `
            <article class="item">
              <div>
                <span>${escapeHtml(record.cow_id)}</span>
                <small>${formatDate(record.start_date)} -> ${
            record.end_date ? formatDate(record.end_date) : "atual"
          }</small>
              </div>
              <strong>${formatLiters(record.daily_liters)} / dia</strong>
              ${recordActions("lactation", record)}
            </article>
          `
        )
        .join("")
    : empty("Nenhuma lactação registrada.");
};

const renderBreeding = () => {
  el.breedingList.innerHTML = state.breeding.length
    ? state.breeding
        .map(
          (record) => `
            <article class="item">
              <div>
                <span>${escapeHtml(record.cow_id)}</span>
                <small>Inseminação: ${formatDate(record.insemination_date)}</small>
              </div>
              <strong>Parto: ${formatDate(record.expected_calving_date)}</strong>
              ${recordActions("breeding", record)}
            </article>
          `
        )
        .join("")
    : empty("Nenhuma reprodução registrada.");
};

const renderMedication = () => {
  el.medicationList.innerHTML = state.medication.length
    ? state.medication
        .map(
          (record) => `
            <article class="item">
              <div>
                <span>${escapeHtml(record.cow_id)}</span>
                <small>${formatDate(record.administration_date)}</small>
              </div>
              <strong>${escapeHtml(record.medication_name)} - ${escapeHtml(record.dosage)}</strong>
              ${recordActions("medication", record)}
            </article>
          `
        )
        .join("")
    : empty("Nenhuma medicação registrada.");
};

const renderReports = () => {
  const price = Number(state.priceQuote || 0);
  const monthRecords = state.milk.filter((record) => record.date?.startsWith(monthKey()));
  const monthLiters = monthRecords.reduce((sum, record) => sum + Number(record.liters || 0), 0);
  const average = monthRecords.length ? monthLiters / monthRecords.length : 0;
  const bestRecord = monthRecords.reduce(
    (best, record) => (Number(record.liters || 0) > Number(best?.liters || 0) ? record : best),
    null
  );
  const chartRecords = [...state.milk]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-10);
  const maxLiters = chartRecords.reduce((max, record) => Math.max(max, Number(record.liters || 0)), 0);

  el.reportMonthTotal.textContent = formatLiters(monthLiters);
  el.reportMonthValue.textContent = formatMoney(monthLiters * price);
  el.reportAverage.textContent = formatLiters(average);
  el.reportBestDay.textContent = bestRecord ? `${formatDate(bestRecord.date)} - ${formatLiters(bestRecord.liters)}` : "-";

  el.productionChart.innerHTML = chartRecords.length
    ? chartRecords
        .map((record) => {
          const liters = Number(record.liters || 0);
          const width = maxLiters ? Math.max(8, (liters / maxLiters) * 100) : 8;

          return `
            <div class="chart-row">
              <span>${formatDate(record.date)}</span>
              <div class="chart-track">
                <div class="chart-bar" style="width: ${width}%"></div>
              </div>
              <strong>${formatLiters(liters)}</strong>
            </div>
          `;
        })
        .join("")
    : empty("Nenhuma produção para montar o gráfico.");
};

const render = () => {
  renderPriceQuote();
  renderSummary();
  renderMilk();
  renderAnimals();
  renderLactations();
  renderBreeding();
  renderMedication();
  renderReports();
};

let appInitialized = false;

const initApp = () => {
  if (appInitialized) {
    loadData();
    return;
  }

  appInitialized = true;

  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab, .panel").forEach((element) => element.classList.remove("active"));
      button.classList.add("active");
      $(`#${button.dataset.tab}`).classList.add("active");
    });
  });

  document.addEventListener("click", handleRecordAction);

  el.milkForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      await upsertMilk({
        date: $("#milkDate").value,
        liters: Number.parseFloat($("#liters").value || "0"),
      });

      el.milkForm.reset();
      el.milkDate.value = todayIso();
      render();
    } catch (err) {
      console.error(err);
      window.alert("Erro ao salvar a produção de leite. Verifique o banco de dados Supabase: " + err.message);
    }
  });

  el.animalForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    await insertAnimal({
      identification: $("#animalName").value.trim(),
      type: $("#animalType").value,
      status: $("#animalStatus").value,
    });

    el.animalForm.reset();
    populateCowSelects();
    render();
  });

  el.lactationForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    await insertLactation({
      cow_id: $("#lactCowId").value,
      start_date: $("#lactStart").value,
      end_date: $("#lactEnd").value || null,
      daily_liters: Number.parseFloat($("#lactLiters").value || "0"),
    });

    el.lactationForm.reset();
    render();
  });

  el.breedingForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    await insertBreeding({
      cow_id: $("#breedCowId").value,
      insemination_date: $("#inseminationDate").value,
      expected_calving_date: $("#expectedCalving").value,
    });

    el.breedingForm.reset();
    render();
  });

  el.medicationForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    await insertMedication({
      cow_id: $("#medCowId").value,
      medication_name: $("#medName").value.trim(),
      dosage: $("#medDosage").value.trim(),
      administration_date: $("#medDate").value,
    });

    el.medicationForm.reset();
    render();
  });

  el.priceQuoteForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    await savePriceQuote(Number.parseFloat(el.priceQuoteInput.value || "0"));
    writeLocal();
    render();
    el.priceQuoteForm.reset();
  });

  el.refreshButton.addEventListener("click", loadData);
  el.milkDate.value = todayIso();
  loadData();
};

const checkSession = async () => {
  if (!hasSupabase || !db) {
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
  } catch (error) {
    console.error("Session check error:", error);
    showLogin();
  }
};

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.classList.remove("visible");

  const email = $("#loginEmail").value.trim();
  const password = $("#loginPassword").value;

  if (!hasSupabase || !db) {
    showApp("Modo local");
    initApp();
    return;
  }

  try {
    const { data, error } = await db.auth.signInWithPassword({ email, password });

    if (error) {
      showLoginError(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
      return;
    }

    showApp(data.user.email);
    initApp();
  } catch (error) {
    showLoginError("Erro ao conectar. Tente novamente.");
    console.error(error);
  }
});

logoutBtn.addEventListener("click", async () => {
  if (hasSupabase && db) {
    await db.auth.signOut();
  }

  showLogin();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js");
  });
}

checkSession();
