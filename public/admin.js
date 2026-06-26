const tokenInput = document.getElementById("adminTokenInput");
const loadButton = document.getElementById("loadCustomersButton");
const refreshButton = document.getElementById("refreshCustomersButton");
const customerList = document.getElementById("customerList");
const messageEl = document.getElementById("adminMessage");
const customerCountEl = document.getElementById("adminCustomerCount");
const activeCountEl = document.getElementById("adminActiveCount");
const riskCountEl = document.getElementById("adminRiskCount");

let adminToken = localStorage.getItem("controle-fazenda-admin-token") || "";
let customers = [];

const cleanAdminToken = (value) =>
  String(value || "")
    .trim()
    .replace(/^[`'"\u201c\u201d]+|[`'"\u201c\u201d]+$/g, "");

const isHeaderSafeValue = (value) => /^[\u0009\u0020-\u00ff]*$/.test(value) && !/[\r\n]/.test(value);

if (tokenInput) tokenInput.value = adminToken;

const setAdminMessage = (message, type = "info") => {
  if (!messageEl) return;
  messageEl.textContent = message;
  messageEl.dataset.type = type;
};

const statusLabels = {
  trial: "Teste",
  active: "Ativa",
  overdue: "Vencida",
  blocked: "Bloqueada",
  canceled: "Cancelada",
};

const escapeText = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return entities[character];
  });

const requestAdmin = async (options = {}) => {
  const response = await fetch("/api/admin-customers", {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não foi possível acessar o admin.");
  return data;
};

const renderMetrics = () => {
  const active = customers.filter((customer) => ["active", "trial"].includes(customer.subscriptionStatus)).length;
  const risk = customers.filter((customer) => ["overdue", "blocked", "canceled"].includes(customer.subscriptionStatus)).length;
  customerCountEl.textContent = String(customers.length);
  activeCountEl.textContent = String(active);
  riskCountEl.textContent = String(risk);
};

const renderCustomers = () => {
  renderMetrics();

  if (!customers.length) {
    customerList.innerHTML = '<p class="empty">Nenhum cliente encontrado.</p>';
    return;
  }

  customerList.innerHTML = customers
    .map(
      (customer) => `
        <article class="customer-card" data-user-id="${escapeText(customer.userId)}">
          <div>
            <span>${escapeText(customer.email || "Sem e-mail")}</span>
            <strong>${escapeText(customer.farmName || "Fazenda sem nome")}</strong>
            <small>${escapeText(customer.ownerName || "Responsável não informado")} ${customer.whatsapp ? " · " + escapeText(customer.whatsapp) : ""}</small>
          </div>
          <form class="customer-actions">
            <select name="subscriptionStatus">
              ${Object.entries(statusLabels)
                .map(
                  ([value, label]) =>
                    `<option value="${value}" ${value === customer.subscriptionStatus ? "selected" : ""}>${label}</option>`
                )
                .join("")}
            </select>
            <input name="subscriptionDueDate" type="date" value="${escapeText(customer.subscriptionDueDate || "")}">
            <button type="submit">Salvar</button>
          </form>
        </article>
      `
    )
    .join("");
};

const loadCustomers = async () => {
  adminToken = cleanAdminToken(tokenInput.value);
  if (!adminToken) {
    setAdminMessage("Informe o ADMIN_TOKEN configurado na Vercel.", "error");
    return;
  }

  if (!isHeaderSafeValue(adminToken)) {
    setAdminMessage(
      "O token tem caractere invalido para cabecalho HTTP. Copie o ADMIN_TOKEN sem aspas especiais, acentos ou quebras de linha.",
      "error"
    );
    return;
  }

  tokenInput.value = adminToken;
  localStorage.setItem("controle-fazenda-admin-token", adminToken);
  setAdminMessage("Carregando clientes...");

  try {
    const data = await requestAdmin();
    customers = data.customers || [];
    renderCustomers();
    setAdminMessage("Clientes carregados.", "success");
  } catch (error) {
    customerList.innerHTML = "";
    setAdminMessage(error.message, "error");
  }
};

customerList.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target.closest("form");
  const card = event.target.closest("[data-user-id]");
  if (!form || !card) return;

  const formData = new FormData(form);
  const payload = {
    userId: card.dataset.userId,
    subscriptionStatus: formData.get("subscriptionStatus"),
    subscriptionDueDate: formData.get("subscriptionDueDate"),
  };

  try {
    await requestAdmin({ method: "POST", body: JSON.stringify(payload) });
    setAdminMessage("Cliente atualizado.", "success");
    await loadCustomers();
  } catch (error) {
    setAdminMessage(error.message, "error");
  }
});

loadButton.addEventListener("click", loadCustomers);
refreshButton.addEventListener("click", loadCustomers);

if (adminToken) {
  loadCustomers();
}

// ─── Toggle de tema ──────────────────────────────────────────────────────────
const adminThemeBtn = document.getElementById("themeToggle");
if (adminThemeBtn) {
  adminThemeBtn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("terrasyn-theme", next); } catch {}
    adminThemeBtn.querySelectorAll(".theme-toggle-icon").forEach((icon) => {
      icon.textContent = next === "dark" ? "☀" : "☾";
    });
  });
  const theme = document.documentElement.getAttribute("data-theme") || "light";
  adminThemeBtn.querySelectorAll(".theme-toggle-icon").forEach((icon) => {
    icon.textContent = theme === "dark" ? "☀" : "☾";
  });
}
