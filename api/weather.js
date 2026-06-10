const WEATHER_CODES = {
  0: "Ceu limpo",
  1: "Poucas nuvens",
  2: "Parcialmente nublado",
  3: "Nublado",
  45: "Neblina",
  48: "Neblina com geada",
  51: "Garoa fraca",
  53: "Garoa moderada",
  55: "Garoa forte",
  61: "Chuva fraca",
  63: "Chuva moderada",
  65: "Chuva forte",
  80: "Pancadas fracas",
  81: "Pancadas moderadas",
  82: "Pancadas fortes",
  95: "Trovoadas",
  96: "Trovoadas com granizo",
  99: "Trovoadas fortes com granizo",
};

const sendJson = (response, status, payload) => {
  response.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  response.send(JSON.stringify(payload));
};

const parseNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const fetchJson = async (url) => {
  const response = await fetch(url);
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.reason || data?.error || `Servico retornou ${response.status}`);
  return data;
};

const resolveLocation = async (query) => {
  const latitude = parseNumber(query.latitude ?? query.lat);
  const longitude = parseNumber(query.longitude ?? query.lon ?? query.lng);

  if (latitude !== null && longitude !== null) {
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw new Error("Coordenadas invalidas.");
    }
    return {
      name: query.name || "Local informado",
      region: "",
      country: "",
      latitude,
      longitude,
    };
  }

  const city = String(query.city || query.q || "").trim();
  if (!city || city.length > 120) throw new Error("Informe uma cidade valida.");

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", city);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "pt");
  url.searchParams.set("format", "json");

  const data = await fetchJson(url);
  const result = data?.results?.[0];
  if (!result) throw new Error("Cidade nao encontrada.");

  return {
    name: result.name,
    region: result.admin1 || "",
    country: result.country || "",
    latitude: result.latitude,
    longitude: result.longitude,
  };
};

const formatDailyForecast = (daily = {}) => {
  const dates = daily.time || [];
  return dates.map((date, index) => ({
    date,
    condition: WEATHER_CODES[daily.weather_code?.[index]] || "Tempo variavel",
    weatherCode: daily.weather_code?.[index] ?? null,
    temperatureMax: daily.temperature_2m_max?.[index] ?? null,
    temperatureMin: daily.temperature_2m_min?.[index] ?? null,
    precipitationProbability: daily.precipitation_probability_max?.[index] ?? null,
    precipitationMm: daily.precipitation_sum?.[index] ?? null,
    windSpeedKmh: daily.wind_speed_10m_max?.[index] ?? null,
  }));
};

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendJson(response, 405, { error: "Metodo nao permitido." });
    return;
  }

  try {
    const location = await resolveLocation(request.query || {});
    const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
    forecastUrl.searchParams.set("latitude", String(location.latitude));
    forecastUrl.searchParams.set("longitude", String(location.longitude));
    forecastUrl.searchParams.set("forecast_days", "5");
    forecastUrl.searchParams.set("timezone", "auto");
    forecastUrl.searchParams.set("daily", [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "precipitation_sum",
      "wind_speed_10m_max",
    ].join(","));

    const forecast = await fetchJson(forecastUrl);

    sendJson(response, 200, {
      location,
      units: forecast.daily_units || {},
      forecast: formatDailyForecast(forecast.daily),
      source: "Open-Meteo",
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    sendJson(response, 400, { error: error.message || "Nao foi possivel buscar a previsao." });
  }
};
