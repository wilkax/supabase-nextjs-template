/**
 * Reporting System - Main Export File
 *
 * Exports all core services, types, and utilities for the reporting system
 */

// Core Services
export { DataAggregator, InsufficientDataError } from './core/DataAggregator';
export { QuestionMapper } from './core/QuestionMapper';
export { StatisticalCalculator } from './core/StatisticalCalculator';

// Generators
export { ReportGenerator } from './generators/ReportGenerator';

// Renderers
export { BaseRenderer } from './renderers/BaseRenderer';
export { VisualizationRenderer } from './renderers/VisualizationRenderer';
export { PDFRenderer } from './renderers/PDFRenderer';
export { DashboardRenderer } from './renderers/DashboardRenderer';
export { ReportRendererFactory } from './renderers/ReportRendererFactory';

// Types
export * from './types';

