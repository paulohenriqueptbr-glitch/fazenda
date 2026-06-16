// Validação de datas
const isValidDate = (dateStr) => Boolean(parseIsoDate(dateStr));

const isNotFutureDate = (dateStr) => {
  const date = parseIsoDate(dateStr);
  if (!date) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date <= today;
};

const isValidDateRange = (startStr, endStr) => {
  if (!endStr) return true;
  const start = parseIsoDate(startStr);
  const end = parseIsoDate(endStr);
  if (!start || !end) return false;

  return start <= end;
};

const validateNumber = (value, min = 0, max = 10000) => {
  const num = Number.parseFloat(value);
  return Number.isFinite(num) && num >= min && num <= max ? num : null;
};

const cleanText = (value, maxLength) => String(value || "").trim().slice(0, maxLength);

const optionalText = (value, maxLength) => cleanText(value, maxLength) || null;

const normalizeCropEventInput = (data) => {
  const plotName = cleanText(data.plot_name ?? data.plotName, 100);
  const cropName = cleanText(data.crop_name ?? data.cropName, 100);
  const eventType = cleanText(data.event_type ?? data.eventType, 80);
  const eventDate = String(data.event_date ?? data.eventDate ?? "");
  const areaRaw = data.area_tasks ?? data.areaTasks ?? "";
  const areaTasks = areaRaw === "" || areaRaw === null || areaRaw === undefined
    ? null
    : validateNumber(areaRaw, 0, 100000);

  if (!plotName) throw new Error("Talhao/area deve ter 1-100 caracteres");
  if (!cropName) throw new Error("Cultura deve ter 1-100 caracteres");
  if (!eventType) throw new Error("Manejo deve ter 1-80 caracteres");
  if (!isValidDate(eventDate)) throw new Error("Data invalida");
  if (!isNotFutureDate(eventDate)) throw new Error("Nao pode registrar manejo futuro");
  if (areaTasks === null && areaRaw !== "" && areaRaw !== null && areaRaw !== undefined) {
    throw new Error("Area em tarefas invalida");
  }

  return {
    plot_name: plotName,
    crop_name: cropName,
    event_type: eventType,
    event_date: eventDate,
    product: optionalText(data.product, 120),
    dosage: optionalText(data.dosage, 80),
    area_tasks: areaTasks,
    notes: optionalText(data.notes, 500),
  };
};

const normalizeStockItemInput = (data) => {
  const itemName = cleanText(data.item_name ?? data.itemName, 120);
  const category = cleanText(data.category || "Insumo", 60) || "Insumo";
  const quantity = validateNumber(data.quantity, 0, 1000000);
  const unit = cleanText(data.unit, 30);
  const minRaw = data.min_quantity ?? data.minQuantity ?? "";
  const minQuantity = minRaw === "" || minRaw === null || minRaw === undefined
    ? null
    : validateNumber(minRaw, 0, 1000000);

  if (!itemName) throw new Error("Item deve ter 1-120 caracteres");
  if (quantity === null) throw new Error("Quantidade invalida");
  if (!unit) throw new Error("Unidade deve ter 1-30 caracteres");
  if (minQuantity === null && minRaw !== "" && minRaw !== null && minRaw !== undefined) {
    throw new Error("Estoque minimo invalido");
  }

  return {
    item_name: itemName,
    category,
    quantity,
    unit,
    min_quantity: minQuantity,
    notes: optionalText(data.notes, 300),
  };
};

const normalizeReminderInput = (data) => {
  const title = cleanText(data.title, 120);
  const dueDate = String(data.due_date ?? data.dueDate ?? "");
  const category = cleanText(data.category || "Geral", 40) || "Geral";
  const notes = optionalText(data.notes, 300);
  const done = Boolean(data.done);

  if (!title) throw new Error("Lembrete deve ter 1-120 caracteres");
  if (!isValidDate(dueDate)) throw new Error("Data do lembrete invalida");

  return {
    title,
    category,
    due_date: dueDate,
    notes,
    done,
    completed_at: done ? (data.completed_at || new Date().toISOString()) : null,
  };
};

const showEditModal = (type, record) => {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.className = "edit-modal-overlay";

    const getInputsHTML = () => {
      if (type === "milk") {
        return `<label>Litros: <input type="number" name="liters" min="0" max="1000" step="0.1" value="${escapeHtml(String(record.liters ?? ''))}" required></label>`;
      } else if (type === "animal") {
        return `
          <label>Tipo: <input type="text" name="type" value="${escapeHtml(record.type)}" required></label>
          <label>Status: <input type="text" name="status" value="${escapeHtml(record.status)}" required></label>
        `;
      } else if (type === "lactation") {
        return `
          <label>Litros/dia: <input type="number" name="daily_liters" min="0" max="500" step="0.1" value="${escapeHtml(String(record.daily_liters ?? ''))}" required></label>
          <label>Fim (AAAA-MM-DD): <input type="date" name="end_date" value="${escapeHtml(record.end_date || '')}"></label>
        `;
      } else if (type === "breeding") {
        return `<label>Parto previsto: <input type="date" name="expected_calving_date" value="${escapeHtml(record.expected_calving_date || '')}" required></label>`;
      } else if (type === "medication") {
        return `
          <label>Medicamento: <input type="text" name="medication_name" value="${escapeHtml(record.medication_name)}" required></label>
          <label>Dosagem: <input type="text" name="dosage" value="${escapeHtml(record.dosage || '')}"></label>
          <label>Data: <input type="date" name="administration_date" value="${escapeHtml(record.administration_date || '')}" required></label>
        `;
      } else if (type === "crop") {
        return `
          <label>Talhão/área: <input type="text" name="plot_name" value="${escapeHtml(record.plot_name || '')}" required></label>
          <label>Cultura: <input type="text" name="crop_name" value="${escapeHtml(record.crop_name || '')}" required></label>
          <label>Manejo: <input type="text" name="event_type" value="${escapeHtml(record.event_type || '')}" required></label>
          <label>Data: <input type="date" name="event_date" value="${escapeHtml(record.event_date || '')}" required></label>
          <label>Produto/insumo: <input type="text" name="product" value="${escapeHtml(record.product || '')}"></label>
          <label>Dosagem: <input type="text" name="dosage" value="${escapeHtml(record.dosage || '')}"></label>
          <label>Área (tarefas): <input type="number" name="area_tasks" min="0" max="100000" step="0.01" value="${escapeHtml(String(record.area_tasks ?? ''))}"></label>
          <label>Observações: <textarea name="notes" rows="3">${escapeHtml(record.notes || '')}</textarea></label>
        `;
      } else if (type === "stock") {
        return `
          <label>Item: <input type="text" name="item_name" value="${escapeHtml(record.item_name || '')}" required></label>
          <label>Categoria: <input type="text" name="category" value="${escapeHtml(record.category || 'Insumo')}" required></label>
          <label>Quantidade: <input type="number" name="quantity" min="0" max="1000000" step="0.01" value="${escapeHtml(String(record.quantity ?? ''))}" required></label>
          <label>Unidade: <input type="text" name="unit" value="${escapeHtml(record.unit || '')}" required></label>
          <label>Estoque minimo: <input type="number" name="min_quantity" min="0" max="1000000" step="0.01" value="${escapeHtml(String(record.min_quantity ?? ''))}"></label>
          <label>Observacoes: <textarea name="notes" rows="3">${escapeHtml(record.notes || '')}</textarea></label>
        `;
      } else if (type === "reminder") {
        return `
          <label>Titulo: <input type="text" name="title" value="${escapeHtml(record.title || '')}" required></label>
          <label>Categoria: <input type="text" name="category" value="${escapeHtml(record.category || 'Geral')}" required></label>
          <label>Data: <input type="date" name="due_date" value="${escapeHtml(record.due_date || '')}" required></label>
          <label>Observacoes: <textarea name="notes" rows="3">${escapeHtml(record.notes || '')}</textarea></label>
        `;
      }
      return "";
    };

    modal.innerHTML = `
      <div class="edit-modal-card">
        <h2>Editar Registro</h2>
        <form id="editForm" class="edit-modal-form">
          ${getInputsHTML()}
          <div class="edit-modal-actions">
            <button type="button" id="cancelBtn" class="ghost">Cancelar</button>
            <button type="submit">Salvar</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const form = modal.querySelector("#editForm");
    const cancelBtn = modal.querySelector("#cancelBtn");

    const cleanup = () => {
      modal.remove();
    };

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const data = Object.fromEntries(formData);
      cleanup();
      resolve(data);
    });

    cancelBtn.addEventListener("click", () => {
      cleanup();
      resolve(null);
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        cleanup();
        resolve(null);
      }
    });
  });
};

const editRecord = async (type, id) => {
  const record = findRecord(type, id);
  if (!record) return;

  const data = await showEditModal(type, record);
  if (!data) return;

  try {
    if (type === "milk") {
      const liters = validateNumber(data.liters, 0, 1000);
      if (liters === null) throw new Error("Litros inválido (0-1000)");
      await updateRecord(type, id, { liters });
    } else if (type === "animal") {
      if (!data.type?.trim()) throw new Error("Tipo inválido");
      if (!data.status?.trim()) throw new Error("Status inválido");
      await updateRecord(type, id, { type: data.type.trim(), status: data.status.trim() });
    } else if (type === "lactation") {
      const dailyLiters = validateNumber(data.daily_liters, 0, 500);
      if (dailyLiters === null) throw new Error("Litros/dia inválido (0-500)");
      if (data.end_date && !isValidDateRange(record.start_date, data.end_date)) {
        throw new Error("Data de fim não pode ser antes do início");
      }
      await updateRecord(type, id, { daily_liters: dailyLiters, end_date: data.end_date || null });
    } else if (type === "breeding") {
      if (!data.expected_calving_date) throw new Error("Data de parto obrigatória");
      if (!isValidDate(data.expected_calving_date)) throw new Error("Data inválida");
      await updateRecord(type, id, { expected_calving_date: data.expected_calving_date });
    } else if (type === "medication") {
      if (!data.medication_name?.trim()) throw new Error("Medicamento inválido");
      if (!data.administration_date) throw new Error("Data de aplicação obrigatória");
      if (!isValidDate(data.administration_date)) throw new Error("Data inválida");
      await updateRecord(type, id, {
        medication_name: data.medication_name.trim(),
        dosage: (data.dosage || "").trim(),
        administration_date: data.administration_date,
      });
    } else if (type === "crop") {
      const plotName = (data.plot_name || "").trim();
      const cropName = (data.crop_name || "").trim();
      const eventType = (data.event_type || "").trim();
      const eventDate = data.event_date;
      const areaTasks = data.area_tasks ? validateNumber(data.area_tasks, 0, 100000) : null;

      if (!plotName || plotName.length > 100) throw new Error("Talhão/área deve ter 1-100 caracteres");
      if (!cropName || cropName.length > 100) throw new Error("Cultura deve ter 1-100 caracteres");
      if (!eventType || eventType.length > 80) throw new Error("Manejo deve ter 1-80 caracteres");
      if (!isValidDate(eventDate)) throw new Error("Data inválida");
      if (!isNotFutureDate(eventDate)) throw new Error("Não pode registrar manejo futuro");
      if (data.area_tasks && areaTasks === null) throw new Error("Área em tarefas inválida");

      await updateRecord(type, id, {
        plot_name: plotName,
        crop_name: cropName,
        event_type: eventType,
        event_date: eventDate,
        product: (data.product || "").trim().substring(0, 120) || null,
        dosage: (data.dosage || "").trim().substring(0, 80) || null,
        area_tasks: areaTasks,
        notes: (data.notes || "").trim().substring(0, 500) || null,
      });
    } else if (type === "stock") {
      await updateRecord(type, id, normalizeStockItemInput(data));
    } else if (type === "reminder") {
      await updateRecord(type, id, {
        ...normalizeReminderInput(data),
        done: Boolean(record.done),
        completed_at: record.completed_at || null,
      });
    }
    populateCowSelects();
    render();
    showToast("Registro atualizado com sucesso!");
  } catch (error) {
    showToast(error.message || "Erro ao editar", "error");
  }
};

const removeRecord = async (type, id) => {
  if (!findRecord(type, id)) return;
  const confirmed = window.confirm("Deseja excluir este registro?");
  if (!confirmed) return;

  await deleteRecord(type, id);
  populateCowSelects();
  render();
};

const toggleReminder = async (id) => {
  const reminder = findRecord("reminder", id);
  if (!reminder) return;
  const done = !reminder.done;
  await updateRecord("reminder", id, {
    done,
    completed_at: done ? new Date().toISOString() : null,
  });
  render();
  showToast(done ? "Lembrete concluido." : "Lembrete reaberto.");
};

const handleRecordAction = async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const { action, type, id } = button.dataset;

  try {
    if (action === "edit") await editRecord(type, id);
    if (action === "delete") await removeRecord(type, id);
    if (action === "toggle-reminder") await toggleReminder(id);
    if (action === "confirm-auto-alert") confirmAutoAlert(id);
    if (action === "dismiss-auto-alert") dismissAutoAlert(id);
  } catch (error) {
    console.error(error);
    showToast("Não foi possível concluir a ação.", "error");
  }
};