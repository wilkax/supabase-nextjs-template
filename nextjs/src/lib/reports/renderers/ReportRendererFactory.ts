/**
 * ReportRendererFactory - Factory for creating report renderers
 * 
 * Manages renderer instances and provides the appropriate renderer for each report type
 */

import { ReportRenderer, ReportType } from '../types';
import { VisualizationRenderer } from './VisualizationRenderer';
import { PDFRenderer } from './PDFRenderer';
import { DashboardRenderer } from './DashboardRenderer';
import { LalouFlower } from '@/components/reports/visualizations/LalouFlower';

// Register custom visualizations
VisualizationRenderer.registerCustomVisualization('flower', LalouFlower);

export class ReportRendererFactory {
  private static renderers: Map<ReportType, ReportRenderer> = new Map();

  /**
   * Initializes all renderers
   */
  static initialize(): void {
    // Register all renderers
    this.registerRenderer(new VisualizationRenderer());
    this.registerRenderer(new PDFRenderer());
    this.registerRenderer(new DashboardRenderer());
  }

  /**
   * Registers a renderer
   */
  static registerRenderer(renderer: ReportRenderer): void {
    this.renderers.set(renderer.type, renderer);
  }

  /**
   * Gets the appropriate renderer for a report type
   */
  static getRenderer(type: ReportType): ReportRenderer {
    // Initialize if not already done
    if (this.renderers.size === 0) {
      this.initialize();
    }

    const renderer = this.renderers.get(type);
    if (!renderer) {
      throw new Error(`No renderer found for report type: ${type}`);
    }

    return renderer;
  }

  /**
   * Checks if a renderer exists for a report type
   */
  static hasRenderer(type: ReportType): boolean {
    if (this.renderers.size === 0) {
      this.initialize();
    }
    return this.renderers.has(type);
  }

  /**
   * Gets all registered renderer types
   */
  static getAvailableTypes(): ReportType[] {
    if (this.renderers.size === 0) {
      this.initialize();
    }
    return Array.from(this.renderers.keys());
  }
}

