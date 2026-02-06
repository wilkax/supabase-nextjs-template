'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Filter, Download, BarChart3, PieChart, TrendingUp } from 'lucide-react';
import { Json } from '@/lib/types';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface Organization {
  id: string;
  name: string;
}

interface Questionnaire {
  id: string;
  title: string;
  status: string;
  schema: Json;
  approach_questionnaire_id: string | null;
  created_at: string;
  responseCount: number;
}

interface Approach {
  id: string;
  name: string;
  slug: string;
}

interface Section {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
}

interface Question {
  id: string;
  text: string;
  type: string;
  scale?: {
    min: number;
    max: number;
    minLabel: string;
    maxLabel: string;
  };
  options?: string[];
  maxLength?: number;
}

interface QuestionnaireSchema {
  sections: Section[];
}

interface Props {
  organization: Organization;
  questionnaires: Questionnaire[];
  approaches: Approach[];
  slug: string;
}

export function AnalyticsDashboardClient({ organization, questionnaires, approaches, slug }: Props) {
  const t = useTranslations('analytics');
  const c = useTranslations('common');
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState<string>('');
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [aggregatedData, setAggregatedData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'none' | 'average-desc' | 'average-asc' | 'median-desc' | 'median-asc'>('none');
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [selectedChartsForExport, setSelectedChartsForExport] = useState<string[]>([]);

  // Extract sections when questionnaire is selected
  useEffect(() => {
    if (selectedQuestionnaire) {
      const questionnaire = questionnaires.find(q => q.id === selectedQuestionnaire);
      if (questionnaire && questionnaire.schema) {
        const schema = questionnaire.schema as unknown as QuestionnaireSchema;
        setSections(schema.sections || []);
        setSelectedSections([]);
        setSelectedQuestions([]);
        setExpandedSections([]);
      }
    } else {
      setSections([]);
      setSelectedSections([]);
      setSelectedQuestions([]);
      setExpandedSections([]);
    }
  }, [selectedQuestionnaire, questionnaires]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.section-dropdown')) {
        setExpandedSections([]);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch aggregated data when filters change
  useEffect(() => {
    if (selectedQuestionnaire && selectedQuestions.length > 0) {
      fetchAggregatedData();
    } else {
      setAggregatedData(null);
    }
  }, [selectedQuestionnaire, selectedQuestions]);

  const fetchAggregatedData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/org/${slug}/analytics/aggregate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionnaireId: selectedQuestionnaire,
          questionIds: selectedQuestions,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAggregatedData(data);
      }
    } catch (error) {
      console.error('Failed to fetch aggregated data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSectionToggle = (sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;

    const sectionQuestionIds = section.questions.map(q => q.id);

    if (selectedSections.includes(sectionId)) {
      // Deselect section and its questions
      setSelectedSections(prev => prev.filter(id => id !== sectionId));
      setSelectedQuestions(prev => prev.filter(id => !sectionQuestionIds.includes(id)));
    } else {
      // Select section and all its questions
      setSelectedSections(prev => [...prev, sectionId]);
      setSelectedQuestions(prev => [...new Set([...prev, ...sectionQuestionIds])]);
    }
  };

  const handleQuestionToggle = (questionId: string) => {
    if (selectedQuestions.includes(questionId)) {
      setSelectedQuestions(prev => prev.filter(id => id !== questionId));
    } else {
      setSelectedQuestions(prev => [...prev, questionId]);
    }
  };

  const toggleSectionExpanded = (sectionId: string) => {
    if (expandedSections.includes(sectionId)) {
      setExpandedSections(prev => prev.filter(id => id !== sectionId));
    } else {
      setExpandedSections(prev => [...prev, sectionId]);
    }
  };

  // Toggle chart selection for export
  const toggleChartSelection = (questionId: string) => {
    if (selectedChartsForExport.includes(questionId)) {
      setSelectedChartsForExport(prev => prev.filter(id => id !== questionId));
    } else {
      setSelectedChartsForExport(prev => [...prev, questionId]);
    }
  };

  // Select all charts
  const handleSelectAllCharts = () => {
    if (!aggregatedData || !aggregatedData.questions) return;
    const allQuestionIds = Object.keys(aggregatedData.questions);
    setSelectedChartsForExport(allQuestionIds);
  };

  // Deselect all charts
  const handleDeselectAllCharts = () => {
    setSelectedChartsForExport([]);
  };

  // Sort questions based on selected sort option
  const getSortedQuestions = () => {
    if (!aggregatedData || !aggregatedData.questions) return [];

    const questionEntries = Object.entries(aggregatedData.questions);

    if (sortBy === 'none') {
      return questionEntries;
    }

    return questionEntries.sort(([, a]: [string, any], [, b]: [string, any]) => {
      if (sortBy === 'average-desc') return b.average - a.average;
      if (sortBy === 'average-asc') return a.average - b.average;
      if (sortBy === 'median-desc') return b.median - a.median;
      if (sortBy === 'median-asc') return a.median - b.median;
      return 0;
    });
  };

  const handleExportPowerPoint = async () => {
    if (!aggregatedData || selectedChartsForExport.length === 0) return;

    try {
      // Filter data to only include selected charts
      const filteredData = {
        ...aggregatedData,
        questions: Object.fromEntries(
          Object.entries(aggregatedData.questions).filter(([id]) =>
            selectedChartsForExport.includes(id)
          )
        )
      };

      const response = await fetch(`/api/org/${slug}/analytics/export-pptx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionnaireId: selectedQuestionnaire,
          data: filteredData,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-${Date.now()}.pptx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to export PowerPoint:', error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('title')}</h1>
        <p className="text-gray-600">
          {t('description')}
        </p>
      </div>

      {/* Horizontal Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">{t('filters')}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Questionnaire Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('questionnaire')}
            </label>
            <select
              value={selectedQuestionnaire}
              onChange={(e) => setSelectedQuestionnaire(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">{t('selectQuestionnaire')}</option>
              {questionnaires.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title} ({q.responseCount} responses)
                </option>
              ))}
            </select>
          </div>

          {/* Sections & Questions Dropdown */}
          {sections.length > 0 && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('sectionsAndQuestions')}
              </label>
              <div className="flex gap-2 flex-wrap">
                {sections.map((section) => (
                  <div key={section.id} className="relative section-dropdown">
                    <button
                      onClick={() => toggleSectionExpanded(section.id)}
                      className={`px-3 py-2 text-sm border rounded-md transition-colors ${
                        selectedSections.includes(section.id)
                          ? 'bg-blue-50 border-blue-300 text-blue-700'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {section.title}
                      <span className="ml-1 text-xs">
                        ({section.questions.filter(q => selectedQuestions.includes(q.id)).length} / {section.questions.length})
                      </span>
                    </button>

                    {expandedSections.includes(section.id) && (
                      <div className="absolute z-10 mt-1 w-80 bg-white border border-gray-200 rounded-md shadow-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-900">{section.title}</span>
                          <button
                            onClick={() => handleSectionToggle(section.id)}
                            className="text-xs text-blue-600 hover:text-blue-700"
                          >
                            {selectedSections.includes(section.id) ? t('deselectAll') : t('selectAll')}
                          </button>
                        </div>
                        <div className="max-h-64 overflow-y-auto space-y-2">
                          {section.questions.map((question) => (
                            <label key={question.id} className="flex items-start gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                              <input
                                type="checkbox"
                                checked={selectedQuestions.includes(question.id)}
                                onChange={() => handleQuestionToggle(question.id)}
                                className="mt-0.5 h-3.5 w-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-xs text-gray-700">{question.text}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => {
                    if (selectedSections.length === sections.length) {
                      setSelectedSections([]);
                      setSelectedQuestions([]);
                    } else {
                      setSelectedSections(sections.map(s => s.id));
                      setSelectedQuestions(sections.flatMap(s => s.questions.map(q => q.id)));
                    }
                  }}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  {selectedSections.length === sections.length ? t('deselectAll') : t('selectAll')}
                </button>
              </div>
            </div>
          )}

          {/* Sort By */}
          {aggregatedData && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('sortBy')}
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="none">{t('defaultOrder')}</option>
                <option value="average-desc">{t('averageHighToLow')}</option>
                <option value="average-asc">{t('averageLowToHigh')}</option>
                <option value="median-desc">{t('medianHighToLow')}</option>
                <option value="median-asc">{t('medianLowToHigh')}</option>
              </select>
            </div>
          )}
        </div>

        {/* Export Controls */}
        {aggregatedData && (
          <div className="mt-4 flex justify-between items-center">
            <div className="flex gap-2">
              <button
                onClick={handleSelectAllCharts}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                {t('selectAll')}
              </button>
              <button
                onClick={handleDeselectAllCharts}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                {t('deselectAll')}
              </button>
              <span className="px-3 py-2 text-sm text-gray-600">
                {t('chartsSelected', { count: selectedChartsForExport.length })}
              </span>
            </div>
            <button
              onClick={handleExportPowerPoint}
              disabled={selectedChartsForExport.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4" />
              {t('exportToPowerPoint', { count: selectedChartsForExport.length })}
            </button>
          </div>
        )}
      </div>

      {/* Visualization Area */}
      <div>
        {!selectedQuestionnaire ? (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('selectQuestionnaire')}</h3>
            <p className="text-gray-500">
              {t('chooseQuestionnaireToVisualize')}
            </p>
          </div>
        ) : selectedQuestions.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <Filter className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('selectQuestions')}</h3>
            <p className="text-gray-500">
              {t('chooseSectionsOrQuestions')}
            </p>
          </div>
        ) : loading ? (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">{c('loading')}</p>
          </div>
        ) : aggregatedData ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                  <h3 className="text-sm font-medium text-gray-600">{t('questions')}</h3>
                </div>
                <p className="text-2xl font-bold text-gray-900">{selectedQuestions.length}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <h3 className="text-sm font-medium text-gray-600">{t('responses')}</h3>
                </div>
                <p className="text-2xl font-bold text-gray-900">{aggregatedData.responseCount}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <PieChart className="h-5 w-5 text-purple-600" />
                  <h3 className="text-sm font-medium text-gray-600">
                    {(() => {
                      const scaleQuestions = Object.values(aggregatedData.questions).filter((q: any) => q.type === 'scale');
                      return scaleQuestions.length > 0 ? t('avgScore') : t('questionTypes');
                    })()}
                  </h3>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {(() => {
                    const scaleQuestions = Object.values(aggregatedData.questions).filter((q: any) => q.type === 'scale');
                    if (scaleQuestions.length > 0) {
                      const avg = scaleQuestions.reduce((sum: number, q: any) => sum + (q.average || 0), 0) / scaleQuestions.length;
                      return avg.toFixed(2);
                    } else {
                      // Show count of question types
                      const types = Object.values(aggregatedData.questions).reduce((acc: Record<string, number>, q: any) => {
                        acc[q.type] = (acc[q.type] || 0) + 1;
                        return acc;
                      }, {});
                      return Object.entries(types).map(([type, count]) => `${count} ${type}`).join(', ');
                    }
                  })()}
                </p>
              </div>
            </div>

            {/* Question Charts - Using sorted questions */}
            <div className="space-y-6">
              {getSortedQuestions().map(([questionId, questionData]: [string, any]) => (
                <div
                  key={questionId}
                  className={`bg-white border-2 rounded-lg p-6 transition-all ${
                    selectedChartsForExport.includes(questionId)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {questionData.questionText}
                      </h3>
                      <p className="text-sm text-gray-500">{questionData.sectionTitle}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <input
                        type="checkbox"
                        checked={selectedChartsForExport.includes(questionId)}
                        onChange={() => toggleChartSelection(questionId)}
                        className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                        title="Select for export"
                      />
                      <label className="text-xs text-gray-600">{t('export')}</label>
                    </div>
                  </div>

                  {/* Type-specific rendering */}
                  {questionData.type === 'scale' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Statistics */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-3">{t('statistics')}</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">{t('average')}</span>
                            <span className="text-sm font-semibold text-gray-900">{questionData.average}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">{t('median')}</span>
                            <span className="text-sm font-semibold text-gray-900">{questionData.median}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">{t('range')}</span>
                            <span className="text-sm font-semibold text-gray-900">
                              {questionData.min} - {questionData.max}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">{t('responses')}</span>
                            <span className="text-sm font-semibold text-gray-900">{questionData.responseCount}</span>
                          </div>
                          {questionData.scale && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <div className="text-xs text-gray-500">
                                {t('scale')} {questionData.scale.min} ({questionData.scale.minLabel}) - {questionData.scale.max} ({questionData.scale.maxLabel})
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Distribution Chart */}
                      {Object.keys(questionData.distribution || {}).length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-3">{t('distribution')}</h4>
                          <div className="h-64">
                            <Bar
                              data={{
                                labels: Object.keys(questionData.distribution).sort((a, b) => Number(a) - Number(b)),
                                datasets: [
                                  {
                                    label: t('responseCount'),
                                    data: Object.keys(questionData.distribution)
                                      .sort((a, b) => Number(a) - Number(b))
                                      .map(key => questionData.distribution[key]),
                                    backgroundColor: 'rgba(59, 130, 246, 0.5)',
                                    borderColor: 'rgb(59, 130, 246)',
                                    borderWidth: 1
                                  }
                                ]
                              }}
                              options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                  legend: {
                                    display: false
                                  },
                                  title: {
                                    display: false
                                  }
                                },
                                scales: {
                                  y: {
                                    beginAtZero: true,
                                    ticks: {
                                      stepSize: 1
                                    }
                                  }
                                }
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {questionData.type === 'single-choice' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Statistics */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-3">{t('statistics')}</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">{t('responses')}</span>
                            <span className="text-sm font-semibold text-gray-900">{questionData.responseCount}</span>
                          </div>
                          {questionData.topAnswer && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">{t('topAnswer')}</span>
                              <span className="text-sm font-semibold text-gray-900">{questionData.topAnswer}</span>
                            </div>
                          )}
                        </div>
                        {/* Option breakdown */}
                        <div className="mt-4">
                          <h5 className="text-xs font-medium text-gray-600 mb-2">{t('optionBreakdown')}</h5>
                          <div className="space-y-1">
                            {(questionData.options || []).map((option: string) => {
                              const count = questionData.distribution?.[option] || 0;
                              const percentage = questionData.responseCount > 0
                                ? Math.round((count / questionData.responseCount) * 100)
                                : 0;
                              return (
                                <div key={option} className="text-xs text-gray-600">
                                  <span className="font-medium">{option}:</span> {count} ({percentage}%)
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Distribution Chart */}
                      {(questionData.options?.length > 0 || Object.keys(questionData.distribution || {}).length > 0) && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-3">{t('distribution')}</h4>
                          <div className="h-32">
                            <Bar
                              data={{
                                labels: questionData.options && questionData.options.length > 0
                                  ? questionData.options
                                  : Object.keys(questionData.distribution || {}),
                                datasets: [
                                  {
                                    label: t('responseCount'),
                                    data: (questionData.options && questionData.options.length > 0
                                      ? questionData.options
                                      : Object.keys(questionData.distribution || {})
                                    ).map((option: string) => questionData.distribution?.[option] || 0),
                                    backgroundColor: 'rgba(59, 130, 246, 0.5)',
                                    borderColor: 'rgb(59, 130, 246)',
                                    borderWidth: 1
                                  }
                                ]
                              }}
                              options={{
                                indexAxis: 'y',
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                  legend: {
                                    display: false
                                  }
                                },
                                scales: {
                                  x: {
                                    beginAtZero: true,
                                    ticks: {
                                      stepSize: 1
                                    }
                                  }
                                }
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {questionData.type === 'multiple-choice' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Statistics */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-3">{t('statistics')}</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">{t('responses')}</span>
                            <span className="text-sm font-semibold text-gray-900">{questionData.responseCount}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">{t('totalSelections')}</span>
                            <span className="text-sm font-semibold text-gray-900">{questionData.totalSelections}</span>
                          </div>
                        </div>
                        {/* Option breakdown */}
                        <div className="mt-4">
                          <h5 className="text-xs font-medium text-gray-600 mb-2">{t('optionBreakdown')}</h5>
                          <div className="space-y-1">
                            {(questionData.options || []).map((option: string) => {
                              const count = questionData.distribution?.[option] || 0;
                              const percentage = questionData.responseCount > 0
                                ? Math.round((count / questionData.responseCount) * 100)
                                : 0;
                              return (
                                <div key={option} className="text-xs text-gray-600">
                                  <span className="font-medium">{option}:</span> {count} ({percentage}%)
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Distribution Chart */}
                      {Object.keys(questionData.distribution || {}).length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-3">{t('selectionCount')}</h4>
                          <div className="h-64">
                            <Bar
                              data={{
                                labels: questionData.options || Object.keys(questionData.distribution),
                                datasets: [
                                  {
                                    label: t('timesSelected'),
                                    data: (questionData.options || Object.keys(questionData.distribution)).map(
                                      (option: string) => questionData.distribution[option] || 0
                                    ),
                                    backgroundColor: 'rgba(16, 185, 129, 0.5)',
                                    borderColor: 'rgb(16, 185, 129)',
                                    borderWidth: 1
                                  }
                                ]
                              }}
                              options={{
                                indexAxis: 'y',
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                  legend: {
                                    display: false
                                  }
                                },
                                scales: {
                                  x: {
                                    beginAtZero: true,
                                    ticks: {
                                      stepSize: 1
                                    }
                                  }
                                }
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {questionData.type === 'ranking' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Statistics */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-3">{t('statistics')}</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">{t('responses')}</span>
                            <span className="text-sm font-semibold text-gray-900">{questionData.responseCount}</span>
                          </div>
                        </div>
                        {/* Average ranks */}
                        <div className="mt-4">
                          <h5 className="text-xs font-medium text-gray-600 mb-2">{t('averageRanks')}</h5>
                          <div className="space-y-1">
                            {(questionData.options || [])
                              .map((option: string) => ({
                                option,
                                avgRank: questionData.averageRanks?.[option] || 0,
                                count: questionData.rankCounts?.[option] || 0
                              }))
                              .sort((a: { option: string; avgRank: number; count: number }, b: { option: string; avgRank: number; count: number }) => a.avgRank - b.avgRank)
                              .map(({ option, avgRank, count }: { option: string; avgRank: number; count: number }) => (
                                <div key={option} className="text-xs text-gray-600">
                                  <span className="font-medium">{option}:</span> {avgRank > 0 ? avgRank.toFixed(2) : 'N/A'} ({count} {t('rankings')})
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>

                      {/* Average Rank Chart */}
                      {Object.keys(questionData.averageRanks || {}).length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-3">{t('averageRankChart')}</h4>
                          <div className="h-64">
                            <Bar
                              data={{
                                labels: (questionData.options || [])
                                  .map((option: string) => ({
                                    option,
                                    avgRank: questionData.averageRanks?.[option] || 999
                                  }))
                                  .sort((a: { option: string; avgRank: number }, b: { option: string; avgRank: number }) => a.avgRank - b.avgRank)
                                  .map(({ option }: { option: string; avgRank: number }) => option),
                                datasets: [
                                  {
                                    label: t('averageRank'),
                                    data: (questionData.options || [])
                                      .map((option: string) => ({
                                        option,
                                        avgRank: questionData.averageRanks?.[option] || 999
                                      }))
                                      .sort((a: { option: string; avgRank: number }, b: { option: string; avgRank: number }) => a.avgRank - b.avgRank)
                                      .map(({ avgRank }: { option: string; avgRank: number }) => avgRank === 999 ? 0 : avgRank),
                                    backgroundColor: 'rgba(139, 92, 246, 0.5)',
                                    borderColor: 'rgb(139, 92, 246)',
                                    borderWidth: 1
                                  }
                                ]
                              }}
                              options={{
                                indexAxis: 'y',
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                  legend: {
                                    display: false
                                  }
                                },
                                scales: {
                                  x: {
                                    beginAtZero: true,
                                    reverse: false,
                                    title: {
                                      display: true,
                                      text: t('lowerIsBetter')
                                    }
                                  }
                                }
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {questionData.type === 'free-text' && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-3">
                        {t('textResponses')} ({questionData.responseCount})
                      </h4>
                      <div className="max-h-96 overflow-y-auto space-y-2">
                        {(questionData.responses || []).map((response: string, index: number) => (
                          <div key={index} className="p-3 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700">
                            {response}
                          </div>
                        ))}
                        {(!questionData.responses || questionData.responses.length === 0) && (
                          <p className="text-sm text-gray-500 italic">{t('noResponses')}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

