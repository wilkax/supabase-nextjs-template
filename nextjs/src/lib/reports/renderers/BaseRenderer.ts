/**
 * BaseRenderer - Abstract base class for all report renderers
 * 
 * Provides common validation and utility methods for all renderer types
 */

import { ReactNode } from 'react';
import {
  ReportRenderer,
  ReportType,
  ComputedReportData,
  ReportTemplateConfig,
  ValidationResult
} from '../types';

export abstract class BaseRenderer implements ReportRenderer {
  abstract type: ReportType;

  /**
   * Renders the report
   * Must be implemented by subclasses
   */
  abstract render(
    data: ComputedReportData,
    config: ReportTemplateConfig
  ): ReactNode;

  /**
   * Validates the configuration
   * Returns validation result with any errors
   */
  validate(config: ReportTemplateConfig): ValidationResult {
    const errors: string[] = [];

    if (!config) {
      errors.push('Report configuration is required');
    } else {
      if (!config.dataMappings || Object.keys(config.dataMappings).length === 0) {
        errors.push('Data mappings are required in configuration');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates that the data is sufficient for rendering
   */
  protected validateData(data: ComputedReportData): void {
    if (!data) {
      throw new Error('Report data is required');
    }

    if (!data.response_count || data.response_count < 5) {
      throw new Error('Insufficient responses for report generation (minimum 5 required)');
    }

    if (data.response_count === 0) {
      throw new Error('No responses available for this report');
    }
  }

  /**
   * Validates that the configuration is valid for this renderer type
   */
  protected validateConfig(config: ReportTemplateConfig): void {
    if (!config) {
      throw new Error('Report configuration is required');
    }

    if (!config.dataMappings || Object.keys(config.dataMappings).length === 0) {
      throw new Error('Data mappings are required in configuration');
    }
  }

  /**
   * Checks if the renderer can handle this report type
   */
  canRender(reportType: ReportType): boolean {
    return this.type === reportType;
  }

  /**
   * Gets a safe value from data with fallback
   */
  protected getSafeValue<T = unknown>(
    data: ComputedReportData,
    path: string,
    defaultValue: T | null = null
  ): T | null {
    const keys = path.split('.');
    let value: unknown = data;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return defaultValue;
      }
    }

    return value !== undefined ? (value as T) : defaultValue;
  }

  /**
   * Formats a number for display
   */
  protected formatNumber(value: number, decimals: number = 2): string {
    if (typeof value !== 'number' || isNaN(value)) {
      return '0';
    }
    return value.toFixed(decimals);
  }

  /**
   * Formats a percentage for display
   */
  protected formatPercentage(value: number, decimals: number = 1): string {
    if (typeof value !== 'number' || isNaN(value)) {
      return '0%';
    }
    return `${(value * 100).toFixed(decimals)}%`;
  }

  /**
   * Gets color for a value based on scale
   */
  protected getColorForValue(
    value: number,
    min: number = 0,
    max: number = 100
  ): string {
    const normalized = (value - min) / (max - min);

    if (normalized < 0.33) {
      return '#ef4444'; // red
    } else if (normalized < 0.67) {
      return '#f59e0b'; // orange
    } else {
      return '#10b981'; // green
    }
  }

  /**
   * Extracts dimension data from computed data
   */
  protected getDimensions(data: ComputedReportData): Record<string, import('../types').DimensionData> {
    return data.dimensions || {};
  }

  /**
   * Extracts metrics from computed data
   */
  protected getMetrics(data: ComputedReportData): Record<string, number | string> {
    return data.metrics || {};
  }
}

