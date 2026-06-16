const renderDashboard = async () => {
  const dailyActionList = document.getElementById("dailyActionList");
  const dailyFocusTitle = document.getElementById("dailyFocusTitle");
  const dailyFocusText = document.getElementById("dailyFocusText");

  if (!dailyActionList) return;

  const today = todayIso();
  let actionsHtml = "";
  let pendingCount = 0;

  // 1. Produção Pendente
  const hasMilkToday = state.milk.some((m) => m.date === today);
  if (!hasMilkToday) {
    actionsHtml += `
      <div class="alert-card critical">
        <div class="alert-content">
          <h4>Produção de Hoje</h4>
          <p>Você ainda não registrou o leite de hoje.</p>
        </div>
        <button type="button" class="action-btn" onclick="document.querySelector('[data-tab=\\'milk\\']').click()">Registrar</button>
      </div>`;
    pendingCount++;
  }

  // 2. Alertas Urgentes (Atrasados ou Hoje)
  const allAlerts = buildAlerts();
  const urgentAlerts = allAlerts.filter(a => alertStatus(a.due_date) === "overdue" || alertStatus(a.due_date) === "today");
  
  urgentAlerts.slice(0, 3).forEach(alert => {
    let actionBtn = "";
    if (alert.category === "Leite") {
      actionBtn = `<button type="button" class="action-btn" onclick="document.querySelector('[data-tab=\\'milk\\']').click()">Registrar</button>`;
    } else if (alert.category === "Gestacao" || alert.category === "Gestação") {
      actionBtn = `<button type="button" class="action-btn" onclick="document.querySelector('[data-tab=\\'breeding\\']').click()">Ver</button>`;
    } else if (alert.category === "Estoque") {
      actionBtn = `<button type="button" class="action-btn" onclick="document.querySelector('[data-tab=\\'stock\\']').click()">Atualizar</button>`;
    } else {
      actionBtn = `<button type="button" class="action-btn ghost" onclick="document.querySelector('[data-tab=\\'alerts\\']').click()">Ver alerta</button>`;
    }

    actionsHtml += `
      <div class="alert-card ${alertStatus(alert.due_date) === 'overdue' ? 'critical' : 'warning'}">
        <div class="alert-content">
          <h4>${escapeHtml(alert.title)}</h4>
          <p>${alertStatusLabel(alert.due_date)}</p>
        </div>
        ${actionBtn}
      </div>`;
    pendingCount++;
  });

  // 3. Estoque Baixo
  const lowStock = state.stockItems.filter(s => s.quantity <= (s.min_quantity || 0));
  lowStock.forEach(item => {
    actionsHtml += `
      <div class="alert-card warning">
        <div class="alert-content">
          <h4>Estoque Baixo: ${escapeHtml(item.name)}</h4>
          <p>Restam apenas ${formatStockQuantity(item.quantity, item.unit)}</p>
        </div>
        <button type="button" class="action-btn" onclick="document.querySelector('[data-tab=\\'stock\\']').click()">Comprar</button>
      </div>`;
    pendingCount++;
  });

  // 4. Previsão do tempo automática
  const city = localStorage.getItem('weather_city') || "Sua cidade"; // Pode vir do profile futuramente
  actionsHtml += `
    <div class="alert-card info weather-mini-card">
      <div class="alert-content">
        <h4>Clima em ${escapeHtml(city)}</h4>
        <p id="miniWeatherDesc">Carregando previsão...</p>
      </div>
      <button type="button" class="action-btn ghost" onclick="document.querySelector('[data-tab=\\'alerts\\']').click()">Ver mais</button>
    </div>`;

  dailyActionList.innerHTML = actionsHtml || "<p class='empty'>Tudo certo por hoje!</p>";

  // Título dinâmico
  const farmName = state.clientProfile?.farmName ? `na ${state.clientProfile.farmName}` : "na fazenda";
  if (pendingCount > 0) {
    dailyFocusTitle.textContent = `Você tem ${pendingCount} pendência${pendingCount > 1 ? 's' : ''} ${farmName}`;
    dailyFocusText.textContent = "Resolva os itens abaixo para manter a gestão em dia.";
  } else {
    dailyFocusTitle.textContent = `Tudo em dia ${farmName}!`;
    dailyFocusText.textContent = "Bom trabalho. Suas principais tarefas estão resolvidas.";
  }

  // Chamar clima se tivermos cidade salva
  if (localStorage.getItem('weather_city')) {
    loadMiniWeather(localStorage.getItem('weather_city'));
  }
};

const loadMiniWeather = async (city) => {
  const descEl = document.getElementById("miniWeatherDesc");
  if (!descEl) return;
  try {
    const res = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    if (data.daily && data.daily.time && data.daily.time.length > 0) {
      const maxTemp = data.daily.temperature_2m_max[0];
      const minTemp = data.daily.temperature_2m_min[0];
      const rain = data.daily.precipitation_sum[0];
      descEl.textContent = `Máx ${maxTemp}°C / Min ${minTemp}°C. Chuva: ${rain}mm`;
    }
  } catch (err) {
    descEl.textContent = "Não foi possível carregar a previsão.";
  }
};
