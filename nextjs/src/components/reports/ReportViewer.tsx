/**
 * ReportViewer - Main component for displaying reports
 * 
 * Uses ReportRendererFactory to get the appropriate renderer and display the report
 */

'use client';

import { ReportRendererFactory } from '@/lib/reports/renderers/ReportRendererFactory';
import {
  ComputedReportData,
  ReportTemplateConfig,
  ReportType,
  ReportStatus
} from '@/lib/reports/types';

interface ReportViewerProps {
  reportType: ReportType;
  status: ReportStatus;
  computedData: ComputedReportData;
  config: ReportTemplateConfig;
  title?: string;
  description?: string;
  className?: string;
}

export function ReportViewer({
  reportType,
  status,
  computedData,
  config,
  title,
  description,
  className = ''
}: ReportViewerProps) {
  // Handle different statuses
  if (status === 'pending' || status === 'generating') {
    return (
      <div className={`flex flex-col items-center justify-center p-12 ${className}`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-lg font-medium text-gray-700">
          {status === 'pending' ? 'Report pending...' : 'Generating report...'}
        </p>
        <p className="text-sm text-gray-500 mt-2">
          This may take a few moments
        </p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={`flex flex-col items-center justify-center p-12 ${className}`}>
        <div className="rounded-full bg-red-100 p-3 mb-4">
          <svg
            className="h-8 w-8 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <p className="text-lg font-medium text-gray-900">Report generation failed</p>
        <p className="text-sm text-gray-500 mt-2">
          Please try generating the report again
        </p>
      </div>
    );
  }

  // Check if we have sufficient data
  if (!computedData || !computedData.response_count || computedData.response_count < 5) {
    return (
      <div className={`flex flex-col items-center justify-center p-12 ${className}`}>
        <div className="rounded-full bg-yellow-100 p-3 mb-4">
          <svg
            className="h-8 w-8 text-yellow-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <p className="text-lg font-medium text-gray-900">Insufficient data</p>
        <p className="text-sm text-gray-500 mt-2">
          At least 5 responses are required to generate this report
        </p>
        <p className="text-sm text-gray-500">
          Current responses: {computedData?.response_count || 0}
        </p>
      </div>
    );
  }

  // Render the report
  try {
    const renderer = ReportRendererFactory.getRenderer(reportType);
    const reportContent = renderer.render(computedData, config);

    return (
      <div className={`report-viewer ${className}`}>
        {(title || description) && (
          <div className="mb-6">
            {title && (
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
            )}
            {description && (
              <p className="text-gray-600">{description}</p>
            )}
          </div>
        )}

        <div className="report-content bg-white rounded-lg shadow-sm p-6">
          {reportContent}
        </div>

        {/* Metadata footer */}
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
          <div>
            <span className="font-medium">Responses:</span> {computedData.response_count}
          </div>
          {computedData.completion_rate !== undefined && (
            <div>
              <span className="font-medium">Completion rate:</span>{' '}
              {(computedData.completion_rate * 100).toFixed(1)}%
            </div>
          )}
          {computedData.generated_at && (
            <div>
              <span className="font-medium">Generated:</span>{' '}
              {new Date(computedData.generated_at).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error rendering report:', error);
    return (
      <div className={`flex flex-col items-center justify-center p-12 ${className}`}>
        <div className="rounded-full bg-red-100 p-3 mb-4">
          <svg
            className="h-8 w-8 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
        <p className="text-lg font-medium text-gray-900">Error rendering report</p>
        <p className="text-sm text-gray-500 mt-2">
          {error instanceof Error ? error.message : 'Unknown error occurred'}
        </p>
      </div>
    );
  }
}

