/**
 * PDFRenderer - Renders PDF type reports
 * 
 * Generates downloadable PDF reports with charts and data
 */

'use client';

import { ReactNode } from 'react';
import { BaseRenderer } from './BaseRenderer';
import {
  ReportType,
  ComputedReportData,
  ReportTemplateConfig,
  ConfigOptions
} from '../types';
import type { jsPDF } from 'jspdf';

export class PDFRenderer extends BaseRenderer {
  type: ReportType = 'pdf';

  /**
   * Renders the PDF report preview
   */
  render(data: ComputedReportData, config: ReportTemplateConfig): ReactNode {
    this.validateData(data);
    this.validateConfig(config);

    if (!config.pdf) {
      throw new Error('PDF configuration is required');
    }

    const { template = 'default', options = {} } = config.pdf;

    return (
      <div className="pdf-report-preview">
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-900">
            📄 This is a PDF report. Click the download button below to generate and download the PDF.
          </p>
        </div>

        {/* Preview content */}
        <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
          {this.renderPreview(data, template, options)}
        </div>

        {/* Download button */}
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => this.downloadPDF(data, config)}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 flex items-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Download PDF Report
          </button>
        </div>
      </div>
    );
  }

  /**
   * Renders a preview of the PDF content
   */
  private renderPreview(
    data: ComputedReportData,
    template: string,
    options: ConfigOptions
  ): ReactNode {
    const dimensions = this.getDimensions(data);
    const metrics = this.getMetrics(data);

    return (
      <div className="pdf-preview">
        {/* Header */}
        <div className="mb-8 border-b pb-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {options.title || 'Report'}
          </h1>
          {options.subtitle && (
            <p className="text-lg text-gray-600">{options.subtitle}</p>
          )}
          <p className="text-sm text-gray-500 mt-2">
            Generated: {new Date(data.generated_at).toLocaleDateString()}
          </p>
        </div>

        {/* Overall Score */}
        {data.overall_score !== undefined && (
          <div className="mb-8 p-6 bg-blue-50 rounded-lg">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Overall Score
            </h2>
            <p className="text-4xl font-bold text-blue-600">
              {this.formatNumber(data.overall_score, 1)}
            </p>
          </div>
        )}

        {/* Dimensions */}
        {Object.keys(dimensions).length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Dimensions
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(dimensions).map(([key, dim]) => (
                <div key={key} className="p-4 border border-gray-200 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-700 mb-1">
                    {key}
                  </h3>
                  <p className="text-2xl font-bold text-gray-900">
                    {this.formatNumber(dim.value, 1)}
                  </p>
                  {dim.responses && (
                    <p className="text-xs text-gray-500 mt-1">
                      {dim.responses} responses
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metrics */}
        {Object.keys(metrics).length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Additional Metrics
            </h2>
            <div className="space-y-2">
              {Object.entries(metrics).map(([key, value]) => (
                <div key={key} className="flex justify-between py-2 border-b">
                  <span className="text-gray-700">{key}</span>
                  <span className="font-medium text-gray-900">
                    {typeof value === 'number' ? this.formatNumber(value, 2) : value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t text-sm text-gray-500">
          <p>Total Responses: {data.response_count}</p>
          {data.completion_rate !== undefined && (
            <p>Completion Rate: {this.formatPercentage(data.completion_rate)}</p>
          )}
        </div>
      </div>
    );
  }

  /**
   * Downloads the PDF report
   */
  private async downloadPDF(
    data: ComputedReportData,
    config: ReportTemplateConfig
  ): Promise<void> {
    // Dynamic import to avoid SSR issues
    const { jsPDF } = await import('jspdf');

    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4');

    // Add content
    this.addPDFContent(pdf, data, config);

    // Download
    const filename = config.pdf?.options?.filename || 'report.pdf';
    pdf.save(filename);
  }

  /**
   * Adds content to the PDF
   */
  private addPDFContent(
    pdf: jsPDF,
    data: ComputedReportData,
    config: ReportTemplateConfig
  ): void {
    const margin = 20;
    let yPosition = margin;

    // Title
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.text(config.pdf?.options?.title || 'Report', margin, yPosition);
    yPosition += 15;

    // Date
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Generated: ${new Date(data.generated_at).toLocaleDateString()}`, margin, yPosition);
    yPosition += 15;

    // Overall Score
    if (data.overall_score !== undefined) {
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Overall Score', margin, yPosition);
      yPosition += 10;
      pdf.setFontSize(32);
      pdf.text(this.formatNumber(data.overall_score, 1), margin, yPosition);
      yPosition += 20;
    }

    // Dimensions
    const dimensions = this.getDimensions(data);
    if (Object.keys(dimensions).length > 0) {
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Dimensions', margin, yPosition);
      yPosition += 10;

      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      Object.entries(dimensions).forEach(([key, dim]) => {
        pdf.text(`${key}: ${this.formatNumber(dim.value, 1)}`, margin, yPosition);
        yPosition += 8;
      });
    }
  }
}

