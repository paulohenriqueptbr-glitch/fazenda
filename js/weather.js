import { userStorageKey } from "./state.js";
import { escapeHtml, formatDate } from "./ui.js";

const WEATHER_CACHE_KEY = "last_weather_forecast";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

let weatherForecastEl = null;

export const setWeatherElements = (forecastEl) => {
  weatherForecastEl = forecastEl;
};

export const renderWeatherForecast = (data) => {
  if (!weatherForecastEl) return;
  const locationParts = [data.location?.name, data.location?.region, data.location?.country].filter(Boolean);
  const days = Array.isArray(data.forecast) ? data.forecast : [];
  weatherForecastEl.innerHTML = `
    <div class="weather-header"><div><span>Previsao do tempo</span><strong>${escapeHtml(locationParts.join(" - ") || "Local informado")}</strong></div><small>${escapeHtml(data.source || "Open-Meteo")}</small></div>
    <div class="weather-grid">${days.map((d) => `<article class="weather-day"><span>${escapeHtml(formatDate(d.date))}</span><strong>${escapeHtml(d.condition || "Tempo variavel")}</strong><small>${escapeHtml(`${Number(d.temperatureMin ?? 0).toLocaleString("pt-BR")} a ${Number(d.temperatureMax ?? 0).toLocaleString("pt-BR")} C`)}</small><small>${escapeHtml(`Chuva: ${d.precipitationProbability ?? 0}% | ${d.precipitationMm ?? 0} mm`)}</small><small>${escapeHtml(`Vento: ${d.windSpeedKmh ?? 0} km/h`)}</small></article>`).join("")}</div>`;
};

export const loadWeatherForecast = async (city) => {
  if (!weatherForecastEl) return;

  const cached = localStorage.getItem(WEATHER_CACHE_KEY);
  if (cached) {
    try {
      const cacheData = JSON.parse(cached);
      if (cacheData.city === city && cacheData.data && cacheData.timestamp) {
        const isCacheFresh = (Date.now() - cacheData.timestamp) < CACHE_TTL_MS;
        if (!navigator.onLine || isCacheFresh) {
          renderWeatherForecast(cacheData.data);
          const updated = new Date(cacheData.timestamp);
          const timeStr = updated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
          const dateStr = updated.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
          if (weatherForecastEl) {
            const header = weatherForecastEl.querySelector(".weather-header small");
            if (header) header.textContent = `${escapeHtml(cacheData.data.source || "Open-Meteo")} (Atualizado: ${dateStr} ${timeStr})`;
          }
          if (!navigator.onLine) return;
        }
      }
    } catch { /* invalid cache — ignore */ }
  }

  weatherForecastEl.innerHTML = `
    <div class="weather-header skeleton skeleton-card">
      <span>Previsão do tempo</span>
      <strong>Carregando...</strong>
    </div>
    <div class="weather-grid">
      ${[1,2,3].map(() => '<article class="weather-day skeleton skeleton-card"><span>&nbsp;</span><strong>&nbsp;</strong><small>&nbsp;</small></article>').join('')}
    </div>`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(`/api/weather?city=${encodeURIComponent(city)}`, { signal: controller.signal });
    clearTimeout(timeoutId);
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || "Nao foi possivel buscar a previsao.");
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ city, data, timestamp: Date.now() }));
    localStorage.setItem(userStorageKey("weather_city"), city);
    renderWeatherForecast(data);
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Tempo limite excedido. Verifique sua conexão.");
    }
    if (cached) {
      try {
        const cacheData = JSON.parse(cached);
        if (cacheData.city === city && cacheData.data) {
          renderWeatherForecast(cacheData.data);
          return;
        }
      } catch { /* ignore */ }
    }
    throw err;
  }
};
