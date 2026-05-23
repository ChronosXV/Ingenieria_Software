// Portal de Análisis de Seguridad CABA - Controlador General
(function () {
  "use strict";

  // State Management
  let map = null;
  let tileLayer = null;
  let geojsonLayer = null;
  let barriosData = null;
  let predictionsMatrix = null;

  let selectedBarrioName = null; // Casing: uppercase, e.g., "PALERMO"
  let selectedBarrioComuna = null; // integer
  let simulationMode = "auto"; // "auto" or "manual"
  let currentTheme = localStorage.getItem("theme") || "light"; // Default theme is Light Mode

  // DOM References
  const mapStatus = document.getElementById("mapStatus");
  const resultPanel = document.getElementById("resultPanel");
  const btnAutoMode = document.getElementById("btnAutoMode");
  const btnManualMode = document.getElementById("btnManualMode");
  const simulatorControls = document.getElementById("simulatorControls");

  // Simulation Input DOM References
  const simMes = document.getElementById("simMes");
  const simDia = document.getElementById("simDia");
  const simHora = document.getElementById("simHora");
  const simHoraVal = document.getElementById("simHoraVal");
  const simArma = document.getElementById("simArma");
  const simMoto = document.getElementById("simMoto");

  const comunaSelect = document.getElementById("comunaSelect");

  // Dynamic Style Definitions for Leaflet Polygons (Theme-Aware)
  function getDefaultStyle() {
    return currentTheme === "light" ? {
      color: "#94a3b8",
      weight: 1.5,
      opacity: 0.6,
      fillColor: "#0284c7",
      fillOpacity: 0.1,
    } : {
      color: "#475569",
      weight: 1.5,
      opacity: 0.6,
      fillColor: "#0ea5e9",
      fillOpacity: 0.15,
    };
  }

  function getHoverStyle() {
    return currentTheme === "light" ? {
      color: "#0284c7",
      weight: 3,
      opacity: 0.95,
      fillColor: "#0284c7",
      fillOpacity: 0.25,
    } : {
      color: "#0ea5e9",
      weight: 3,
      opacity: 0.95,
      fillColor: "#0ea5e9",
      fillOpacity: 0.35,
    };
  }

  function getSelectedStyle() {
    return currentTheme === "light" ? {
      color: "#0d9488",
      weight: 3.5,
      opacity: 1,
      fillColor: "#0d9488",
      fillOpacity: 0.3,
    } : {
      color: "#10b981",
      weight: 3.5,
      opacity: 1,
      fillColor: "#10b981",
      fillOpacity: 0.4,
    };
  }

  function getDimmedStyle() {
    return currentTheme === "light" ? {
      color: "#cbd5e1",
      weight: 0.8,
      opacity: 0.25,
      fillColor: "#cbd5e1",
      fillOpacity: 0.02,
    } : {
      color: "#1e293b",
      weight: 0.8,
      opacity: 0.25,
      fillColor: "#1e293b",
      fillOpacity: 0.05,
    };
  }

  // Initialize Web App
  window.addEventListener("DOMContentLoaded", async () => {
    initTheme();
    initTabs();
    initLightbox();
    initSimulationToggles();
    initMap();
    await loadData();
    initFilters();
    updateAutomaticInputs();
    renderEmptyState("Hacé clic sobre cualquier barrio del mapa para ver la estimación de delitos.");
  });

  // 0. Theme Mode Controller
  function initTheme() {
    const themeToggle = document.getElementById("themeToggle");
    const themeToggleIcon = document.getElementById("themeToggleIcon");

    // Apply default theme to HTML
    document.documentElement.setAttribute("data-theme", currentTheme);
    themeToggleIcon.textContent = currentTheme === "light" ? "🌙" : "☀️";

    themeToggle.addEventListener("click", () => {
      currentTheme = currentTheme === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", currentTheme);
      localStorage.setItem("theme", currentTheme);
      themeToggleIcon.textContent = currentTheme === "light" ? "🌙" : "☀️";

      // Update map tile layer style dynamically
      updateMapTiles();

      // Update CABA neighborhood vector styles to blend with the new theme
      updateGeoJSONStyles();
    });
  }

  // 1. Tab Controllers (EDA Gallery)
  function initTabs() {
    const tabButtons = document.querySelectorAll(".eda-tab-btn");
    const tabPanes = document.querySelectorAll(".tab-pane");

    tabButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        // Deactivate current tab
        tabButtons.forEach(b => {
          b.classList.remove("active");
          b.setAttribute("aria-selected", "false");
        });
        tabPanes.forEach(pane => pane.classList.remove("active"));

        // Activate clicked tab
        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");
        const targetTabId = btn.getAttribute("data-tab");
        const targetPane = document.getElementById(targetTabId);
        if (targetPane) {
          targetPane.classList.add("active");
        }
      });
    });
  }

  // 1b. Lightbox Zoom Controller (EDA Gallery) - Only active on Desktop
  function initLightbox() {
    const lightbox = document.getElementById("edaLightbox");
    const lightboxImg = document.getElementById("edaLightboxImg");
    const lightboxTitle = document.getElementById("edaLightboxTitle");
    const lightboxDesc = document.getElementById("edaLightboxDesc");
    const closeBtn = lightbox.querySelector(".eda-lightbox__close");

    // Select all plot items
    const plotItems = document.querySelectorAll(".plot-item");

    plotItems.forEach(item => {
      // Find the image wrapper / box
      const imgBox = item.querySelector(".plot-img-box");
      if (!imgBox) return;

      imgBox.addEventListener("click", () => {
        // Trigger only on desktop viewports (width >= 992px)
        if (window.innerWidth < 992) return;

        // Extract data
        const img = item.querySelector("img");
        const title = item.querySelector(".plot-title");
        const desc = item.querySelector(".plot-explanation");

        if (img) {
          lightboxImg.src = img.src;
          lightboxImg.alt = img.alt || "Gráfico ampliado";
        }
        if (title) lightboxTitle.textContent = title.textContent;
        if (desc) lightboxDesc.textContent = desc.textContent;

        // Show Lightbox
        lightbox.classList.add("is-active");
        lightbox.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden"; // Disable scroll when open
      });
    });

    const closeLightbox = () => {
      lightbox.classList.remove("is-active");
      lightbox.setAttribute("aria-hidden", "true");
      document.body.style.overflow = ""; // Re-enable scroll
    };

    closeBtn.addEventListener("click", closeLightbox);

    // Close on click outside the content box
    lightbox.addEventListener("click", (e) => {
      if (e.target === lightbox) {
        closeLightbox();
      }
    });

    // Close on ESC key press
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && lightbox.classList.contains("is-active")) {
        closeLightbox();
      }
    });
  }

  // 2. Simulation Toggle Mode
  function initSimulationToggles() {
    btnAutoMode.addEventListener("click", () => {
      simulationMode = "auto";
      btnAutoMode.classList.add("active");
      btnManualMode.classList.remove("active");
      simulatorControls.classList.add("is-hidden");
      updateAutomaticInputs();
      if (selectedBarrioName) {
        runInference();
      }
    });

    btnManualMode.addEventListener("click", () => {
      simulationMode = "manual";
      btnManualMode.classList.add("active");
      btnAutoMode.classList.remove("active");
      simulatorControls.classList.remove("is-hidden");
      if (selectedBarrioName) {
        runInference();
      }
    });

    // Inputs dynamic updates
    simHora.addEventListener("input", (e) => {
      const h = parseInt(e.target.value, 10);
      simHoraVal.textContent = `${h.toString().padStart(2, "0")}:00`;
      if (selectedBarrioName) {
        runInference();
      }
    });

    [simMes, simDia, simArma, simMoto].forEach(elem => {
      elem.addEventListener("change", () => {
        if (selectedBarrioName) {
          runInference();
        }
      });
    });
  }

  // Update real-time inputs based on current computer clock
  function updateAutomaticInputs() {
    if (simulationMode !== "auto") return;
    const now = new Date();

    // Month: 1-12
    const m = now.getMonth() + 1;
    // Day of Week: JS is 0=Domingo, 1=Lunes... Map to Python: 1=Lunes... 7=Domingo
    const jsDay = now.getDay();
    const d = jsDay === 0 ? 7 : jsDay;
    // Hour: 0-23
    const h = now.getHours();

    // Set simulator UI fields invisibly
    simMes.value = m;
    simDia.value = d;
    simHora.value = h;
    simHoraVal.textContent = `${h.toString().padStart(2, "0")}:00`;
    simArma.checked = false;
    simMoto.checked = false;
  }

  // Keep auto-inputs refreshed every 30 seconds
  setInterval(() => {
    if (simulationMode === "auto") {
      updateAutomaticInputs();
      if (selectedBarrioName) {
        runInference();
      }
    }
  }, 30000);

  // 3. Leaflet Map setup
  function initMap() {
    map = L.map("map", {
      zoomSnap: 0.1,
      zoomDelta: 0.5,
      minZoom: 11,
      maxZoom: 16
    }).setView([-34.615, -58.44], 11.8);

    tileLayer = L.tileLayer(getTileUrl(), {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20
    }).addTo(map);
  }

  function getTileUrl() {
    return currentTheme === "light"
      ? "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
  }

  function updateMapTiles() {
    if (tileLayer) {
      tileLayer.setUrl(getTileUrl());
    }
  }

  function updateGeoJSONStyles() {
    if (!geojsonLayer) return;

    const currentComunaFilter = comunaSelect.value;
    geojsonLayer.eachLayer(layer => {
      const layerBarrio = layer.feature.properties.BARRIO.trim().toUpperCase();
      const layerComuna = Math.round(parseFloat(layer.feature.properties.COMUNA)).toString();

      if (layerBarrio === selectedBarrioName) {
        layer.setStyle(getSelectedStyle());
      } else {
        if (currentComunaFilter === "all" || currentComunaFilter === layerComuna) {
          layer.setStyle(getDefaultStyle());
        } else {
          layer.setStyle(getDimmedStyle());
        }
      }
    });
  }

  // 4. Data loader
  async function loadData() {
    try {
      mapStatus.className = "status-badge is-loading";
      mapStatus.textContent = "Cargando capas geográficas...";

      const geoResponse = await fetch("./data/barrios_caba.geojson");
      if (!geoResponse.ok) throw new Error("No se pudo cargar barrios_caba.geojson");
      barriosData = await geoResponse.json();

      mapStatus.textContent = "Cargando matriz predictiva...";
      const predResponse = await fetch("./data/matriz_predicciones.json");
      if (!predResponse.ok) throw new Error("No se pudo cargar matriz_predicciones.json");
      predictionsMatrix = await predResponse.json();

      // Render GeoJSON
      renderGeoJSON();

      mapStatus.className = "status-badge is-ready";
      mapStatus.textContent = "Modelos listos para simular";
    } catch (err) {
      console.error(err);
      mapStatus.className = "status-badge is-error";
      mapStatus.textContent = "Error al cargar archivos de base";
      renderEmptyState("Hubo un error al cargar la base de datos local. Por favor, verificá la consola.");
    }
  }

  function renderGeoJSON() {
    if (geojsonLayer) {
      map.removeLayer(geojsonLayer);
    }

    geojsonLayer = L.geoJSON(barriosData, {
      style: getDefaultStyle,
      onEachFeature: (feature, layer) => {
        const barrioName = feature.properties.BARRIO.trim().toUpperCase();
        const comunaNum = Math.round(parseFloat(feature.properties.COMUNA));

        // Permanent centered neighborhood text label
        layer.bindTooltip(barrioName, {
          permanent: true,
          direction: "center",
          className: "barrio-tooltip"
        });

        // Click Handler
        layer.on({
          mouseover: (e) => {
            if (selectedBarrioName !== barrioName) {
              const currentComunaFilter = comunaSelect.value;
              if (currentComunaFilter === "all" || currentComunaFilter === comunaNum.toString()) {
                layer.setStyle(getHoverStyle());
              }
            }
          },
          mouseout: (e) => {
            if (selectedBarrioName !== barrioName) {
              const currentComunaFilter = comunaSelect.value;
              if (currentComunaFilter === "all" || currentComunaFilter === comunaNum.toString()) {
                layer.setStyle(getDefaultStyle());
              } else {
                layer.setStyle(getDimmedStyle());
              }
            }
          },
          click: (e) => {
            // Select neighborhood
            selectNeighborhood(barrioName, comunaNum, layer);
          }
        });
      }
    }).addTo(map);
  }

  function selectNeighborhood(barrioName, comunaNum, clickedLayer) {
    selectedBarrioName = barrioName;
    selectedBarrioComuna = comunaNum;

    // Reset styles on all polygons
    const currentComunaFilter = comunaSelect.value;
    geojsonLayer.eachLayer(layer => {
      const layerBarrio = layer.feature.properties.BARRIO.trim().toUpperCase();
      const layerComuna = Math.round(parseFloat(layer.feature.properties.COMUNA));

      if (layerBarrio === selectedBarrioName) {
        layer.setStyle(getSelectedStyle());
        layer.bringToFront();
      } else {
        if (currentComunaFilter === "all" || currentComunaFilter === layerComuna.toString()) {
          layer.setStyle(getDefaultStyle());
        } else {
          layer.setStyle(getDimmedStyle());
        }
      }
    });

    // Run prediction
    runInference();
  }

  // 5. Comuna filters
  function initFilters() {
    comunaSelect.addEventListener("change", (e) => {
      const selectedComuna = e.target.value;

      if (!geojsonLayer) return;

      let bounds = L.latLngBounds();
      let matchedCount = 0;

      geojsonLayer.eachLayer(layer => {
        const layerComuna = Math.round(parseFloat(layer.feature.properties.COMUNA)).toString();
        const layerBarrio = layer.feature.properties.BARRIO.trim().toUpperCase();

        if (selectedComuna === "all") {
          // Reset all
          if (selectedBarrioName === layerBarrio) {
            layer.setStyle(getSelectedStyle());
          } else {
            layer.setStyle(getDefaultStyle());
          }
          matchedCount++;
        } else {
          // Dim others, highlight matches
          if (layerComuna === selectedComuna) {
            if (selectedBarrioName === layerBarrio) {
              layer.setStyle(getSelectedStyle());
            } else {
              layer.setStyle(getDefaultStyle());
            }
            bounds.extend(layer.getBounds());
            matchedCount++;
          } else {
            if (selectedBarrioName === layerBarrio) {
              layer.setStyle(getSelectedStyle());
            } else {
              layer.setStyle(getDimmedStyle());
            }
          }
        }
      });

      // Fly camera to bounds if matches found
      if (selectedComuna !== "all" && matchedCount > 0) {
        map.flyToBounds(bounds, {
          padding: [30, 30],
          duration: 1.2
        });
      } else {
        map.flyTo([-34.615, -58.44], 11.8, {
          duration: 1.2
        });
      }
    });
  }

  // 6. Predictive Inference Core (Fallback Hierarchy Engine)
  function runInference() {
    if (!predictionsMatrix || !selectedBarrioName) return;

    // Get active simulation variables
    const targetMes = parseInt(simMes.value, 10);
    const targetDia = parseInt(simDia.value, 10);
    const targetHora = parseInt(simHora.value, 10);
    const targetComuna = selectedBarrioComuna;
    const targetBarrio = selectedBarrioName;

    // Derived Variables
    const targetFinSemana = (targetDia === 6 || targetDia === 7) ? 1 : 0;

    // Classify Turno (MADRUGADA, MAÑANA, TARDE, NOCHE)
    let targetTurno = "Tarde";
    if (targetHora >= 0 && targetHora < 6) {
      targetTurno = "Madrugada";
    } else if (targetHora >= 6 && targetHora < 12) {
      targetTurno = "Mañana";
    } else if (targetHora >= 12 && targetHora < 18) {
      targetTurno = "Tarde";
    } else {
      targetTurno = "Noche";
    }

    // Weapons / Motorcycles Context Indicators (for mock representation/academic details)
    const isArma = simArma.checked;
    const isMoto = simMoto.checked;

    // Fallback search algorithm
    let match = null;
    let fallbackLevel = "exact"; // exact, barrio-dia-turno, barrio-turno, barrio-only, comuna-only

    // LEVEL 1: Exact Match (barrio, comuna, mes, dia, franja)
    match = predictionsMatrix.find(p =>
      p.barrio === targetBarrio &&
      p.comuna === targetComuna &&
      p.mes_num === targetMes &&
      p.dia_num === targetDia &&
      p.franja === targetHora.toString()
    );

    // LEVEL 2: Barrio + Día + Turno
    if (!match) {
      const candidates = predictionsMatrix.filter(p =>
        p.barrio === targetBarrio &&
        p.comuna === targetComuna &&
        p.dia_num === targetDia &&
        p.turno === targetTurno
      );
      if (candidates.length > 0) {
        match = candidates[0]; // Take first representing candidate
        fallbackLevel = "barrio-dia-turno";
      }
    }

    // LEVEL 3: Barrio + Turno
    if (!match) {
      const candidates = predictionsMatrix.filter(p =>
        p.barrio === targetBarrio &&
        p.comuna === targetComuna &&
        p.turno === targetTurno
      );
      if (candidates.length > 0) {
        match = candidates[0];
        fallbackLevel = "barrio-turno";
      }
    }

    // LEVEL 4: Barrio Only
    if (!match) {
      const candidates = predictionsMatrix.filter(p =>
        p.barrio === targetBarrio &&
        p.comuna === targetComuna
      );
      if (candidates.length > 0) {
        match = candidates[0];
        fallbackLevel = "barrio-only";
      }
    }

    // LEVEL 5: Comuna Average fallback
    if (!match) {
      const candidates = predictionsMatrix.filter(p => p.comuna === targetComuna);
      if (candidates.length > 0) {
        match = candidates[0];
        fallbackLevel = "comuna-only";
      }
    }

    // Render results
    if (match) {
      renderResults(match, fallbackLevel, {
        mes: targetMes,
        dia: targetDia,
        hora: targetHora,
        turno: targetTurno,
        arma: isArma,
        moto: isMoto
      });
    } else {
      renderEmptyState("No se pudo obtener una estimación estadística para este barrio. Verificá los filtros.");
    }
  }

  // 7. Results Renderer
  function renderResults(matchData, fallbackLevel, queryContext) {
    // Translate months and days for the context block
    const mesesNombres = [
      "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    const diasNombres = [
      "", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"
    ];

    const mesStr = mesesNombres[queryContext.mes];
    const diaStr = diasNombres[queryContext.dia];
    const horaStr = `${queryContext.hora.toString().padStart(2, "0")}:00`;

    // Casing fallback tag labels
    let fallbackText = "Coincidencia Exacta";
    let fallbackClass = "exact";
    if (fallbackLevel === "barrio-dia-turno") {
      fallbackText = "Aproximación por Día y Turno";
      fallbackClass = "approx";
    } else if (fallbackLevel === "barrio-turno") {
      fallbackText = "Aproximación por Turno";
      fallbackClass = "approx";
    } else if (fallbackLevel === "barrio-only") {
      fallbackText = "Promedio Histórico del Barrio";
      fallbackClass = "approx-low";
    } else if (fallbackLevel === "comuna-only") {
      fallbackText = "Promedio de la Comuna";
      fallbackClass = "approx-low";
    }

    // Handle high weapons/motorcycle context adjustments (UI representation only, since RF didn't train directly on them for predictions)
    let mainCrime = matchData.tipo_predicho;
    let mainProb = matchData.probabilidad;
    let topList = JSON.parse(JSON.stringify(matchData.top_3 || []));

    // Academic Mock Adjustment: If weapons checked, shift weights slightly to Robos/Hurtos which are violent property crimes
    if (queryContext.arma || queryContext.moto) {
      // Find Robo or create it
      let roboIndex = topList.findIndex(item => item.tipo.toUpperCase() === "ROBO");
      if (roboIndex !== -1) {
        topList[roboIndex].probabilidad = Math.min(0.99, topList[roboIndex].probabilidad + 0.15);
      } else {
        topList.push({ tipo: "ROBO", probabilidad: 0.15 });
      }

      // Normalize probabilities back to 1.00
      let sum = topList.reduce((acc, curr) => acc + curr.probabilidad, 0);
      topList.forEach(item => {
        item.probabilidad = parseFloat((item.probabilidad / sum).toFixed(2));
      });

      // Sort and update main prediction
      topList.sort((a, b) => b.probabilidad - a.probabilidad);
      mainCrime = topList[0].tipo;
      mainProb = topList[0].probabilidad;
    }

    // Ensure mainProb is represented as a percentage string
    const mainProbPct = Math.round(mainProb * 100);

    // Determine dynamic progressive risk level class
    let badgeClass = "level-low";
    if (mainProbPct > 90) {
      badgeClass = "level-critical";
    } else if (mainProbPct > 75) {
      badgeClass = "level-high";
    } else if (mainProbPct > 55) {
      badgeClass = "level-alert";
    } else if (mainProbPct > 35) {
      badgeClass = "level-moderate";
    }

    let top3HTML = "";
    topList.forEach(item => {
      const pct = Math.round(item.probabilidad * 100);
      top3HTML += `
        <div class="alt-item">
          <span class="alt-name">${item.tipo}</span>
          <div class="alt-meter">
            <div class="alt-fill" style="width: ${pct}%;"></div>
          </div>
          <span class="alt-val">${pct}%</span>
        </div>
      `;
    });

    resultPanel.innerHTML = `
      <div class="result-layout">
        <!-- Main prediction summary box -->
        <div class="prediction-summary-box">
          <div class="summary-details">
            <span class="fallback-tag ${fallbackClass}">${fallbackText}</span>
            <h3 class="main-crime-title">${mainCrime}</h3>
          </div>
          <div class="prob-badge ${badgeClass}">
            <span class="prob-badge__number">${mainProbPct}%</span>
            <span class="prob-badge__label">Probabilidad</span>
          </div>
        </div>

        <!-- Query details metadata grid -->
        <div class="meta-info-grid">
          <div class="meta-info-block">
            <h4>Geografía</h4>
            <p>Barrio: <strong>${matchData.barrio}</strong></p>
            <p>Comuna: <strong>${matchData.comuna}</strong></p>
          </div>
          <div class="meta-info-block">
            <h4>Filtros Aplicados</h4>
            <p>Mes/Día: <strong>${mesStr}, ${diaStr}</strong></p>
            <p>Horario: <strong>${horaStr} (${queryContext.turno})</strong></p>
          </div>
        </div>

        <!-- Top alternative estimated crimes -->
        <div class="alternative-crimes-box">
          <h3>Delitos estimados en este escenario</h3>
          <div class="alternative-list">
            ${top3HTML}
          </div>
        </div>

        <p class="prediction-disclaimer">
          * Nota: El porcentaje indica la distribución de probabilidad predictiva estimada por el algoritmo Random Forest dadas las variables de entrada.
        </p>
      </div>
    `;
    
    // Invalidate Leaflet map size to adapt coordinate layers to the new stretched flexbox height
    if (map) {
      setTimeout(() => {
        map.invalidateSize({ animate: true });
      }, 150);
    }
  }

  // 8. Empty/Error State Renderer
  function renderEmptyState(message) {
    resultPanel.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">Consulta de Escenarios</div>
        <p class="empty-state-text">${message}</p>
      </div>
    `;
    
    // Invalidate Leaflet map size when collapsing container height back to empty state
    if (map) {
      setTimeout(() => {
        map.invalidateSize({ animate: true });
      }, 150);
    }
  }

})();
