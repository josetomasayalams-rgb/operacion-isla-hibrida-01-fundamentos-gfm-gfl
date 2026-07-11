(function () {
  "use strict";

  const STORAGE_KEY = "gfm-learning-state-v1";
  const THEME_KEY = "gfm-learning-theme-v1";
  const THEMES = [
    { value: "system", label: "Sistema" },
    { value: "dark", label: "Oscuro" },
    { value: "light", label: "Claro" },
    { value: "ocean", label: "Océano" },
    { value: "sage", label: "Salvia" },
    { value: "sunset", label: "Atardecer" }
  ];
  const DEFAULT_STATE = {
    schemaVersion: "1.2.0",
    profile: "complete",
    activeModule: "00",
    progress: ["00"],
    scenario: {
      evidenceType: "E",
      metadata: { title: "Caso educativo base", provenance: "E", units: "SI y pu" },
      architecture: { topology: "ac-coupled", bessAvailable: true, groundingAvailable: true },
      grid: { nominalFrequencyHz: 50, nominalVoltageKV: 13.8, nominalVoltagePu: 1, scr: 5, pccState: "closed" },
      load: {
        activePowerMW: 6,
        reactivePowerMvar: 1.2,
        criticalSharePct: 75,
        maximumStepMW: 2,
        requiredAutonomyHours: 4,
        disturbancePu: 0.25
      },
      renewable: {
        pvCapacityMW: 5,
        windCapacityMW: 3,
        penetrationPu: 0.5,
        pllEnabled: true,
        operatingScenario: "variable"
      },
      bess: {
        powerMW: 5,
        energyMWh: 24,
        powerPu: 1,
        energyHours: 4.8,
        socPct: 60,
        minimumSocPct: 20,
        maximumSocPct: 90,
        efficiencyPct: 92,
        currentLimitPu: 1.2
      },
      control: {
        mode: "gfm",
        inertiaSeconds: 3,
        droopPu: 0.05,
        droopUnitAPct: 5,
        droopUnitBPct: 5,
        dampingPu: 1,
        headroomUnitAPu: 0.35,
        headroomUnitBPu: 0.35
      },
      dispatch: { curtailmentSocPct: 85, reserveSocPct: 25, policy: "renewable-priority" },
      transition: {
        eventType: "unplanned",
        detectionDelayMs: 80,
        breakerOpeningMs: 60,
        referenceTakeoverMs: 120,
        protectionSwitchMs: 80,
        communicationsAvailable: true,
        transitionCriterionMs: 500
      },
      protection: {
        faultType: "three-phase",
        faultLocation: "feeder",
        scheme: "voltage-controlled",
        relayPickupPu: 0.9,
        breakerTimeMs: 80,
        pcsSupportMs: 300
      },
      grounding: {
        topology: "ngr",
        positiveNegativeOhm: 1,
        zeroSequenceOhm: 3,
        ngrOhm: 8,
        faultResistanceOhm: 0.5,
        clearingTimeSeconds: 0.5
      },
      blackStart: {
        voltageRampSeconds: 10,
        transformerMVA: 4,
        inrushMultiplier: 8,
        motorMW: 1,
        loadBlockMW: 2,
        initialSocPct: 70
      },
      modeling: {
        phenomenon: "current-limiter",
        modelClass: "emt",
        projectPhase: "design",
        validationErrorPct: 8
      },
      ot: {
        latencyMs: 20,
        jitterMs: 5,
        packetLossPct: 0,
        linkFault: "none",
        clockHealthy: true,
        localControllerAvailable: true
      },
      compliance: {
        jurisdiction: "cen",
        projectPhase: "design",
        requirement: "gfm-model",
        evidenceStatus: "pending"
      },
      verification: {
        phase: "hil",
        testCase: "island",
        modelVersion: "v1.0",
        firmwareVersion: "v1.0",
        tolerancePct: 10
      },
      safety: {
        temperatureC: 25,
        sohPct: 95,
        ageYears: 1,
        dutyCyclePct: 55,
        hvacAvailable: true,
        thermalAlarm: false
      },
      cases: { selected: "dalrymple", dimension: "island" },
      results: { observables: {}, violations: [], uncertainty: "E" },
      evidence: { claimId: "educational-base", type: "E", source: "corpus", validity: "educational", projectRequired: true },
      event: { type: "load-step", startSeconds: 1, durationSeconds: 4 }
    }
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function merge(base, candidate) {
    if (!candidate || typeof candidate !== "object") return clone(base);
    const result = clone(base);
    Object.keys(candidate).forEach((key) => {
      if (candidate[key] && typeof candidate[key] === "object" && !Array.isArray(candidate[key]) && result[key]) {
        result[key] = merge(result[key], candidate[key]);
      } else {
        result[key] = candidate[key];
      }
    });
    return result;
  }

  function getState() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return clone(DEFAULT_STATE);
      const parsed = JSON.parse(stored);
      const migrated = merge(DEFAULT_STATE, parsed);
      migrated.schemaVersion = DEFAULT_STATE.schemaVersion;
      return migrated;
    } catch (error) {
      return clone(DEFAULT_STATE);
    }
  }

  function setState(nextState) {
    const normalized = merge(DEFAULT_STATE, nextState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function update(mutator) {
    const state = getState();
    const next = mutator(clone(state)) || state;
    return setState(next);
  }

  function markComplete(moduleId) {
    return update((state) => {
      if (!state.progress.includes(moduleId)) state.progress.push(moduleId);
      state.activeModule = moduleId;
      return state;
    });
  }

  function readTheme() {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      return THEMES.some((theme) => theme.value === stored) ? stored : "system";
    } catch (error) {
      return "system";
    }
  }

  function systemIsDark() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function applyTheme(theme) {
    const normalized = THEMES.some((item) => item.value === theme) ? theme : "system";
    document.documentElement.dataset.theme = normalized;
    document.documentElement.style.colorScheme = ["dark", "ocean"].includes(normalized) || (normalized === "system" && systemIsDark()) ? "dark" : "light";
    return normalized;
  }

  function setTheme(theme) {
    const normalized = applyTheme(theme);
    try {
      localStorage.setItem(THEME_KEY, normalized);
    } catch (error) {
      // Private browsing can deny localStorage; the current page still changes theme.
    }
    window.dispatchEvent(new CustomEvent("gfm-theme-change", { detail: { theme: normalized } }));
    return normalized;
  }

  function installThemeControl() {
    const header = document.querySelector(".site-header");
    if (!header || document.querySelector(".theme-control")) return;
    const host = header.querySelector(".hero-insight, .header-meta") || header;
    const wrapper = document.createElement("div");
    wrapper.className = "theme-control";
    const label = document.createElement("label");
    label.htmlFor = "theme-select";
    label.textContent = "Tema";
    const select = document.createElement("select");
    select.id = "theme-select";
    select.setAttribute("aria-label", "Elegir tema visual");
    THEMES.forEach((theme) => {
      const option = document.createElement("option");
      option.value = theme.value;
      option.textContent = theme.label;
      select.appendChild(option);
    });
    select.value = readTheme();
    select.addEventListener("change", () => setTheme(select.value));
    wrapper.append(label, select);
    host.appendChild(wrapper);
  }

  applyTheme(readTheme());
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installThemeControl, { once: true });
  } else {
    installThemeControl();
  }
  const mediaQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  if (mediaQuery && mediaQuery.addEventListener) {
    mediaQuery.addEventListener("change", () => {
      if (readTheme() === "system") {
        applyTheme("system");
        window.dispatchEvent(new CustomEvent("gfm-theme-change", { detail: { theme: "system" } }));
      }
    });
  }

  window.GFMApp = {
    storageKey: STORAGE_KEY,
    themeKey: THEME_KEY,
    themes: THEMES,
    defaultState: clone(DEFAULT_STATE),
    getState,
    setState,
    update,
    markComplete,
    readTheme,
    setTheme
  };
})();
