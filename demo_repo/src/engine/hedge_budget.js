/**
 * HedgeBudget: Safety circuit-breaker and rate limiter preventing speculative retry storms.
 * Enforces that speculative hedged requests never exceed a configurable fraction (default 5%)
 * of the total incoming traffic volume within a rolling time window.
 */
export class HedgeBudget {
  constructor(maxBudgetRatio = 0.05, windowMs = 10000) {
    this.maxBudgetRatio = maxBudgetRatio; // e.g. 5% max overhead
    this.windowMs = windowMs;             // 10-second rolling window
    this.requestLog = [];                 // Timestamps of regular requests
    this.hedgeLog = [];                   // Timestamps of hedged requests
    this.throttledCount = 0;              // Count of hedges blocked by budget
  }

  _cleanOldEntries(now) {
    const cutoff = now - this.windowMs;
    while (this.requestLog.length > 0 && this.requestLog[0] < cutoff) {
      this.requestLog.shift();
    }
    while (this.hedgeLog.length > 0 && this.hedgeLog[0] < cutoff) {
      this.hedgeLog.shift();
    }
  }

  recordRequest() {
    const now = Date.now();
    this.requestLog.push(now);
    this._cleanOldEntries(now);
  }

  /**
   * Evaluates if a speculative hedge request is permissible under the current budget.
   * If permissible, records the hedge and returns true. Otherwise returns false.
   */
  canHedge() {
    const now = Date.now();
    this._cleanOldEntries(now);

    const totalRequests = this.requestLog.length;
    // During very low traffic (fewer than 20 requests), allow at most 2 hedges
    if (totalRequests < 20) {
      if (this.hedgeLog.length < 2) {
        this.hedgeLog.push(now);
        return true;
      }
      this.throttledCount++;
      return false;
    }

    const currentRatio = this.hedgeLog.length / totalRequests;
    if (currentRatio < this.maxBudgetRatio) {
      this.hedgeLog.push(now);
      return true;
    }

    this.throttledCount++;
    return false;
  }

  getStats() {
    const now = Date.now();
    this._cleanOldEntries(now);

    const total = this.requestLog.length;
    const hedges = this.hedgeLog.length;
    const currentRatio = total > 0 ? (hedges / total) * 100 : 0;

    return {
      windowRequests: total,
      windowHedges: hedges,
      currentRatioPercent: parseFloat(currentRatio.toFixed(2)),
      maxAllowedPercent: this.maxBudgetRatio * 100,
      throttledCount: this.throttledCount,
      budgetHealthy: currentRatio <= (this.maxBudgetRatio * 100)
    };
  }

  reset() {
    this.requestLog = [];
    this.hedgeLog = [];
    this.throttledCount = 0;
  }
}
