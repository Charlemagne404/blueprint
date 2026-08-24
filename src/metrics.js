"use strict";

const MAX_METRICS = 100;

function createMetrics({ now = () => Date.now() } = {}) {
  const counters = new Map();
  const durations = new Map();

  function increment(name, amount = 1) {
    const metricName = normalizeMetricName(name);
    if (!counters.has(metricName) && counters.size >= MAX_METRICS) {
      return;
    }

    const normalizedAmount = Number(amount);
    counters.set(
      metricName,
      (counters.get(metricName) || 0) +
        (Number.isFinite(normalizedAmount) ? normalizedAmount : 1),
    );
  }

  function observe(name, durationMs) {
    const metricName = normalizeMetricName(name);
    if (!durations.has(metricName) && durations.size >= MAX_METRICS) {
      return;
    }

    const normalizedDuration = Math.max(0, Number(durationMs) || 0);
    const current = durations.get(metricName) || {
      count: 0,
      maxMs: 0,
      sumMs: 0,
    };
    current.count += 1;
    current.maxMs = Math.max(current.maxMs, normalizedDuration);
    current.sumMs += normalizedDuration;
    durations.set(metricName, current);
  }

  function snapshot() {
    return {
      collectedAt: new Date(now()).toISOString(),
      counters: Object.fromEntries(counters),
      durations: Object.fromEntries(
        [...durations].map(([name, value]) => [name, { ...value }]),
      ),
    };
  }

  return {
    increment,
    observe,
    snapshot,
  };
}

function formatPrometheus(snapshot) {
  const lines = [
    "# Blueprint in-process metrics",
    `blueprint_metrics_collected_timestamp_seconds ${Math.floor(
      Date.parse(snapshot.collectedAt) / 1000,
    )}`,
  ];

  for (const [name, value] of Object.entries(snapshot.counters || {})) {
    lines.push(`# TYPE blueprint_${name} counter`);
    lines.push(`blueprint_${name} ${formatNumber(value)}`);
  }

  for (const [name, value] of Object.entries(snapshot.durations || {})) {
    lines.push(`# TYPE blueprint_${name}_duration_ms summary`);
    lines.push(`blueprint_${name}_duration_ms_count ${formatNumber(value.count)}`);
    lines.push(`blueprint_${name}_duration_ms_sum ${formatNumber(value.sumMs)}`);
    lines.push(`blueprint_${name}_duration_ms_max ${formatNumber(value.maxMs)}`);
  }

  return `${lines.join("\n")}\n`;
}

function normalizeMetricName(value) {
  const normalized = String(value || "unknown")
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .toLowerCase()
    .replace(/^([^a-z_])/, "_$1")
    .slice(0, 100);
  return normalized || "unknown";
}

function formatNumber(value) {
  return Number.isFinite(Number(value)) ? String(Number(value)) : "0";
}

module.exports = {
  createMetrics,
  formatPrometheus,
};
