/**
 * LatencyTracker: High-performance sliding-window reservoir for computing
 * real-time statistical percentiles (P50, P90, P95, P99) with zero external dependencies.
 */
export class LatencyTracker {
  constructor(windowSize = 1000, defaultP90Ms = 25) {
    this.windowSize = windowSize;
    this.defaultP90Ms = defaultP90Ms;
    this.samples = [];
    this.sortedCache = null;
    this.totalRecorded = 0;
  }

  record(latencyMs) {
    this.samples.push(latencyMs);
    this.totalRecorded++;
    if (this.samples.length > this.windowSize) {
      this.samples.shift();
    }
    this.sortedCache = null; // Invalidate sorted cache
  }

  _getSorted() {
    if (!this.sortedCache) {
      this.sortedCache = [...this.samples].sort((a, b) => a - b);
    }
    return this.sortedCache;
  }

  getPercentile(p) {
    if (this.samples.length < 10) {
      // Warm-up phase: return default conservative baseline
      if (p >= 95) return this.defaultP90Ms * 1.5;
      if (p >= 90) return this.defaultP90Ms;
      return this.defaultP90Ms * 0.6;
    }

    const sorted = this._getSorted();
    const rank = Math.ceil((p / 100) * sorted.length) - 1;
    const index = Math.max(0, Math.min(sorted.length - 1, rank));
    return sorted[index];
  }

  getP50() {
    return this.getPercentile(50);
  }

  getP90() {
    return this.getPercentile(90);
  }

  getP95() {
    return this.getPercentile(95);
  }

  getP99() {
    return this.getPercentile(99);
  }

  getStats() {
    if (this.samples.length === 0) {
      return { count: 0, p50: 0, p90: 0, p95: 0, p99: 0, avg: 0, min: 0, max: 0 };
    }

    const sorted = this._getSorted();
    const sum = sorted.reduce((acc, val) => acc + val, 0);
    const avg = sum / sorted.length;

    return {
      count: this.samples.length,
      totalRecorded: this.totalRecorded,
      min: parseFloat(sorted[0].toFixed(2)),
      max: parseFloat(sorted[sorted.length - 1].toFixed(2)),
      avg: parseFloat(avg.toFixed(2)),
      p50: parseFloat(this.getP50().toFixed(2)),
      p90: parseFloat(this.getP90().toFixed(2)),
      p95: parseFloat(this.getP95().toFixed(2)),
      p99: parseFloat(this.getP99().toFixed(2))
    };
  }

  reset() {
    this.samples = [];
    this.sortedCache = null;
    this.totalRecorded = 0;
  }
}
