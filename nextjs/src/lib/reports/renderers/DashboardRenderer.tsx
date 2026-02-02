/**
 * DashboardRenderer - Renders dashboard type reports
 * 
 * Displays multiple widgets and visualizations in a dashboard layout
 */

'use client';

import { ReactNode } from 'react';
import { BaseRenderer } from './BaseRenderer';
import {
  ReportType,
  ComputedReportData,
  ReportTemplateConfig,
  DashboardWidget
} from '../types';

export class DashboardRenderer extends BaseRenderer {
  type: ReportType = 'dashboard';

  /**
   * Renders the dashboard
   */
  render(data: ComputedReportData, config: ReportTemplateConfig): ReactNode {
    this.validateData(data);
    this.validateConfig(config);

    if (!config.dashboard) {
      throw new Error('Dashboard configuration is required');
    }

    const { layout = 'grid', widgets = [] } = config.dashboard;

    return (
      <div className="dashboard-container">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {this.renderSummaryCards(data)}
        </div>

        {/* Main Dashboard Content */}
        <div className={this.getLayoutClass(layout)}>
          {this.renderWidgets(data, widgets)}
        </div>
      </div>
    );
  }

  /**
   * Renders summary cards at the top
   */
  private renderSummaryCards(data: ComputedReportData): ReactNode {
    return (
      <>
        {/* Overall Score Card */}
        {data.overall_score !== undefined && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-sm font-medium text-gray-600 mb-2">
              Overall Score
            </h3>
            <p className="text-3xl font-bold text-blue-600">
              {this.formatNumber(data.overall_score, 1)}
            </p>
            <div className="mt-2 flex items-center">
              <div
                className="h-2 flex-1 bg-gray-200 rounded-full overflow-hidden"
              >
                <div
                  className="h-full bg-blue-600 rounded-full"
                  style={{ width: `${data.overall_score}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Response Count Card */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-600 mb-2">
            Total Responses
          </h3>
          <p className="text-3xl font-bold text-gray-900">
            {data.response_count}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {data.response_count >= 5 ? '✓ Sufficient data' : '⚠ Need more responses'}
          </p>
        </div>

        {/* Completion Rate Card */}
        {data.completion_rate !== undefined && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-sm font-medium text-gray-600 mb-2">
              Completion Rate
            </h3>
            <p className="text-3xl font-bold text-green-600">
              {this.formatPercentage(data.completion_rate)}
            </p>
            <div className="mt-2 flex items-center">
              <div className="h-2 flex-1 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-600 rounded-full"
                  style={{ width: `${data.completion_rate * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  /**
   * Renders dashboard widgets
   */
  private renderWidgets(
    data: ComputedReportData,
    widgets: DashboardWidget[]
  ): ReactNode {
    if (widgets.length === 0) {
      // Default widgets if none specified
      return this.renderDefaultWidgets(data);
    }

    return widgets.map((widget, index) => (
      <div key={index} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        {this.renderWidget(data, widget)}
      </div>
    ));
  }

  /**
   * Renders default widgets when none are configured
   */
  private renderDefaultWidgets(data: ComputedReportData): ReactNode {
    const dimensions = this.getDimensions(data);
    const metrics = this.getMetrics(data);

    return (
      <>
        {/* Dimensions Widget */}
        {Object.keys(dimensions).length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Dimensions
            </h3>
            <div className="space-y-4">
              {Object.entries(dimensions).map(([key, dim]) => (
                <div key={key}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700">{key}</span>
                    <span className="text-sm font-bold text-gray-900">
                      {this.formatNumber(dim.value, 1)}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${dim.value}%`,
                        backgroundColor: this.getColorForValue(dim.value)
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metrics Widget */}
        {Object.keys(metrics).length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Metrics
            </h3>
            <div className="space-y-3">
              {Object.entries(metrics).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">{key}</span>
                  <span className="text-sm font-medium text-gray-900">
                    {typeof value === 'number' ? this.formatNumber(value, 2) : value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    );
  }

  /**
   * Renders a single widget
   */
  private renderWidget(data: ComputedReportData, widget: DashboardWidget): ReactNode {
    // Widget rendering logic based on widget type
    const title = widget.options.title as string | undefined;
    return (
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {title || 'Widget'}
        </h3>
        <p className="text-gray-600">Widget content</p>
      </div>
    );
  }

  /**
   * Gets the CSS class for the layout
   */
  private getLayoutClass(layout: string): string {
    switch (layout) {
      case 'grid':
        return 'grid grid-cols-1 md:grid-cols-2 gap-6';
      case 'single':
        return 'space-y-6';
      case 'three-column':
        return 'grid grid-cols-1 md:grid-cols-3 gap-6';
      default:
        return 'grid grid-cols-1 md:grid-cols-2 gap-6';
    }
  }
}

