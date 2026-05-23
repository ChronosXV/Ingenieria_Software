const CABA_CENTER = [-34.6037, -58.3816];
const CABA_BOUNDS = [
  [-34.705, -58.531],
  [-34.526, -58.335],
];

const DATA_PATHS = {
  barrios: "./data/barrios_caba.geojson",
  predictions: "./data/matriz_predicciones.json",
  metrics: "./data/metricas_modelo.json",
  featureImportance: "./data/feature_importance.json",
};

const barrioToComunaFallback = {
  AGRONOMIA: 15,
  ALMAGRO: 5,
  BALVANERA: 3,
  BARRACAS: 4,
  BELGRANO: 13,
  BOCA: 4,
  BOEDO: 5,
  CABALLITO: 6,
  CHACARITA: 15,
  COGHLAN: 12,
  COLEGIALES: 13,
  CONSTITUCION: 1,
  FLORES: 7,
  FLORESTA: 10,
  LINIERS: 9,
  MATADEROS: 9,
  MONSERRAT: 1,
  "MONTE CASTRO": 10,
  "NUEVA POMPEYA": 4,
  NUNEZ: 13,
  "NUÑEZ": 13,
  PALERMO: 14,
  "PARQUE AVELLANEDA": 9,
  "PARQUE CHACABUCO": 7,
  "PARQUE CHAS": 15,
  "PARQUE PATRICIOS": 4,
  PATERNAL: 15,
  "PUERTO MADERO": 1,
  RECOLETA: 2,
  RETIRO: 1,
  SAAVEDRA: 12,
  "SAN CRISTOBAL": 3,
  "SAN NICOLAS": 1,
  "SAN TELMO": 1,
  "VELEZ SARSFIELD": 10,
  VERSALLES: 10,
  "VILLA CRESPO": 15,
  "VILLA DEL PARQUE": 11,
  "VILLA DEVOTO": 11,
  "VILLA GENERAL MITRE": 11,
  "VILLA LUGANO": 8,
  "VILLA LURO": 10,
  "VILLA ORTUZAR": 15,
  "VILLA PUEYRREDON": 12,
  "VILLA REAL": 10,
  "VILLA RIACHUELO": 8,
  "VILLA SANTA RITA": 11,
  "VILLA SOLDATI": 8,
  "VILLA URQUIZA": 12,
};

const appState = {
  map: null,
  barriosLayer: null,
  clickMarker: null,
  barriosGeoJson: null,
  barrioFeatures: [],
  predictionIndexes: null,
  featureChart: null,
};

const resultPanel = document.getElementById("resultPanel");
const mapStatus = document.getElementById("mapStatus");
const metricsSection = document.getElementById("metricsSection");
const metricsContent = document.getElementById("metricsContent");
const featureSection = document.getElementById("featureSection");
const featureContent = document.getElementById("featureContent");

document.addEventListener("DOMContentLoaded", () => {
  renderEmptyState();
  initializeMap();
  initializeApp().catch((error) => {
    console.error("Error general al inicializar la app:", error);
    renderMessageState(
      "No se pudo inicializar completamente la aplicación",
      "Verificá que los archivos JSON estén disponibles y abrí el proyecto con un servidor estático como Live Server o GitHub Pages.",
      "warning"
    );
    updateMapStatus("No se pudieron cargar todos los recursos necesarios.", "error");
  });
});

async function initializeApp() {
  const [barriosGeoJson, predictionRows, metrics, featureImportance] = await Promise.all([
    fetchJson(DATA_PATHS.barrios),
    fetchJson(DATA_PATHS.predictions),
    fetchJson(DATA_PATHS.metrics, { optional: true }),
    fetchJson(DATA_PATHS.featureImportance, { optional: true }),
  ]);

  appState.barriosGeoJson = barriosGeoJson;
  appState.barrioFeatures = Array.isArray(barriosGeoJson?.features) ? barriosGeoJson.features : [];
  appState.predictionIndexes = buildPredictionIndexes(predictionRows);

  renderBarriosLayer(barriosGeoJson);
  renderModelMetrics(metrics);
  renderFeatureImportance(featureImportance);

  updateMapStatus(
    `Capas cargadas: ${appState.barrioFeatures.length} barrios y ${predictionRows.length.toLocaleString(
      "es-AR"
    )} combinaciones predictivas.`,
    "ready"
  );
}

function initializeMap() {
  appState.map = L.map("map", {
    zoomControl: true,
    minZoom: 11,
    maxZoom: 17,
    maxBounds: CABA_BOUNDS,
    maxBoundsViscosity: 0.8,
  }).setView(CABA_CENTER, 12.4);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(appState.map);

  appState.map.on("click", handleMapClick);
}

async function fetchJson(path, options = {}) {
  const { optional = false } = options;

  try {
    const response = await fetch(path);

    if (!response.ok) {
      if (optional) {
        return null;
      }

      throw new Error(`No se pudo cargar ${path} (${response.status})`);
    }

    return await response.json();
  } catch (error) {
    if (optional) {
      console.warn(`Archivo opcional no disponible: ${path}`, error);
      return null;
    }

    throw error;
  }
}

function renderBarriosLayer(geoJson) {
  if (!geoJson || !Array.isArray(geoJson.features)) {
    throw new Error("El GeoJSON de barrios no tiene un formato válido.");
  }

  const defaultStyle = {
    color: "#2d6a6d",
    weight: 1.2,
    fillColor: "#79b8b1",
    fillOpacity: 0.18,
  };

  const hoverStyle = {
    color: "#114b5f",
    weight: 2.3,
    fillColor: "#2d6a6d",
    fillOpacity: 0.28,
  };

  appState.barriosLayer = L.geoJSON(geoJson, {
    style: defaultStyle,
    onEachFeature: (feature, layer) => {
      const barrio = getBarrioFromProperties(feature.properties) || "Barrio no identificado";
      const comuna = getComunaFromProperties(feature.properties, barrio) || "Sin dato";

      layer.bindTooltip(`${barrio} · Comuna ${comuna}`, {
        sticky: true,
        direction: "top",
      });

      layer.on({
        mouseover: () => {
          layer.setStyle(hoverStyle);
          layer.bringToFront();
        },
        mouseout: () => {
          appState.barriosLayer.resetStyle(layer);
        },
        click: () => {
          const center = layer.getBounds().getCenter();
          appState.map.flyTo(center, Math.max(appState.map.getZoom(), 13), {
            duration: 0.45,
          });
        },
      });
    },
  }).addTo(appState.map);
}

function buildPredictionIndexes(rows) {
  if (!Array.isArray(rows)) {
    throw new Error("La matriz de predicciones no es un arreglo válido.");
  }

  const indexes = {
    exact: new Map(),
    byBarrioComunaFranjaTurno: new Map(),
    byBarrioComunaTurno: new Map(),
    byBarrioComuna: new Map(),
  };

  rows.forEach((row) => {
    const normalized = normalizePredictionRow(row);

    indexes.exact.set(
      buildKey(
        normalized.barrio,
        normalized.comuna,
        normalized.mes_num,
        normalized.dia_num,
        normalized.fin_semana,
        normalized.franja,
        normalized.turno
      ),
      row
    );

    setFirstMatch(
      indexes.byBarrioComunaFranjaTurno,
      buildKey(normalized.barrio, normalized.comuna, normalized.franja, normalized.turno),
      row
    );
    setFirstMatch(
      indexes.byBarrioComunaTurno,
      buildKey(normalized.barrio, normalized.comuna, normalized.turno),
      row
    );
    setFirstMatch(indexes.byBarrioComuna, buildKey(normalized.barrio, normalized.comuna), row);
  });

  return indexes;
}

function setFirstMatch(map, key, value) {
  if (!map.has(key)) {
    map.set(key, value);
  }
}

function normalizePredictionRow(row) {
  return {
    barrio: normalizeText(row?.barrio),
    comuna: Number(row?.comuna),
    mes_num: Number(row?.mes_num),
    dia_num: Number(row?.dia_num),
    fin_semana: Number(row?.fin_semana),
    franja: String(row?.franja ?? "").trim(),
    turno: normalizeText(row?.turno),
  };
}

function buildKey(...parts) {
  return parts.join("|");
}

function normalizeText(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function getBarrioFromProperties(properties) {
  if (!properties || typeof properties !== "object") {
    return "";
  }

  const preferredKeys = ["BARRIO", "barrio", "Barrio", "NOMBRE", "nombre", "name", "Name"];

  for (const key of preferredKeys) {
    if (properties[key]) {
      return String(properties[key]).trim();
    }
  }

  for (const [key, value] of Object.entries(properties)) {
    if (normalizeText(key).includes("BARRIO") && value) {
      return String(value).trim();
    }
  }

  return "";
}

function getComunaFromProperties(properties, barrio) {
  if (properties && typeof properties === "object") {
    const preferredKeys = ["COMUNA", "comuna", "Comuna", "COM", "com"];

    for (const key of preferredKeys) {
      const candidate = parseComunaValue(properties[key]);
      if (candidate) {
        return candidate;
      }
    }

    for (const [key, value] of Object.entries(properties)) {
      if (normalizeText(key).includes("COMUNA")) {
        const candidate = parseComunaValue(value);
        if (candidate) {
          return candidate;
        }
      }
    }
  }

  return barrioToComunaFallback[normalizeText(barrio)] || null;
}

function parseComunaValue(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function getTemporalContext() {
  const now = new Date();
  const hour = now.getHours();
  const jsDay = now.getDay();
  const diaNum = jsDay === 0 ? 7 : jsDay;
  const finSemana = diaNum >= 6 ? 1 : 0;

  return {
    now,
    hour,
    mesNum: now.getMonth() + 1,
    diaNum,
    finSemana,
    franja: getFranjaFromHour(hour),
    turno: getTurnoFromHour(hour),
    fechaTexto: new Intl.DateTimeFormat("es-AR", {
      dateStyle: "full",
    }).format(now),
    horaTexto: new Intl.DateTimeFormat("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(now),
    diaLabel: new Intl.DateTimeFormat("es-AR", {
      weekday: "long",
    }).format(now),
  };
}

function getTurnoFromHour(hour) {
  if (hour >= 0 && hour <= 5) return "Madrugada";
  if (hour >= 6 && hour <= 11) return "Mañana";
  if (hour >= 12 && hour <= 17) return "Tarde";
  return "Noche";
}

function getFranjaFromHour(hour) {
  // El modelo actual usa horas enteras como string: "0", "1", ..., "23".
  // Si en el futuro la matriz se genera con rangos ("22-23"), este es el punto
  // donde conviene adaptar la salida sin tocar el resto de la lógica.
  return String(hour);
}

function handleMapClick(event) {
  try {
    if (!appState.barriosGeoJson || !appState.predictionIndexes) {
      renderMessageState(
        "Los datos todavía no están listos",
        "Esperá unos segundos y probá nuevamente cuando termine la carga inicial.",
        "warning"
      );
      return;
    }

    const { lat, lng } = event.latlng;
    const point = turf.point([lng, lat]);
    const matchedFeature = appState.barrioFeatures.find((feature) => {
      try {
        return turf.booleanPointInPolygon(point, feature);
      } catch (error) {
        console.warn("No se pudo evaluar un polígono:", error);
        return false;
      }
    });

    if (!matchedFeature) {
      renderMessageState(
        "No se detectó un barrio de CABA para el punto seleccionado",
        "Probá seleccionando otra zona dentro del mapa.",
        "warning"
      );
      setClickMarker(lat, lng, "Punto fuera de un polígono de barrio");
      return;
    }

    const barrio = getBarrioFromProperties(matchedFeature.properties);
    const comuna = getComunaFromProperties(matchedFeature.properties, barrio);
    const temporalContext = getTemporalContext();

    const criteria = {
      barrio,
      comuna,
      mes_num: temporalContext.mesNum,
      dia_num: temporalContext.diaNum,
      fin_semana: temporalContext.finSemana,
      franja: temporalContext.franja,
      turno: temporalContext.turno,
    };

    const predictionMatch = findPrediction(criteria);

    setClickMarker(lat, lng, `${barrio} · Comuna ${comuna}`);
    renderPrediction({
      lat,
      lng,
      barrio,
      comuna,
      temporalContext,
      predictionMatch,
    });
  } catch (error) {
    console.error("Error al procesar el clic del mapa:", error);
    renderMessageState(
      "Ocurrió un error al procesar la selección",
      "La app siguió funcionando, pero no se pudo calcular la estimación para este punto. Probá nuevamente.",
      "warning"
    );
  }
}

function findPrediction(criteria) {
  const normalizedBarrio = normalizeText(criteria.barrio);
  const normalizedTurno = normalizeText(criteria.turno);
  const comuna = Number(criteria.comuna);

  const exactKey = buildKey(
    normalizedBarrio,
    comuna,
    Number(criteria.mes_num),
    Number(criteria.dia_num),
    Number(criteria.fin_semana),
    String(criteria.franja),
    normalizedTurno
  );

  const exact = appState.predictionIndexes.exact.get(exactKey);
  if (exact) {
    return { source: "Coincidencia exacta", data: exact };
  }

  const fallback1 = appState.predictionIndexes.byBarrioComunaFranjaTurno.get(
    buildKey(normalizedBarrio, comuna, String(criteria.franja), normalizedTurno)
  );
  if (fallback1) {
    return { source: "Fallback 1: barrio + comuna + franja + turno", data: fallback1 };
  }

  const fallback2 = appState.predictionIndexes.byBarrioComunaTurno.get(
    buildKey(normalizedBarrio, comuna, normalizedTurno)
  );
  if (fallback2) {
    return { source: "Fallback 2: barrio + comuna + turno", data: fallback2 };
  }

  const fallback3 = appState.predictionIndexes.byBarrioComuna.get(
    buildKey(normalizedBarrio, comuna)
  );
  if (fallback3) {
    return { source: "Fallback 3: barrio + comuna", data: fallback3 };
  }

  return null;
}

function renderEmptyState() {
  resultPanel.innerHTML = `
    <div class="empty-state">
      <h3>Seleccioná un punto dentro de la Ciudad de Buenos Aires</h3>
      <p>
        Seleccioná un punto dentro de la Ciudad de Buenos Aires para obtener una estimación del
        tipo de delito más probable según el modelo.
      </p>
    </div>
  `;
}

function renderMessageState(title, message, tone = "warning") {
  resultPanel.innerHTML = `
    <div class="message-card is-${tone}">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function renderPrediction({ lat, lng, barrio, comuna, temporalContext, predictionMatch }) {
  const dateInfo = temporalContext.fechaTexto;
  const timeInfo = temporalContext.horaTexto;

  if (!predictionMatch?.data) {
    resultPanel.innerHTML = `
      <article class="result-card">
        <div class="detail-block">
          <h4>Zona seleccionada</h4>
          <div class="detail-list">
            <div><strong>Barrio:</strong> ${escapeHtml(barrio || "Sin identificar")}</div>
            <div><strong>Comuna:</strong> ${escapeHtml(String(comuna || "Sin dato"))}</div>
            <div><strong>Latitud:</strong> ${formatCoordinate(lat)}</div>
            <div><strong>Longitud:</strong> ${formatCoordinate(lng)}</div>
          </div>
        </div>
        <div class="detail-block">
          <h4>Contexto temporal</h4>
          <div class="detail-list">
            <div><strong>Fecha actual:</strong> ${capitalize(dateInfo)}</div>
            <div><strong>Hora actual:</strong> ${escapeHtml(timeInfo)}</div>
            <div><strong>Mes:</strong> ${temporalContext.mesNum}</div>
            <div><strong>Día de la semana:</strong> ${capitalize(temporalContext.diaLabel)} (${temporalContext.diaNum})</div>
            <div><strong>Franja:</strong> ${escapeHtml(temporalContext.franja)}</div>
            <div><strong>Turno:</strong> ${escapeHtml(temporalContext.turno)}</div>
            <div><strong>Fin de semana:</strong> ${temporalContext.finSemana ? "Sí" : "No"}</div>
          </div>
        </div>
        <div class="message-card is-warning">
          <h3>No hay predicción disponible para esta combinación</h3>
          <p>
            No se encontró una coincidencia exacta ni en los fallbacks previstos para el barrio,
            comuna y contexto temporal seleccionado.
          </p>
        </div>
      </article>
    `;
    return;
  }

  const prediction = predictionMatch.data;
  const probabilityPercent = formatPercentage(prediction.probabilidad);
  const top3 = Array.isArray(prediction.top_3) ? prediction.top_3 : [];

  resultPanel.innerHTML = `
    <article class="result-card result-card--prediction">
      <div class="prediction-hero">
        <div>
          <span class="prediction-tag">${escapeHtml(predictionMatch.source)}</span>
          <h3 class="prediction-title">${escapeHtml(toTitleCase(prediction.tipo_predicho || "Sin dato"))}</h3>
        </div>
        <div class="probability-badge">
          <span class="probability-badge__value">${probabilityPercent}</span>
          <span class="probability-badge__label">Probabilidad estimada</span>
        </div>
      </div>

      <div class="result-grid">
        <div class="detail-block">
          <h4>Zona seleccionada</h4>
          <div class="detail-list">
            <div><strong>Barrio:</strong> ${escapeHtml(barrio || "Sin identificar")}</div>
            <div><strong>Comuna:</strong> ${escapeHtml(String(comuna || "Sin dato"))}</div>
            <div><strong>Latitud:</strong> ${formatCoordinate(lat)}</div>
            <div><strong>Longitud:</strong> ${formatCoordinate(lng)}</div>
          </div>
        </div>

        <div class="detail-block">
          <h4>Contexto temporal</h4>
          <div class="detail-list">
            <div><strong>Fecha actual:</strong> ${capitalize(dateInfo)}</div>
            <div><strong>Hora actual:</strong> ${escapeHtml(timeInfo)}</div>
            <div><strong>Mes:</strong> ${temporalContext.mesNum}</div>
            <div><strong>Día de la semana:</strong> ${capitalize(temporalContext.diaLabel)} (${temporalContext.diaNum})</div>
            <div><strong>Franja:</strong> ${escapeHtml(temporalContext.franja)}</div>
            <div><strong>Turno:</strong> ${escapeHtml(temporalContext.turno)}</div>
            <div><strong>Fin de semana:</strong> ${temporalContext.finSemana ? "Sí" : "No"}</div>
          </div>
        </div>
      </div>

      <div class="detail-block">
        <h4>Resultado del modelo</h4>
        <div class="detail-list">
          <div><strong>Tipo de delito más probable:</strong> ${escapeHtml(toTitleCase(prediction.tipo_predicho || "Sin dato"))}</div>
          <div><strong>Probabilidad estimada:</strong> ${probabilityPercent}</div>
          <div><strong>Registro utilizado:</strong> ${escapeHtml(predictionMatch.source)}</div>
        </div>
        ${renderTop3Markup(top3)}
      </div>

      <p class="prediction-note">
        Según los patrones históricos analizados, para esta zona y contexto temporal, el modelo
        estima como más probable el tipo de delito indicado. Esta información debe interpretarse
        como una referencia estadística y no como una certeza.
      </p>
    </article>
  `;
}

function renderTop3Markup(top3) {
  if (!top3.length) {
    return '<p class="prediction-note" style="margin-top: 12px;">No hay información Top 3 disponible para este registro.</p>';
  }

  const items = top3
    .slice(0, 3)
    .map((entry) => {
      const percentage = clampPercentage(entry?.probabilidad);
      return `
        <li>
          <strong>${escapeHtml(toTitleCase(entry?.tipo || "Sin dato"))}</strong>
          <div class="bar-track"><div class="bar-fill" style="width: ${percentage}%;"></div></div>
          <span>${formatPercentage(entry?.probabilidad)}</span>
        </li>
      `;
    })
    .join("");

  return `
    <ul class="top-list" aria-label="Top 3 de delitos estimados">
      ${items}
    </ul>
  `;
}

function renderModelMetrics(metrics) {
  if (!metrics || typeof metrics !== "object" || Object.keys(metrics).length === 0) {
    metricsSection.classList.add("is-hidden");
    return;
  }

  const metricItems = [
    { label: "Accuracy", value: metrics.accuracy },
    { label: "Precision", value: metrics.precision_macro },
    { label: "Recall", value: metrics.recall_macro },
    { label: "F1-score", value: metrics.f1_macro },
  ];

  metricsContent.innerHTML = `
    <div class="metrics-grid">
      ${metricItems
        .map(
          (item) => `
            <div class="metric-tile">
              <span class="metric-tile__label">${escapeHtml(item.label)}</span>
              <span class="metric-tile__value">${formatMetric(item.value)}</span>
            </div>
          `
        )
        .join("")}
    </div>
    <p class="metrics-meta">
      <strong>Modelo:</strong> ${escapeHtml(metrics.modelo || "No especificado")}<br />
      ${escapeHtml(
        metrics.descripcion ||
          "Modelo de clasificación supervisada entrenado para predecir el tipo de delito."
      )}
    </p>
  `;

  metricsSection.classList.remove("is-hidden");
}

function renderFeatureImportance(featureImportance) {
  if (!Array.isArray(featureImportance) || featureImportance.length === 0) {
    featureSection.classList.add("is-hidden");
    return;
  }

  const sorted = [...featureImportance]
    .filter((item) => item && item.feature !== undefined && item.importance !== undefined)
    .sort((a, b) => Number(b.importance) - Number(a.importance));

  if (!sorted.length) {
    featureSection.classList.add("is-hidden");
    return;
  }

  featureSection.classList.remove("is-hidden");

  if (appState.featureChart) {
    appState.featureChart.destroy();
  }

  const canvas = document.getElementById("featureChart");

  appState.featureChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: sorted.map((item) => item.feature),
      datasets: [
        {
          label: "Importancia",
          data: sorted.map((item) => Number(item.importance)),
          borderRadius: 8,
          backgroundColor: ["#114b5f", "#1b6270", "#2d6a6d", "#42858a", "#7cbcb2"],
          borderSkipped: false,
        },
      ],
    },
    options: {
      indexAxis: "y",
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: (context) =>
              `Importancia: ${Number(context.parsed.x).toLocaleString("es-AR", {
                minimumFractionDigits: 3,
                maximumFractionDigits: 3,
              })}`,
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: {
            color: "rgba(17, 75, 95, 0.08)",
          },
        },
        y: {
          grid: {
            display: false,
          },
        },
      },
    },
  });
}

function setClickMarker(lat, lng, popupText) {
  if (!appState.map) return;

  if (appState.clickMarker) {
    appState.clickMarker.remove();
  }

  appState.clickMarker = L.circleMarker([lat, lng], {
    radius: 8,
    color: "#f4f8fa",
    weight: 2,
    fillColor: "#114b5f",
    fillOpacity: 0.95,
  })
    .addTo(appState.map)
    .bindPopup(`<strong>${escapeHtml(popupText)}</strong>`);
}

function updateMapStatus(message, status = "loading") {
  mapStatus.textContent = message;
  mapStatus.className = `status-chip is-${status}`;
}

function formatCoordinate(value) {
  return Number(value).toLocaleString("es-AR", {
    minimumFractionDigits: 5,
    maximumFractionDigits: 5,
  });
}

function clampPercentage(value) {
  const numeric = Number(value) * 100;
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, numeric));
}

function formatPercentage(value) {
  const percentage = clampPercentage(value);
  return `${percentage.toLocaleString("es-AR", {
    minimumFractionDigits: percentage < 10 ? 1 : 0,
    maximumFractionDigits: 1,
  })}%`;
}

function formatMetric(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "N/D";
  }

  return numeric.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function toTitleCase(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function capitalize(text) {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
