
let appInitialized = false;

const initApp = () => {
  if (appInitialized) {
    loadData();
    return;
  }

  appInitialized = true;

  if (!document.body._tabListenersAttached) {
    document.body._tabListenersAttached = true;

    const activateTab = (tabId) => {
      if (!tabId) return;
      document.querySelectorAll(".nav-item, .quick-action, .panel").forEach((element) => element.classList.remove("active"));
      document.querySelectorAll(`[data-tab="${tabId}"]`).forEach((element) => element.classList.add("active"));
      const panel = $(`#${tabId}`);
      if (panel) panel.classList.add("active");
      if (el.appShell) el.appShell.dataset.activeTab = tabId;
      window.scrollTo({ top: el.appShell?.offsetTop || 0, behavior: "smooth" });
    };

    document.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-tab]");
      if (!btn) return;
      activateTab(btn.dataset.tab);
    });

    if (el.appShell && !el.appShell.dataset.activeTab) {
      const initialPanel = document.querySelector(".panel.active");
      el.appShell.dataset.activeTab = initialPanel ? initialPanel.id : "milk";
    }
  }

  if (!document.body._recordActionsAttached) {
    document.body._recordActionsAttached = true;
    document.addEventListener("click", handleRecordAction);
  }

  if (!document.body._medicalCowTabsAttached) {
    document.body._medicalCowTabsAttached = true;
    document.addEventListener("click", (event) => {
      const cowTab = event.target.closest("[data-medical-cow-id]");
      if (!cowTab) return;

      selectedMedicationCowId = cowTab.dataset.medicalCowId;
      const medCowSelect = $("#medCowId");
      if (medCowSelect) medCowSelect.value = selectedMedicationCowId;
      renderMedication();
    });
  }

  const inseminationInput = $("#inseminationDate");
  const calvingInput = $("#expectedCalving");
  if (inseminationInput && calvingInput && !inseminationInput._listenerAttached) {
    inseminationInput._listenerAttached = true;
    inseminationInput.addEventListener("change", () => {
      if (!inseminationInput.value) return;
      calvingInput.value = addDaysIso(inseminationInput.value, 285);
    });
  }

  const medCowInput = $("#medCowId");
  if (medCowInput && !medCowInput._listenerAttached) {
    medCowInput._listenerAttached = true;
    medCowInput.addEventListener("change", () => {
      selectedMedicationCowId = medCowInput.value;
      renderMedication();
    });
  }

  el.milkForm.addEventListener("submit", withButtonLoading(el.milkForm, async (event) => {
    event.preventDefault();

    try {
      const dateValue = $("#milkDate").value;
      const litersValue = Number.parseFloat($("#liters").value || "0");

      if (!isValidDate(dateValue)) throw new Error("Data inválida");
      if (!isNotFutureDate(dateValue)) throw new Error("Não pode registrar produção futura");
      const liters = validateNumber(litersValue, 0, 1000);
      if (liters === null) throw new Error("Litros inválido (0-1000)");

      // Calcular alerta de produção baixa
      const monthRecords = state.milk.filter((record) => record.date?.startsWith(monthKey()));
      const monthAverage = monthRecords.length ? monthRecords.reduce((sum, r) => sum + Number(r.liters || 0), 0) / monthRecords.length : 0;
      const prodStatus = getProductionStatus(liters, monthAverage);

      await upsertMilk({
        date: dateValue,
        liters,
        user_id: currentUserId,
      });

      el.milkForm.reset();
      el.milkDate.value = todayIso();
      
      // Mostrar toast com alerta se produção está baixa
      if (prodStatus.status === "Crítico") {
        showToast(`⚠️ Produção crítica! ${formatLiters(liters)} (média: ${formatLiters(monthAverage)})`, "error");
      } else if (prodStatus.status === "Baixo") {
        showToast(`⚠️ Produção baixa. ${formatLiters(liters)} (média: ${formatLiters(monthAverage)})`, "sync");
      } else {
        showToast("Produção salva com sucesso! ✓", "success");
      }
      
      render();
    } catch (err) {
      if (err.authRequired) throw err;
      showToast(err.message || "Erro ao salvar produção", "error");
    }
  }, "Salvando..."));

  el.animalForm.addEventListener("submit", withButtonLoading(el.animalForm, async (event) => {
    event.preventDefault();

    try {
      const identification = $("#animalName").value.trim();
      if (!identification || identification.length > 100) throw new Error("ID do animal deve ter 1-100 caracteres");
      
      await insertAnimal({
        identification,
        type: $("#animalType").value,
        status: $("#animalStatus").value,
        user_id: currentUserId,
      });

      el.animalForm.reset();
      showToast("Animal cadastrado!");
      populateCowSelects();
      render();
    } catch (err) {
      if (err.authRequired) throw err;
      showToast(err.message || "Erro ao cadastrar animal", "error");
    }
  }, "Cadastrando..."));

  if (el.lactationForm) {
  el.lactationForm.addEventListener("submit", withButtonLoading(el.lactationForm, async (event) => {
    event.preventDefault();

    try {
      const startDate = $("#lactStart").value;
      const endDate = $("#lactEnd").value || null;
      const dailyLiters = Number.parseFloat($("#lactLiters").value || "0");

      if (!isValidDate(startDate)) throw new Error("Data de início inválida");
      if (endDate && !isValidDate(endDate)) throw new Error("Data de fim inválida");
      if (!isValidDateRange(startDate, endDate)) throw new Error("Data de fim não pode ser antes do início");
      
      const liters = validateNumber(dailyLiters, 0, 500);
      if (liters === null) throw new Error("Litros/dia inválido (0-500)");

      await insertLactation({
        cow_id: $("#lactCowId").value,
        start_date: startDate,
        end_date: endDate,
        daily_liters: liters,
      });

      el.lactationForm.reset();
      showToast("Lactação registrada!");
      render();
    } catch (err) {
      if (err.authRequired) throw err;
      showToast(err.message || "Erro ao registrar lactação", "error");
    }
  }, "Registrando..."));

  }

  el.breedingForm.addEventListener("submit", withButtonLoading(el.breedingForm, async (event) => {
    event.preventDefault();
    try {
      const insemDate = $("#inseminationDate").value;
      const calvingDate = $("#expectedCalving").value;

      if (!isValidDate(insemDate)) throw new Error("Data de inseminação inválida");
      if (!isValidDate(calvingDate)) throw new Error("Data de parto inválida");
      if (!isValidDateRange(insemDate, calvingDate)) throw new Error("Parto não pode ser antes de inseminação");

      await insertBreeding({
        cow_id: $("#breedCowId").value,
        insemination_date: insemDate,
        expected_calving_date: calvingDate,
      });
      el.breedingForm.reset();
      render();
      showToast("Reprodução registrada!");
    } catch (err) {
      if (err.authRequired) throw err;
      showToast(err.message || "Erro ao registrar reprodução", "error");
    }
  }, "Registrando..."));

  el.medicationForm.addEventListener("submit", withButtonLoading(el.medicationForm, async (event) => {
    event.preventDefault();

    try {
      const medName = $("#medName").value.trim();
      const medDate = $("#medDate").value;
      const medCowId = $("#medCowId").value;

      if (!medCowId) throw new Error("Selecione uma vaca");
      if (!medName || medName.length > 100) throw new Error("Medicamento deve ter 1-100 caracteres");
      if (!isValidDate(medDate)) throw new Error("Data de aplicação inválida");
      if (!isNotFutureDate(medDate)) throw new Error("Não pode registrar medicação futura");

      selectedMedicationCowId = medCowId;
      await insertMedication({
        cow_id: medCowId,
        medication_name: medName,
        dosage: $("#medDosage").value.trim().substring(0, 100),
        administration_date: medDate,
      });

      el.medicationForm.reset();
      $("#medCowId").value = selectedMedicationCowId;
      render();
      showToast("Medicação registrada!");
    } catch (err) {
      if (err.authRequired) throw err;
      showToast(err.message || "Erro ao registrar medicação", "error");
    }
  }, "Registrando..."));

  if (el.cropForm) {
    el.cropForm.addEventListener("submit", withButtonLoading(el.cropForm, async (event) => {
      event.preventDefault();

      try {
        const plotName = $("#cropPlot").value.trim();
        const cropName = $("#cropName").value.trim();
        const eventType = $("#cropEventType").value.trim();
        const eventDate = $("#cropDate").value;
        const areaTasksRaw = $("#cropAreaTasks").value;
        const areaTasks = areaTasksRaw ? validateNumber(areaTasksRaw, 0, 100000) : null;

        if (!plotName || plotName.length > 100) throw new Error("Talhão/área deve ter 1-100 caracteres");
        if (!cropName || cropName.length > 100) throw new Error("Cultura deve ter 1-100 caracteres");
        if (!eventType || eventType.length > 80) throw new Error("Manejo deve ter 1-80 caracteres");
        if (!isValidDate(eventDate)) throw new Error("Data inválida");
        if (!isNotFutureDate(eventDate)) throw new Error("Não pode registrar manejo futuro");
        if (areaTasksRaw && areaTasks === null) throw new Error("Área em tarefas inválida");

        await insertCropEvent({
          plot_name: plotName,
          crop_name: cropName,
          event_type: eventType,
          event_date: eventDate,
          product: $("#cropProduct").value.trim().substring(0, 120),
          dosage: $("#cropDosage").value.trim().substring(0, 80),
          area_tasks: areaTasks,
          notes: $("#cropNotes").value.trim().substring(0, 500),
        });

        el.cropForm.reset();
        $("#cropDate").value = todayIso();
        render();
        showToast("Manejo da lavoura salvo!");
      } catch (err) {
        if (err.authRequired) throw err;
        showToast(err.message || "Erro ao salvar manejo", "error");
      }
    }, "Salvando..."));
  }

  if (el.stockForm) {
    el.stockForm.addEventListener("submit", withButtonLoading(el.stockForm, async (event) => {
      event.preventDefault();

      try {
        await insertStockItem({
          item_name: $("#stockItemName").value,
          category: $("#stockCategory").value,
          quantity: $("#stockQuantity").value,
          unit: $("#stockUnit").value,
          min_quantity: $("#stockMinQuantity").value,
          notes: $("#stockNotes").value,
        });

        el.stockForm.reset();
        render();
        showToast("Item de estoque salvo!");
      } catch (err) {
        if (err.authRequired) throw err;
        showToast(err.message || "Erro ao salvar item", "error");
      }
    }, "Salvando..."));
  }

  if (el.reminderForm) {
    el.reminderForm.addEventListener("submit", withButtonLoading(el.reminderForm, async (event) => {
      event.preventDefault();

      try {
        await insertReminder({
          title: $("#reminderTitle").value,
          category: $("#reminderCategory").value,
          due_date: $("#reminderDate").value,
          notes: $("#reminderNotes").value,
        });

        el.reminderForm.reset();
        if (el.reminderDate) el.reminderDate.value = todayIso();
        render();
        showToast("Lembrete salvo!");
      } catch (err) {
        if (err.authRequired) throw err;
        showToast(err.message || "Erro ao salvar lembrete", "error");
      }
    }, "Salvando..."));
  }

  if (el.weatherForm) {
    el.weatherForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      try {
        const city = el.weatherCity.value.trim();
        if (!city || city.length > 120) throw new Error("Informe uma cidade valida.");
        await loadWeatherForecast(city);
      } catch (err) {
        showToast(err.message || "Erro ao buscar previsao", "error");
        if (el.weatherForecast) el.weatherForecast.innerHTML = empty("Nao foi possivel carregar a previsao.");
      }
    });
  }

  el.priceQuoteForm.addEventListener("submit", withButtonLoading(el.priceQuoteForm, async (event) => {
    event.preventDefault();

    try {
      const price = validateNumber(el.priceQuoteInput.value || "0", 0, 100);
      if (price === null) throw new Error("Cotação inválida (0-100)");
      
      await savePriceQuote(price);
      writeLocal();
      render();
      el.priceQuoteForm.reset();
      showToast("Cotação atualizada!");
    } catch (err) {
      if (err.authRequired) throw err;
      showToast(err.message || "Erro ao salvar cotação", "error");
    }
  }, "Salvando..."));

  if (el.clientProfileForm && !el.clientProfileForm._listenerAttached) {
    el.clientProfileForm._listenerAttached = true;
    el.clientProfileForm.addEventListener("submit", withButtonLoading(el.clientProfileForm, async (event) => {
      event.preventDefault();

      try {
        const profile = normalizeClientProfile(state.clientProfile);
        const nextProfile = {
          ...profile,
          farmName: el.farmNameInput.value.trim(),
          ownerName: el.ownerNameInput.value.trim(),
          whatsapp: el.clientWhatsappInput.value.trim(),
        };

        await saveClientProfile(nextProfile);
        writeLocal();
        render();
        showToast("Dados do cliente salvos!");
      } catch (err) {
        if (err.authRequired) throw err;
        showToast(err.message || "Erro ao salvar dados do cliente", "error");
      }
    }, "Salvando..."));
  }

  if (el.copyPixButton && !el.copyPixButton._listenerAttached) {
    el.copyPixButton._listenerAttached = true;
    el.copyPixButton.addEventListener("click", async () => {
      window.location.href = subscribeUrl();
    });
  }

  if (el.printReportButton && !el.printReportButton._listenerAttached) {
    el.printReportButton._listenerAttached = true;
    el.printReportButton.addEventListener("click", printCurrentReport);
  }

  if (el.onboardingForm && !el.onboardingForm._listenerAttached) {
    el.onboardingForm._listenerAttached = true;
    el.onboardingForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await completeOnboarding(false);
      } catch (err) {
        if (err.authRequired) throw err;
        showToast(err.message || "Erro ao concluir configuração inicial", "error");
      }
    });
  }

  if (el.skipOnboardingButton && !el.skipOnboardingButton._listenerAttached) {
    el.skipOnboardingButton._listenerAttached = true;
    el.skipOnboardingButton.addEventListener("click", async () => {
      try {
        await completeOnboarding(true);
      } catch (err) {
        showToast(err.message || "Não foi possível pular agora", "error");
      }
    });
  }

  if (!el.refreshButton._listenerAttached) {
    el.refreshButton._listenerAttached = true;
    el.refreshButton.addEventListener("click", loadData);
  }
  if (el.exportDataButton && !el.exportDataButton._listenerAttached) {
    el.exportDataButton._listenerAttached = true;
    el.exportDataButton.addEventListener("click", exportDataBackup);
  }
  el.milkDate.value = todayIso();
  if ($("#cropDate")) $("#cropDate").value = todayIso();
  if (el.reminderDate) el.reminderDate.value = todayIso();
  if (el.weatherCity) {
    el.weatherCity.value = localStorage.getItem(userStorageKey("weather_city")) || "";
  }

  // Registra subscription push (pede permissão se necessário)
  initPushNotifications();

  // Validação inline nos campos dos formulários
  setupInlineValidations();

  // Inicializa toggle de tema
  const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
  updateThemeToggleIcon(currentTheme);
  if (el.themeToggle) {
    el.themeToggle.addEventListener("click", () => {
      const next = toggleTheme();
      updateThemeToggleIcon(next);
    });
  }

  loadData();
};