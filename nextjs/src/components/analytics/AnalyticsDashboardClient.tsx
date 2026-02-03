'use client';

import { useState, useEffect } from 'react';
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
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState<string>('');
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [aggregatedData, setAggregatedData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'none' | 'average-desc' | 'average-asc' | 'median-desc' | 'median-asc'>('none');
  const [expandedSections, setExpandedSections] = useState<string[]>([]);

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
    if (!aggregatedData) return;

    try {
      const response = await fetch(`/api/org/${slug}/analytics/export-pptx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionnaireId: selectedQuestionnaire,
          data: aggregatedData,
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics Dashboard</h1>
        <p className="text-gray-600">
          Filter and visualize questionnaire data, then export to PowerPoint
        </p>
      </div>

      {/* Horizontal Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Questionnaire Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Questionnaire
            </label>
            <select
              value={selectedQuestionnaire}
              onChange={(e) => setSelectedQuestionnaire(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">Select a questionnaire</option>
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
                Sections & Questions
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
                            {selectedSections.includes(section.id) ? 'Deselect All' : 'Select All'}
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
                  {selectedSections.length === sections.length ? 'Clear All' : 'Select All'}
                </button>
              </div>
            </div>
          )}

          {/* Sort By */}
          {aggregatedData && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="none">Default Order</option>
                <option value="average-desc">Average (High to Low)</option>
                <option value="average-asc">Average (Low to High)</option>
                <option value="median-desc">Median (High to Low)</option>
                <option value="median-asc">Median (Low to High)</option>
              </select>
            </div>
          )}
        </div>

        {/* Export Button */}
        {aggregatedData && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleExportPowerPoint}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Download className="h-4 w-4" />
              Export to PowerPoint
            </button>
          </div>
        )}
      </div>

      {/* Visualization Area */}
      <div>
        {!selectedQuestionnaire ? (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Questionnaire</h3>
            <p className="text-gray-500">
              Choose a questionnaire from the filters to start visualizing data
            </p>
          </div>
        ) : selectedQuestions.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <Filter className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Select Questions</h3>
            <p className="text-gray-500">
              Choose sections or questions to visualize their data
            </p>
          </div>
        ) : loading ? (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading data...</p>
          </div>
        ) : aggregatedData ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                  <h3 className="text-sm font-medium text-gray-600">Questions</h3>
                </div>
                <p className="text-2xl font-bold text-gray-900">{selectedQuestions.length}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <h3 className="text-sm font-medium text-gray-600">Responses</h3>
                </div>
                <p className="text-2xl font-bold text-gray-900">{aggregatedData.responseCount}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <PieChart className="h-5 w-5 text-purple-600" />
                  <h3 className="text-sm font-medium text-gray-600">Avg Score</h3>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {Object.values(aggregatedData.questions).length > 0
                    ? (
                        Object.values(aggregatedData.questions).reduce((sum: number, q: any) => sum + q.average, 0)
                        / Object.values(aggregatedData.questions).length
                      ).toFixed(2)
                    : '0.00'}
                </p>
              </div>
            </div>

            {/* Question Charts - Using sorted questions */}
            <div className="space-y-6">
              {getSortedQuestions().map(([questionId, questionData]: [string, any]) => (
                <div key={questionId} className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {questionData.questionText}
                    </h3>
                    <p className="text-sm text-gray-500">{questionData.sectionTitle}</p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Statistics */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Statistics</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Average:</span>
                          <span className="text-sm font-semibold text-gray-900">{questionData.average}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Median:</span>
                          <span className="text-sm font-semibold text-gray-900">{questionData.median}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Range:</span>
                          <span className="text-sm font-semibold text-gray-900">
                            {questionData.min} - {questionData.max}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Responses:</span>
                          <span className="text-sm font-semibold text-gray-900">{questionData.responseCount}</span>
                        </div>
                        {questionData.scale && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="text-xs text-gray-500">
                              Scale: {questionData.scale.min} ({questionData.scale.minLabel}) - {questionData.scale.max} ({questionData.scale.maxLabel})
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Distribution Chart */}
                    {Object.keys(questionData.distribution).length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Distribution</h4>
                        <div className="h-64">
                          <Bar
                            data={{
                              labels: Object.keys(questionData.distribution).sort((a, b) => Number(a) - Number(b)),
                              datasets: [
                                {
                                  label: 'Response Count',
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
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

