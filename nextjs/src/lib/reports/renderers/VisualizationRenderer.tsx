/**
 * VisualizationRenderer - Renders visualization type reports
 * 
 * Supports both standard charts (via Chart.js) and custom visualizations
 */

'use client';

import { ReactNode } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Line, Pie, Radar } from 'react-chartjs-2';
import { BaseRenderer } from './BaseRenderer';
import {
  ReportType,
  ComputedReportData,
  ReportTemplateConfig,
  VisualizationType,
  ConfigOptions
} from '../types';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Custom visualization registry
type CustomVisualizationComponent = React.ComponentType<{
  data: ComputedReportData;
  options: ConfigOptions;
}>;

const customVisualizations: Record<string, CustomVisualizationComponent> = {};

export class VisualizationRenderer extends BaseRenderer {
  type: ReportType = 'visualization';

  /**
   * Registers a custom visualization component
   */
  static registerCustomVisualization(
    name: string,
    component: CustomVisualizationComponent
  ): void {
    customVisualizations[name] = component;
  }

  /**
   * Renders the visualization
   */
  render(data: ComputedReportData, config: ReportTemplateConfig): ReactNode {
    this.validateData(data);
    this.validateConfig(config);

    if (!config.visualization) {
      throw new Error('Visualization configuration is required');
    }

    const { type, options = {} } = config.visualization;

    // Check if it's a custom visualization
    if (type in customVisualizations) {
      const CustomComponent = customVisualizations[type];
      return <CustomComponent data={data} options={options} />;
    }

    // Render standard Chart.js visualization
    return this.renderStandardChart(type, data, config, options);
  }

  /**
   * Renders a standard Chart.js chart
   */
  private renderStandardChart(
    type: VisualizationType,
    data: ComputedReportData,
    config: ReportTemplateConfig,
    options: ConfigOptions
  ): ReactNode {
    const chartData = this.prepareChartData(data, config);
    const chartOptions = this.prepareChartOptions(options);

    switch (type) {
      case 'bar':
        return <Bar data={chartData} options={chartOptions} />;
      case 'line':
        return <Line data={chartData} options={chartOptions} />;
      case 'pie':
        return <Pie data={chartData} options={chartOptions} />;
      case 'radar':
        return <Radar data={chartData} options={chartOptions} />;
      default:
        throw new Error(`Unsupported visualization type: ${type}`);
    }
  }

  /**
   * Prepares data for Chart.js
   */
  private prepareChartData(
    data: ComputedReportData,
    config: ReportTemplateConfig
  ): {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      backgroundColor: string[];
      borderColor: string[];
      borderWidth: number;
      fill: boolean;
    }>;
  } {
    const dimensions = this.getDimensions(data);
    const labels = Object.keys(dimensions);
    const values = Object.values(dimensions).map((d) => d.value || 0);

    return {
      labels,
      datasets: [
        {
          label: (config.visualization?.options?.label as string) || 'Values',
          data: values,
          backgroundColor: this.generateColors(values.length, 0.6),
          borderColor: this.generateColors(values.length, 1),
          borderWidth: 2,
          fill: config.visualization?.type === 'radar'
        }
      ]
    };
  }

  /**
   * Prepares options for Chart.js
   */
  private prepareChartOptions(options: ConfigOptions): Record<string, unknown> {
    return {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: options.legendPosition || 'top',
          display: options.showLegend !== false
        },
        title: {
          display: !!options.title,
          text: options.title || ''
        },
        tooltip: {
          enabled: options.showTooltip !== false
        }
      },
      scales: options.hideScales ? undefined : {
        y: {
          beginAtZero: true,
          max: options.maxValue || undefined
        }
      },
      ...options.chartOptions
    };
  }

  /**
   * Generates colors for chart elements
   */
  private generateColors(count: number, alpha: number = 1): string[] {
    const baseColors = [
      `rgba(59, 130, 246, ${alpha})`,   // blue
      `rgba(16, 185, 129, ${alpha})`,   // green
      `rgba(245, 158, 11, ${alpha})`,   // orange
      `rgba(239, 68, 68, ${alpha})`,    // red
      `rgba(139, 92, 246, ${alpha})`,   // purple
      `rgba(236, 72, 153, ${alpha})`    // pink
    ];

    const colors: string[] = [];
    for (let i = 0; i < count; i++) {
      colors.push(baseColors[i % baseColors.length]);
    }
    return colors;
  }
}

