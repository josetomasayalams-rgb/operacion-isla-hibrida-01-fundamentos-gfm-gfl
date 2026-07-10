(function () {
  "use strict";

  const controls = {
    scr: document.getElementById("scr"),
    step: document.getElementById("step"),
    inertia: document.getElementById("inertia"),
    currentLimit: document.getElementById("current-limit")
  };

  const outputs = {
    scr: document.getElementById("scr-value"),
    step: document.getElementById("step-value"),
    inertia: document.getElementById("inertia-value"),
    currentLimit: document.getElementById("current-limit-value"),
    nadir: document.getElementById("metric-nadir"),
    phase: document.getElementById("metric-phase"),
    current: document.getElementById("metric-current"),
    status: document.getElementById("status-line"),
    frequencyLabel: document.getElementById("frequency-end-label"),
    phaseLabel: document.getElementById("phase-end-label")
  };

  const visual = {
    frequencyPath: document.getElementById("frequency-path"),
    phasePath: document.getElementById("phase-path"),
    gfm: document.getElementById("phasor-gfm"),
    gfl: document.getElementById("phasor-gfl"),
    gfmLabel: document.getElementById("label-gfm"),
    gflLabel: document.getElementById("label-gfl"),
    phasorSvg: document.getElementById("phasor-svg"),
    responseSvg: document.getElementById("response-svg")
  };

  let previous = null;

  function format(value, digits) {
    return value.toLocaleString("es-CL", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function syncLabels() {
    outputs.scr.value = format(Number(controls.scr.value), 1);
    outputs.step.value = `${format(Number(controls.step.value), 0)} %`;
    outputs.inertia.value = `${format(Number(controls.inertia.value), 1)} s`;
    outputs.currentLimit.value = `${format(Number(controls.currentLimit.value), 2)} pu`;
  }

  function simulate() {
    const scr = Number(controls.scr.value);
    const loadStep = Number(controls.step.value) / 100;
    const inertia = Number(controls.inertia.value);
    const currentLimit = Number(controls.currentLimit.value);
    const fnom = 50;
    const dt = 0.01;
    const duration = 5;
    const eventTime = 1;
    const droop = 0.05;
    const damping = 1;
    const controlTime = 0.15;
    const forcing = 2 * Math.PI * (0.1 + 1.2 * loadStep);
    const coupling = 2 * Math.PI * 0.12 * scr;

    let deltaFpu = 0;
    let controlPower = 0;
    let phase = 0;
    let maxPhaseDeg = 0;
    let nadir = fnom;
    let demandedCurrentPeak = 0;
    const points = [];

    for (let time = 0; time <= duration + dt / 2; time += dt) {
      const active = time >= eventTime;
      const disturbance = active ? loadStep : 0;
      const dControl = ((-deltaFpu / droop) - controlPower) / controlTime;
      const dFrequency = (controlPower - disturbance - damping * deltaFpu) / (2 * inertia);
      controlPower += dControl * dt;
      deltaFpu += dFrequency * dt;

      if (active) {
        phase += (forcing - coupling * Math.sin(phase)) * dt;
      }

      const frequency = fnom * (1 + deltaFpu);
      const phaseDeg = Math.abs(phase * 180 / Math.PI);
      const demandedCurrent = 0.72 + disturbance + 0.18 * Math.abs(dFrequency * inertia);
      nadir = Math.min(nadir, frequency);
      maxPhaseDeg = Math.max(maxPhaseDeg, phaseDeg);
      demandedCurrentPeak = Math.max(demandedCurrentPeak, demandedCurrent);
      points.push({ time, frequency, phaseDeg });
    }

    const locked = forcing < coupling;
    const currentLimited = demandedCurrentPeak > currentLimit;
    const currentPeak = Math.min(demandedCurrentPeak, currentLimit);
    const transferLimit = Math.max(0.08, 0.2 * scr);
    const gfmAngle = Math.asin(Math.min(0.95, loadStep / transferLimit));
    const finalPhase = locked ? Math.min(phase, Math.PI * 0.95) : phase;

    return {
      scr,
      loadStep,
      inertia,
      currentLimit,
      points,
      nadir,
      maxPhaseDeg,
      demandedCurrentPeak,
      currentPeak,
      currentLimited,
      locked,
      gfmAngle,
      finalPhase
    };
  }

  function scaleSeries(result) {
    const frequencies = result.points.map((point) => point.frequency);
    const minFrequency = Math.min(...frequencies);
    const frequencyFloor = Math.floor((minFrequency - 0.25) * 2) / 2;
    const frequencyCeiling = 50.2;
    const phaseCeiling = Math.max(45, Math.min(360, Math.ceil(result.maxPhaseDeg / 45) * 45));

    return result.points.map((point) => ({
      x: 58 + (point.time / 5) * 536,
      frequencyY: 42 + ((frequencyCeiling - point.frequency) / (frequencyCeiling - frequencyFloor)) * 111,
      phaseY: 302 - (Math.min(point.phaseDeg, phaseCeiling) / phaseCeiling) * 95
    }));
  }

  function pathFrom(points, key) {
    return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point[key].toFixed(2)}`).join(" ");
  }

  function phasorEndpoint(angle, length) {
    return {
      x: 145 + length * Math.cos(-angle),
      y: 135 + length * Math.sin(-angle)
    };
  }

  function paint(result, fraction, previousResult) {
    const currentScaled = scaleSeries(result);
    const priorScaled = previousResult ? scaleSeries(previousResult) : currentScaled;
    const interpolated = currentScaled.map((point, index) => ({
      x: point.x,
      frequencyY: priorScaled[index].frequencyY + (point.frequencyY - priorScaled[index].frequencyY) * fraction,
      phaseY: priorScaled[index].phaseY + (point.phaseY - priorScaled[index].phaseY) * fraction
    }));

    visual.frequencyPath.setAttribute("d", pathFrom(interpolated, "frequencyY"));
    visual.phasePath.setAttribute("d", pathFrom(interpolated, "phaseY"));

    const previousGfmAngle = previousResult ? previousResult.gfmAngle : result.gfmAngle;
    const previousGflAngle = previousResult ? previousResult.finalPhase : result.finalPhase;
    const gfmAngle = previousGfmAngle + (result.gfmAngle - previousGfmAngle) * fraction;
    const gflAngle = previousGflAngle + (result.finalPhase - previousGflAngle) * fraction;
    const gfmEnd = phasorEndpoint(gfmAngle, 87);
    const gflEnd = phasorEndpoint(gflAngle, 76);

    visual.gfm.setAttribute("x2", gfmEnd.x.toFixed(2));
    visual.gfm.setAttribute("y2", gfmEnd.y.toFixed(2));
    visual.gfl.setAttribute("x2", gflEnd.x.toFixed(2));
    visual.gfl.setAttribute("y2", gflEnd.y.toFixed(2));
    visual.gfmLabel.setAttribute("x", (gfmEnd.x + 5).toFixed(2));
    visual.gfmLabel.setAttribute("y", (gfmEnd.y - 5).toFixed(2));
    visual.gflLabel.setAttribute("x", (gflEnd.x + 5).toFixed(2));
    visual.gflLabel.setAttribute("y", (gflEnd.y + 14).toFixed(2));
  }

  function updateText(result) {
    outputs.nadir.textContent = `${format(result.nadir, 2)} Hz`;
    outputs.phase.textContent = result.locked ? `${format(result.maxPhaseDeg, 0)}°` : "> 180°";
    outputs.current.textContent = `${format(result.currentPeak, 2)} pu`;
    outputs.frequencyLabel.textContent = `${format(result.nadir, 2)} Hz mín.`;
    outputs.phaseLabel.textContent = result.locked ? "punto fijo" : "sin punto fijo";

    const phaseMessage = result.locked
      ? "el modelo conserva un punto de equilibrio para la sincronización GFL"
      : "el forzamiento supera el acoplamiento del modelo y el ángulo GFL deriva";
    const currentMessage = result.currentLimited
      ? `la demanda calculada (${format(result.demandedCurrentPeak, 2)} pu) alcanza el límite configurado; la respuesta real depende del current limiter OEM`
      : "la demanda de corriente permanece bajo el límite configurado";

    outputs.status.innerHTML = `<strong>Lectura:</strong> ${phaseMessage}; ${currentMessage}.`;
    visual.phasorSvg.setAttribute("aria-label", `Fasores después del evento. GFM a ${format(result.gfmAngle * 180 / Math.PI, 0)} grados y GFL ${result.locked ? "sincronizado" : "sin punto fijo"}.`);
    visual.responseSvg.setAttribute("aria-label", `Frecuencia mínima ${format(result.nadir, 2)} hertz. Error angular GFL máximo ${format(result.maxPhaseDeg, 0)} grados.`);
  }

  function persist(result) {
    window.GFMApp.update((state) => {
      state.activeModule = "01";
      state.scenario.grid.scr = result.scr;
      state.scenario.load.disturbancePu = result.loadStep;
      state.scenario.control.inertiaSeconds = result.inertia;
      state.scenario.bess.currentLimitPu = result.currentLimit;
      return state;
    });
  }

  function render(animate) {
    syncLabels();
    const result = simulate();
    updateText(result);
    persist(result);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!animate || !previous || reducedMotion) {
      paint(result, 1, previous);
      previous = result;
      return;
    }

    const prior = previous;
    const start = performance.now();
    const duration = 420;
    function frame(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      paint(result, eased, prior);
      if (progress < 1) requestAnimationFrame(frame);
      else previous = result;
    }
    requestAnimationFrame(frame);
  }

  Object.values(controls).forEach((control) => {
    control.addEventListener("input", syncLabels);
  });
  document.getElementById("simulate").addEventListener("click", () => render(true));

  const state = window.GFMApp.getState();
  controls.scr.value = state.scenario.grid.scr;
  controls.step.value = Math.round(state.scenario.load.disturbancePu * 100);
  controls.inertia.value = state.scenario.control.inertiaSeconds;
  controls.currentLimit.value = state.scenario.bess.currentLimitPu;
  window.GFMApp.markComplete("01");
  render(false);
})();
