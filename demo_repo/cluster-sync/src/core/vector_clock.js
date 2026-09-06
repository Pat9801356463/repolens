/**
 * VectorClock: Causality tracking and conflict detection for multi-master distributed writes.
 */
export class VectorClock {
  constructor(initialValues = {}) {
    this.clock = { ...initialValues };
  }

  increment(nodeId) {
    this.clock[nodeId] = (this.clock[nodeId] || 0) + 1;
    return this;
  }

  get(nodeId) {
    return this.clock[nodeId] || 0;
  }

  clone() {
    return new VectorClock(this.clock);
  }

  toJSON() {
    return { ...this.clock };
  }

  /**
   * Compares this vector clock with another.
   * Returns:
   *   'EQUAL'        : Both clocks are identical
   *   'GREATER_THAN' : This clock causally dominates (happened after) other
   *   'LESS_THAN'    : This clock is dominated by (happened before) other
   *   'CONCURRENT'   : Concurrent modification (CONFLICT DETECTED!)
   */
  static compare(clockA, clockB) {
    const a = clockA instanceof VectorClock ? clockA.clock : clockA;
    const b = clockB instanceof VectorClock ? clockB.clock : clockB;

    const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

    let hasGreater = false;
    let hasLesser = false;

    for (const key of allKeys) {
      const valA = a[key] || 0;
      const valB = b[key] || 0;

      if (valA > valB) hasGreater = true;
      if (valA < valB) hasLesser = true;
    }

    if (hasGreater && hasLesser) {
      return 'CONCURRENT'; // Conflict!
    } else if (hasGreater && !hasLesser) {
      return 'GREATER_THAN';
    } else if (!hasGreater && hasLesser) {
      return 'LESS_THAN';
    } else {
      return 'EQUAL';
    }
  }

  /**
   * Merges two vector clocks taking the maximum value per node
   */
  static merge(clockA, clockB) {
    const a = clockA instanceof VectorClock ? clockA.clock : clockA;
    const b = clockB instanceof VectorClock ? clockB.clock : clockB;

    const merged = {};
    const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

    for (const key of allKeys) {
      merged[key] = Math.max(a[key] || 0, b[key] || 0);
    }

    return new VectorClock(merged);
  }
}
