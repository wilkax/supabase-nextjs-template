/**
 * StatisticalCalculator - Provides statistical calculation functions
 *
 * This class contains all the statistical functions used for aggregating
 * questionnaire response data.
 */

import { ResponseValue } from '../types';

export class StatisticalCalculator {
  /**
   * Calculates the average (mean) of numeric values
   */
  static average(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }

  /**
   * Calculates the sum of numeric values
   */
  static sum(values: number[]): number {
    return values.reduce((acc, val) => acc + val, 0);
  }

  /**
   * Counts the number of values
   */
  static count(values: ResponseValue[]): number {
    return values.length;
  }

  /**
   * Calculates the distribution (frequency) of values
   */
  static distribution(values: ResponseValue[]): Record<string, number> {
    const dist: Record<string, number> = {};

    values.forEach(value => {
      const key = String(value);
      dist[key] = (dist[key] || 0) + 1;
    });

    return dist;
  }

  /**
   * Calculates percentage distribution
   */
  static percentage(values: ResponseValue[]): Record<string, number> {
    const dist = this.distribution(values);
    const total = values.length;

    const percentages: Record<string, number> = {};
    Object.entries(dist).forEach(([key, count]) => {
      percentages[key] = (count / total) * 100;
    });

    return percentages;
  }

  /**
   * Calculates the median value
   */
  static median(values: number[]): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
      return sorted[mid];
    }
  }

  /**
   * Calculates the mode (most frequent value)
   */
  static mode(values: ResponseValue[]): string | null {
    if (values.length === 0) return null;

    const dist = this.distribution(values);
    let maxCount = 0;
    let modeValue: string | null = null;

    Object.entries(dist).forEach(([value, count]) => {
      if (count > maxCount) {
        maxCount = count;
        modeValue = value;
      }
    });

    return modeValue;
  }

  /**
   * Calculates standard deviation
   */
  static standardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    
    const avg = this.average(values);
    const squaredDiffs = values.map(value => Math.pow(value - avg, 2));
    const avgSquaredDiff = this.average(squaredDiffs);
    
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Calculates min, max, and range
   */
  static range(values: number[]): { min: number; max: number; range: number } {
    if (values.length === 0) {
      return { min: 0, max: 0, range: 0 };
    }
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    return {
      min,
      max,
      range: max - min
    };
  }

  /**
   * Applies weights to values and calculates weighted average
   */
  static weightedAverage(
    values: number[],
    weights: number[]
  ): number {
    if (values.length === 0 || values.length !== weights.length) {
      return 0;
    }
    
    let weightedSum = 0;
    let totalWeight = 0;
    
    for (let i = 0; i < values.length; i++) {
      weightedSum += values[i] * weights[i];
      totalWeight += weights[i];
    }
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Normalizes values to a 0-1 scale
   */
  static normalize(
    values: number[],
    scale?: { min: number; max: number }
  ): number[] {
    if (values.length === 0) return [];
    
    const min = scale?.min ?? Math.min(...values);
    const max = scale?.max ?? Math.max(...values);
    const range = max - min;
    
    if (range === 0) return values.map(() => 0);
    
    return values.map(value => (value - min) / range);
  }
}

