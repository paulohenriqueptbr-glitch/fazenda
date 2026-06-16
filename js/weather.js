
const renderWeatherForecast = (data) => {
  if (!el.weatherForecast) return;

  const locationParts = [data.location?.name, data.location?.region, data.location?.country].filter(Boolean);
  const days = Array.isArray(data.forecast) ? data.forecast : [];

  el.weatherForecast.innerHTML = `
    <div class="weather-header">
      <div>
        <span>Previsao do tempo</span>
        <strong>${escapeHtml(locationParts.join(" - ") || "Local informado")}</strong>
      </div>
      <small>${escapeHtml(data.source || "Open-Meteo")}</small>
    </div>
    <div class="weather-grid">
      ${days.map((day) => `
        <article class="weather-day">
          <span>${escapeHtml(formatDate(day.date))}</span>
          <strong>${escapeHtml(day.condition || "Tempo variavel")}</strong>
          <small>${escapeHtml(`${Number(day.temperatureMin ?? 0).toLocaleString("pt-BR")} a ${Number(day.temperatureMax ?? 0).toLocaleString("pt-BR")} C`)}</small>
          <small>${escapeHtml(`Chuva: ${day.precipitationProbability ?? 0}% | ${day.precipitationMm ?? 0} mm`)}</small>
          <small>${escapeHtml(`Vento: ${day.windSpeedKmh ?? 0} km/h`)}</small>
        </article>
      `).join("")}
    </div>
  `;
};

const loadWeatherForecast = async (city) => {
  if (!el.weatherForecast) return;
  el.weatherForecast.innerHTML = `<p class="empty">Buscando previsao...</p>`;

  const response = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || "Nao foi possivel buscar a previsao.");

  localStorage.setItem(userStorageKey("weather_city"), city);
  renderWeatherForecast(data);
};