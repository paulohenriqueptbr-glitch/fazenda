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

  const now = new Date();
  const day = now.getDate();
  const fortnightStart = day <= 15
    ? `${monthKey()}-01`
    : `${monthKey()}-16`;
  const fortnightEnd = day <= 15
    ? `${monthKey()}-15`
    : null; // até hoje
  const fortnightRecords = state.milk.filter((record) => {
    if (!record.date) return false;
    if (record.date < fortnightStart) return false;
    if (fortnightEnd && record.date > fortnightEnd) return false;
    return true;
  });
  const fortnightLiters = fortnightRecords.reduce((sum, record) => sum + Number(record.liters || 0), 0);

  el.todayTotal.textContent = formatLiters(todayLiters);
  el.todayValue.textContent = formatMoney(todayLiters * price);
  el.monthTotal.textContent = formatLiters(monthLiters);
  el.monthValue.textContent = formatMoney(monthLiters * price);
  el.animalTotal.textContent = state.animals.length;
  el.lactatingTotal.textContent = `${lactating} em lactação`;

  const fortnightTotalEl = document.getElementById("fortnightTotal");
  const fortnightValueEl = document.getElementById("fortnightValue");
  if (fortnightTotalEl) fortnightTotalEl.textContent = formatLiters(fortnightLiters);
  if (fortnightValueEl) fortnightValueEl.textContent = formatMoney(fortnightLiters * price);
};

const renderMilk = () => {
  const price = Number(state.priceQuote || 0);
  const records = [...state.milk].sort((a, b) => b.date.localeCompare(a.date));
  const monthRecords = state.milk.filter((record) => record.date?.startsWith(monthKey()));
  const monthAverage = monthRecords.length ? monthRecords.reduce((sum, r) => sum + Number(r.liters || 0), 0) / monthRecords.length : 0;

  el.historyList.innerHTML = records.length
    ? records
        .map(
          (record) => {
            const prodStatus = getProductionStatus(Number(record.liters || 0), monthAverage);
            return `
            <article class="item" data-milk-id="${escapeHtml(record.id)}">
              <div>
                <div class="item-title-row">
                  <span>${escapeHtml(formatDate(record.date))}</span>
                  ${createStatusBadge(prodStatus)}
                </div>
                <small>${escapeHtml(formatMoney(price))} por litro</small>
              </div>
              <strong>${escapeHtml(formatLiters(record.liters))} | ${escapeHtml(formatMoney(Number(record.liters) * price))}</strong>
              ${recordActions("milk", record)}
            </article>
          `;
          }
        )
        .join("")
    : empty("Nenhuma produção registrada.");
};

window.showAnimalProfile = (animalId) => {
  const animal = state.animals.find(a => a.id === animalId);
  if (!animal) return;

  document.getElementById('animalProfileTitle').textContent = animal.identification;
  document.getElementById('animalProfileStatus').textContent = animal.status;
  
  const breedings = state.breeding.filter(b => b.cow_id === animalId);
  const health = state.medication.filter(m => m.cow_id === animalId);

  document.getElementById('profileBreedingList').innerHTML = breedings.length 
    ? breedings.map(b => `<article class="item">
        <div><span>Previsão: ${formatDate(b.expected_calving_date)}</span><small>Inseminação: ${formatDate(b.insemination_date)}</small></div>
      </article>`).join('')
    : empty("Nenhum registro de gestação.");

  document.getElementById('profileHealthList').innerHTML = health.length
    ? health.map(h => `<article class="item">
        <div><span>${escapeHtml(h.medication_name)} (${escapeHtml(h.dosage)})</span><small>${formatDate(h.administration_date)}</small></div>
      </article>`).join('')
    : empty("Nenhum histórico médico.");

  document.getElementById('animalProfileModal').classList.remove('hidden');
};

const renderAnimals = () => {
  el.animalList.innerHTML = state.animals.length
    ? state.animals
        .map(
          (animal) => `
            <article class="item animal-card" data-animal-id="${escapeHtml(animal.id)}" onclick="showAnimalProfile('${escapeHtml(animal.id)}')">
              <div>
                <span>${escapeHtml(animal.identification)}</span>
                <small>${escapeHtml(animal.type)}</small>
              </div>
              <strong>${escapeHtml(animal.status)}</strong>
              <div onclick="event.stopPropagation()">${recordActions("animal", animal)}</div>
            </article>
          `
        )
        .join("")
    : empty("Nenhum animal cadastrado.");
};

const renderLactations = () => {
  if (!el.lactationList) return;

  el.lactationList.innerHTML = state.lactations.length
    ? state.lactations
        .map(
          (record) => `
            <article class="item">
              <div>
                <span>${escapeHtml(animalLabel(record.cow_id))}</span>
                <small>${escapeHtml(formatDate(record.start_date))} -> ${
            record.end_date ? escapeHtml(formatDate(record.end_date)) : "atual"
          }</small>
              </div>
              <strong>${escapeHtml(formatLiters(record.daily_liters))} / dia</strong>
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
                <span>${escapeHtml(animalLabel(record.cow_id))}</span>
                <small>Prenhez: ${escapeHtml(formatDate(record.insemination_date))}</small>
              </div>
              <strong>Parto: ${escapeHtml(formatDate(record.expected_calving_date))}</strong>
              ${recordActions("breeding", record)}
            </article>
          `
        )
        .join("")
    : empty("Nenhuma reprodução registrada.");
};

const renderMedicalCowRecord = (profile) => {
  const records = profile.records;
  const lastRecord = records[0];
  const animalInfo = [profile.type, profile.status].filter(Boolean).join(" | ");
  const countLabel = `${records.length} ${records.length === 1 ? "registro" : "registros"}`;

  return `
    <article class="medical-record-card">
      <header class="medical-record-head">
        <div>
          <span>Ficha médica</span>
          <h3>${escapeHtml(profile.label)}</h3>
          <small>${escapeHtml(animalInfo || "Dados do rebanho")}</small>
        </div>
        <strong>${escapeHtml(countLabel)}</strong>
      </header>
      <div class="medical-record-summary">
        <span>
          <small>Total</small>
          <strong>${escapeHtml(String(records.length))}</strong>
        </span>
        <span>
          <small>Última aplicação</small>
          <strong>${escapeHtml(lastRecord ? formatDate(lastRecord.administration_date) : "-")}</strong>
        </span>
        <span>
          <small>Último medicamento</small>
          <strong>${escapeHtml(lastRecord?.medication_name || "-")}</strong>
        </span>
      </div>
      <div class="medical-history">
        ${
          records.length
            ? records
                .map(
                  (record) => `
                    <article class="item medical-history-item">
                      <div>
                        <span>${escapeHtml(record.medication_name)}</span>
                        <small>${escapeHtml(formatDate(record.administration_date))}</small>
                      </div>
                      <strong>${escapeHtml(record.dosage ? record.dosage + " ml" : "Sem dosagem")}</strong>
                      ${recordActions("medication", record)}
                    </article>
                  `
                )
                .join("")
            : empty("Nenhuma medicação registrada para esta vaca.")
        }
      </div>
    </article>
  `;
};

const renderMedication = () => {
  const profiles = getMedicationCowProfiles();
  const selectedProfile = getSelectedMedicationProfile(profiles);
  const medCowSelect = $("#medCowId");

  if (!profiles.length) {
    el.medicationList.innerHTML = empty("Cadastre uma vaca para criar a ficha médica.");
    return;
  }

  if (
    selectedProfile &&
    medCowSelect &&
    Array.from(medCowSelect.options).some((option) => cowIdKey(option.value) === cowIdKey(selectedProfile.id))
  ) {
    medCowSelect.value = selectedProfile.id;
  }

  el.medicationList.innerHTML = `
    <div class="medical-workspace">
      <div class="medical-cow-tabs" role="tablist" aria-label="Fichas médicas das vacas">
        ${profiles
          .map((profile) => {
            const active = (profile.ids || [profile.id]).some((id) =>
              (selectedProfile?.ids || [selectedProfile?.id]).some((selectedId) => cowIdKey(id) === cowIdKey(selectedId))
            );
            const lastRecord = profile.records[0];
            const countLabel = `${profile.records.length} ${profile.records.length === 1 ? "registro" : "registros"}`;
            return `
              <button
                class="medical-cow-tab ${active ? "active" : ""}"
                type="button"
                data-medical-cow-id="${escapeHtml(profile.id)}"
                role="tab"
                aria-selected="${active ? "true" : "false"}"
              >
                <span>${escapeHtml(profile.label)}</span>
                <small>${escapeHtml(countLabel)}</small>
                <em>${escapeHtml(lastRecord ? formatDate(lastRecord.administration_date) : "Sem medicação")}</em>
              </button>
            `;
          })
          .join("")}
      </div>
      <div class="medical-record-panel" role="tabpanel">
        ${selectedProfile ? renderMedicalCowRecord(selectedProfile) : empty("Selecione uma vaca para abrir a ficha médica.")}
      </div>
    </div>
  `;
};

const renderCropEventArticle = (record) => {
  const details = [
    record.product ? `Produto: ${record.product}` : "",
    record.dosage ? `Dose: ${record.dosage}` : "",
  ].filter(Boolean);
  const areaLabel = formatTasks(record.area_tasks);
  return `
    <article class="item">
      <div>
        <span>${escapeHtml(record.plot_name)} - ${escapeHtml(record.event_type)}</span>
        <small>${escapeHtml(formatDate(record.event_date))} | ${escapeHtml(record.crop_name)}</small>
        ${details.length ? `<small>${escapeHtml(details.join(" | "))}</small>` : ""}
        ${record.notes ? `<small>${escapeHtml(record.notes)}</small>` : ""}
      </div>
      <strong>${escapeHtml(areaLabel || record.event_type)}</strong>
      ${recordActions("crop", record)}
    </article>
  `;
};

const renderCropEvents = () => {
  if (!el.cropEventList) return;

  const records = [...state.cropEvents].sort((a, b) =>
    String(b.event_date || "").localeCompare(String(a.event_date || ""))
  );

  if (!records.length) {
    el.cropEventList.innerHTML = empty("Nenhum manejo de lavoura registrado.");
    return;
  }

  const groupOf = (record) => (CROP_GROUPS.includes(record.crop_group) ? record.crop_group : "Outra");

  const groups = CROP_GROUPS.map((group) => ({
    group,
    records: records.filter((record) => groupOf(record) === group),
  })).filter((entry) => entry.records.length || entry.group !== "Outra");

  if (!groups.some((entry) => entry.records.length)) {
    el.cropEventList.innerHTML = empty("Nenhum manejo de lavoura registrado.");
    return;
  }

  if (!CROP_GROUPS.includes(selectedCropGroup)) {
    selectedCropGroup = DEFAULT_CROP_GROUP;
  }

  let activeGroup = groups.find((entry) => entry.group === selectedCropGroup);
  if (!activeGroup || !activeGroup.records.length) {
    activeGroup = groups.find((entry) => entry.records.length) || groups[0];
    selectedCropGroup = activeGroup.group;
  }

  el.cropEventList.innerHTML = `
    <div class="medical-workspace">
      <div class="medical-cow-tabs" role="tablist" aria-label="Lavouras">
        ${groups
          .map((entry) => {
            const active = entry.group === activeGroup.group;
            const lastRecord = entry.records[0];
            const countLabel = `${entry.records.length} ${entry.records.length === 1 ? "registro" : "registros"}`;
            return `
              <button
                class="medical-cow-tab ${active ? "active" : ""}"
                type="button"
                data-crop-group="${escapeHtml(entry.group)}"
                role="tab"
                aria-selected="${active ? "true" : "false"}"
              >
                <span>${escapeHtml(entry.group)}</span>
                <small>${escapeHtml(countLabel)}</small>
                <em>${escapeHtml(lastRecord ? formatDate(lastRecord.event_date) : "Sem manejo")}</em>
              </button>
            `;
          })
          .join("")}
      </div>
      <div class="medical-record-panel list" role="tabpanel">
        ${
          activeGroup.records.length
            ? activeGroup.records.map(renderCropEventArticle).join("")
            : empty(`Nenhum manejo registrado para ${activeGroup.group}.`)
        }
      </div>
    </div>
  `;
};

const renderStockItems = () => {
  if (!el.stockList) return;

  const records = [...state.stockItems].sort((a, b) => {
    const byCategory = String(a.category || "").localeCompare(String(b.category || ""), "pt-BR", { sensitivity: "base" });
    if (byCategory) return byCategory;
    return String(a.item_name || "").localeCompare(String(b.item_name || ""), "pt-BR", { sensitivity: "base" });
  });

  el.stockList.innerHTML = records.length
    ? records
        .map((record) => {
          const quantity = Number(record.quantity || 0);
          const minQuantity = record.min_quantity === null || record.min_quantity === undefined
            ? null
            : Number(record.min_quantity || 0);
          const isLow = minQuantity !== null && quantity <= minQuantity;
          const details = [
            record.category || "Estoque",
            minQuantity !== null ? `Minimo: ${formatStockQuantity(minQuantity, record.unit)}` : "",
            record.notes || "",
          ].filter(Boolean);

          return `
            <article class="item ${isLow ? "stock-low" : ""}">
              <div>
                <span>${escapeHtml(record.item_name)}</span>
                <small>${escapeHtml(details.join(" | "))}</small>
              </div>
              <strong>${escapeHtml(`${formatStockQuantity(quantity, record.unit)}${isLow ? " | baixo" : ""}`)}</strong>
              ${recordActions("stock", record)}
            </article>
          `;
        })
        .join("")
    : empty("Nenhum item em estoque cadastrado.");
};

const dismissAutoAlert = (alertId) => {
  if (!state.dismissedAutoAlerts) state.dismissedAutoAlerts = new Set();
  state.dismissedAutoAlerts.add(alertId);
  writeLocal();
  renderAlerts();
  showToast("Alerta dispensado.");
};

const confirmAutoAlert = (alertId) => {
  if (!state.confirmedAutoAlerts) state.confirmedAutoAlerts = new Set();
  state.confirmedAutoAlerts.add(alertId);
  if (state.dismissedAutoAlerts) state.dismissedAutoAlerts.delete(alertId);
  writeLocal();
  renderAlerts();
  showToast("Alerta confirmado.");
};

const renderAlertItem = (alert) => {
  const isManual = alert.type === "manual";
  let directAction = "";
  if (!alert.done) {
    if (alert.category === "Leite") {
      directAction = `<button type="button" class="action-btn" onclick="document.querySelector('[data-tab=\\'milk\\']').click()">Registrar leite</button>`;
    } else if (alert.category === "Gestacao" || alert.category === "Gestação") {
      directAction = `<button type="button" class="action-btn" onclick="document.querySelector('[data-tab=\\'breeding\\']').click()">Ver gestação</button>`;
    } else if (alert.category === "Estoque") {
      directAction = `<button type="button" class="action-btn" onclick="document.querySelector('[data-tab=\\'stock\\']').click()">Atualizar estoque</button>`;
    } else if (alert.category === "Saude") {
      directAction = `<button type="button" class="action-btn" onclick="document.querySelector('[data-tab=\\'medication\\']').click()">Abrir animal</button>`;
    }
  }

  const autoActions = !isManual && !alert.done
    ? `
      <div class="item-actions">
        ${directAction}
        <button type="button" data-action="confirm-auto-alert" data-id="${escapeHtml(alert.id)}">Confirmar</button>
        <button type="button" class="ghost" data-action="dismiss-auto-alert" data-id="${escapeHtml(alert.id)}">Dispensar</button>
      </div>
    `
    : "";
  return `
    <article class="item alert-item ${escapeHtml(alert.status)}">
      <div>
        <div class="item-title-row">
          <span>${escapeHtml(alert.title)}</span>
          <span class="alert-pill ${escapeHtml(alert.status)}">${escapeHtml(alertStatusLabel(alert.due_date, alert.done))}</span>
        </div>
        <small>${escapeHtml(alert.category)} | ${escapeHtml(formatDate(alert.due_date))}</small>
        ${alert.notes ? `<small>${escapeHtml(alert.notes)}</small>` : ""}
      </div>
      <strong>${escapeHtml(isManual ? "Lembrete" : "Automatico")}</strong>
      ${isManual ? reminderActions(findRecord("reminder", alert.id) || alert) : autoActions}
    </article>
  `;
};

const renderAlerts = () => {
  if (!el.alertList) return;

  const alerts = buildAlerts();
  const activeAlerts = alerts.filter((alert) => !alert.done);
  const counts = {
    overdue: activeAlerts.filter((alert) => alert.status === "overdue").length,
    today: activeAlerts.filter((alert) => alert.status === "today").length,
    week: activeAlerts.filter((alert) => alert.status === "week").length,
    open: activeAlerts.length,
  };

  if (el.alertOverdueTotal) el.alertOverdueTotal.textContent = String(counts.overdue);
  if (el.alertTodayTotal) el.alertTodayTotal.textContent = String(counts.today);
  if (el.alertWeekTotal) el.alertWeekTotal.textContent = String(counts.week);
  if (el.alertOpenTotal) el.alertOpenTotal.textContent = String(counts.open);

  el.alertList.innerHTML = alerts.length
    ? alerts.map(renderAlertItem).join("")
    : empty("Nenhum alerta no momento.");
};