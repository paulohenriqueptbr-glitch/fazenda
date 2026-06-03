const LOCAL_KEY = "controle-leite-data";

const state = {
  milk: [],
  animals: [],
  products: [],
  lactations: [],
  breeding: [],
  medication: [],
  priceQuote: 0,
};

const config = window.CONTROLE_LEITE_CONFIG || {};
const hasSupabase = Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase);
const db = hasSupabase ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;

const $ = (selector) => document.querySelector(selector);

const populateCowSelects = () => {
  const cowOptions = state.animals
    .filter(a => a.type.includes('Bovino'))
    .map(a => `<option value="${escapeHtml(a.identification)}">${escapeHtml(a.identification)}</option>`)
    .join('');
  if ($("#lactCowId")) $("#lactCowId").innerHTML = cowOptions;
  if ($("#breedCowId")) $("#breedCowId").innerHTML = cowOptions;
  if ($("#medCowId")) $("#medCowId").innerHTML = cowOptions;
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const monthKey = () => todayIso().slice(0, 7);

const renderPriceQuote = () => {
  elements.priceQuoteDisplay.textContent = `Cotação do leite: R$ ${Number(state.priceQuote).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/L`;
};

const elements = {
  // UI elements
  syncStatus: $("#syncStatus"),
  todayTotal: $("#todayTotal"),
  todayValue: $("#todayValue"),
  monthTotal: $("#monthTotal"),
  monthValue: $("#monthValue"),
  animalTotal: $("#animalTotal"),
  lactatingTotal: $("#lactatingTotal"),
  historyList: $("#historyList"),
  animalList: $("#animalList"),
  productList: $("#productList"),
  milkForm: $("#milkForm"),
  animalForm: $("#animalForm"),
  productForm: $("#productForm"),
  lactationForm: $("#lactationForm"),
  lactationList: $("#lactationList"),
  breedingForm: $("#breedingForm"),
  medicationForm: $("#medicationForm"),
  refreshButton: $("#refreshButton"),
  milkDate: $("#milkDate"),
  // Config price quote UI
  priceQuoteForm: $("#priceQuoteForm"),
  priceQuoteInput: $("#priceQuoteInput"),
  priceQuoteDisplay: $("#priceQuoteDisplay"),
  // End UI elements
};

const formatLiters = (value) => `${Number(value || 0).toLocaleString("pt-BR")} L`;
const formatMoney = (value) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDate = (isoDate) => {
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

const readLocal = () => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) || state;
  } catch {
    return state;
  }
};

const writeLocal = () => {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
};

const setStatus = (message, kind = "local") => {
  elements.syncStatus.textContent = message;
  elements.syncStatus.dataset.kind = kind;
};

const localId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));

const loadLocal = () => {
  const data = readLocal();
  state.milk = data.milk || [];
  state.animals = data.animals || [];
  state.products = data.products || [];
  state.lactations = data.lactations || [];
  state.breeding = data.breeding || [];
  state.medication = data.medication || [];
  state.priceQuote = data.priceQuote || 0;
  setStatus("Local", "local");
};

const loadSupabase = async () => {
  setStatus("Sincronizando", "syncing");

  const [milkResult, animalResult, productResult, lactationResult, breedingResult, medicationResult] = await Promise.all([
    db.from("milk_records").select("*").order("date", { ascending: false }),
    db.from("animals").select("*").order("created_at", { ascending: false }),
    db.from("products").select("*").order("created_at", { ascending: false }),
    db.from("lactation_records").select("*").order("start", { ascending: false }),
    db.from("breeding_records").select("*").order("inseminationDate", { ascending: false }),
    db.from("medication_records").select("*").order("created_at", { ascending: false }),
  ]);

  const error = milkResult.error || animalResult.error || productResult.error || lactationResult.error || breedingResult.error || medicationResult.error;
  if (error) {
    throw error;
  }

  state.milk = milkResult.data || [];
  state.animals = animalResult.data || [];
  state.products = productResult.data || [];
  state.lactations = lactationResult.data || [];
  state.breeding = breedingResult.data || [];
  state.medication = medicationResult.data || [];
  // Assume priceQuote is stored in a separate settings table; fallback to local value if not present
  // For simplicity, keep existing local priceQuote unchanged here.
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
    console.error(error);
    loadLocal();
    setStatus("Erro Supabase", "error");
  }

  populateCowSelects();
  render();
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

const insertProduct = async (product) => {
  if (!hasSupabase) {
    state.products.unshift({ ...product, id: localId(), created_at: new Date().toISOString() });
    writeLocal();
    return;
  }

  const { error } = await db.from("products").insert(product);
  if (error) throw error;
  await loadSupabase();
};

const insertLactation = async (record) => {
  if (!hasSupabase) {
    state.lactations.unshift({ ...record, id: localId(), created_at: new Date().toISOString() });
    writeLocal();
    return;
  }

  const { error } = await db.from("lactation_records").insert(record);
  if (error) throw error;
  await loadSupabase();
};

const insertBreeding = async (record) => {
  if (!hasSupabase) {
    state.breeding.unshift({ ...record, id: localId(), created_at: new Date().toISOString() });
    writeLocal();
    return;
  }

  const { error } = await db.from("breeding_records").insert(record);
  if (error) throw error;
  await loadSupabase();
};

const insertMedication = async (record) => {
  if (!hasSupabase) {
    state.medication.unshift({ ...record, id: localId(), created_at: new Date().toISOString() });
    writeLocal();
    return;
  }

  const { error } = await db.from("medication_records").insert(record);
  if (error) throw error;
  await loadSupabase();
};

const renderSummary = () => {
  const todayRecord = state.milk.find((record) => record.date === todayIso());
  const monthRecords = state.milk.filter((record) => record.date.startsWith(monthKey()));
  const monthLiters = monthRecords.reduce((sum, record) => sum + Number(record.liters || 0), 0);
  const monthValue = monthRecords.reduce(
    (sum, record) => sum + Number(record.liters || 0) * Number(record.price_per_liter || 0),
    0
  );
  const lactating = state.animals.filter((animal) => animal.status === "Em lactação").length;

  elements.todayTotal.textContent = formatLiters(todayRecord?.liters || 0);
  elements.todayValue.textContent = formatMoney(
    Number(todayRecord?.liters || 0) * Number(todayRecord?.price_per_liter || 0)
  );
  elements.monthTotal.textContent = formatLiters(monthLiters);
  elements.monthValue.textContent = formatMoney(monthValue);
  elements.animalTotal.textContent = state.animals.length;
  elements.lactatingTotal.textContent = `${lactating} em lactação`;
};

const empty = (text) => `<p class="empty">${escapeHtml(text)}</p>`;

const renderMilk = () => {
  const records = [...state.milk].sort((a, b) => b.date.localeCompare(a.date));

  elements.historyList.innerHTML = records.length
    ? records
        .map(
          (record) => `
            <article class="item">
              <div>
                <span>${formatDate(record.date)}</span>
                <small>${formatMoney(record.price_per_liter)} por litro</small>
              </div>
              <strong>${formatLiters(record.liters)} | ${formatMoney(record.liters * record.price_per_liter)}</strong>
            </article>
          `
        )
        .join("")
    : empty("Nenhuma produção registrada.");
};

const renderAnimals = () => {
  elements.animalList.innerHTML = state.animals.length
    ? state.animals
        .map(
          (animal) => `
            <article class="item">
              <div>
                <span>${escapeHtml(animal.identification)}</span>
                <small>${escapeHtml(animal.type)}</small>
              </div>
              <strong>${escapeHtml(animal.status)}</strong>
            </article>
          `
        )
        .join("")
    : empty("Nenhum animal cadastrado.");
};

const renderProducts = () => {
  elements.productList.innerHTML = state.products.length
    ? state.products
        .map(
          (product) => `
            <article class="item">
              <div>
                <span>${escapeHtml(product.name)}</span>
                <small>${Number(product.quantity || 0)} unidade(s)</small>
              </div>
              <strong>${formatMoney(product.price)}</strong>
            </article>
          `
        )
        .join("")
    : empty("Nenhum produto cadastrado.");
};

const renderLactations = () => {
  elements.lactationList.innerHTML = state.lactations.length
    ? state.lactations
        .map((l) => `
          <article class="item">
            <div>
              <span>${escapeHtml(l.cowId)}</span>
              <small>${formatDate(l.start)} → ${l.end ? formatDate(l.end) : "atual"}</small>
            </div>
            <strong>${formatLiters(l.litersPerDay)} / dia</strong>
          </article>
        `)
        .join("")
    : empty("Nenhuma lactação registrada.");
};

const renderBreeding = () => {
  elements.breedingList.innerHTML = state.breeding.length
    ? state.breeding
        .map((b) => `
          <article class="item">
            <div>
              <span>${escapeHtml(b.cowId)}</span>
              <small>${formatDate(b.inseminationDate)} → ${formatDate(b.expectedCalving)}</small>
            </div>
            <strong>Reprodução</strong>
          </article>
        `)
        .join("")
    : empty("Nenhuma reprodução registrada.");
};

const renderMedication = () => {
  elements.medicationList.innerHTML = state.medication.length
    ? state.medication
        .map((m) => `
          <article class="item">
            <div>
              <span>${escapeHtml(m.cowId)}</span>
              <small>${formatDate(m.date)}</small>
            </div>
            <strong>${escapeHtml(m.name)} - ${escapeHtml(m.dosage)}</strong>
          </article>
        `)
        .join("")
    : empty("Nenhuma medicação registrada.");
};

const render = () => {
  renderSummary();
  renderMilk();
  renderAnimals();
  renderProducts();
  renderLactations();
  renderBreeding();
  renderMedication();
  renderPriceQuote();
};

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab, .panel").forEach((element) => element.classList.remove("active"));
    button.classList.add("active");
    $(`#${button.dataset.tab}`).classList.add("active");
  });
});

elements.milkForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const record = {
    date: $("#milkDate").value,
    liters: Number.parseFloat($("#liters").value || "0"),
    price_per_liter: Number.parseFloat($("#price").value || "0"),
  };

  await upsertMilk(record);
  elements.milkForm.reset();
  elements.milkDate.value = todayIso();
  render();
elements.priceQuoteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const newQuote = Number.parseFloat(elements.priceQuoteInput.value || "0");
  state.priceQuote = newQuote;
  writeLocal();
  renderPriceQuote();
  elements.priceQuoteForm.reset();
});

elements.animalForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  await insertAnimal({
    identification: $("#animalName").value.trim(),
    type: $("#animalType").value,
    status: $("#animalStatus").value,
  });

  elements.animalForm.reset();
  render();
});

elements.productForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  await insertProduct({
    name: $("#productName").value.trim(),
    quantity: Number.parseInt($("#productQuantity").value || "0", 10),
    price: Number.parseFloat($("#productPrice").value || "0"),
  });

  elements.productForm.reset();
  render();
});

elements.lactationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await insertLactation({
    cowId: $("#lactCowId").value,
    start: $("#lactStart").value,
    end: $("#lactEnd").value || null,
    litersPerDay: Number.parseFloat($("#lactLiters").value || "0"),
  });
  elements.lactationForm.reset();
  render();
});

elements.breedingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await insertBreeding({
    cowId: $("#breedCowId").value,
    inseminationDate: $("#inseminationDate").value,
    expectedCalving: $("#expectedCalving").value,
  });
  elements.breedingForm.reset();
  render();
});

elements.medicationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await insertMedication({
    cowId: $("#medCowId").value,
    name: $("#medName").value.trim(),
    dosage: $("#medDosage").value.trim(),
    date: $("#medDate").value,
  });
  elements.medicationForm.reset();
  render();
});

elements.refreshButton.addEventListener("click", loadData);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js");
  });
}

elements.milkDate.value = todayIso();
loadData();
