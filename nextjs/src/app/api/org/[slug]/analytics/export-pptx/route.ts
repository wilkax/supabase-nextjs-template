/**
 * PowerPoint Export API
 * 
 * Generates PowerPoint presentations from analytics data
 */

import { NextRequest, NextResponse } from 'next/server';
import PptxGenJS from 'pptxgenjs';

interface ExportRequest {
  questionnaireId: string;
  data: {
    questions: Record<string, QuestionData>;
    responseCount: number;
    questionnaireTitle: string;
  };
}

interface QuestionData {
  questionText: string;
  sectionTitle: string;
  type: string;
  scale?: {
    min: number;
    max: number;
    minLabel: string;
    maxLabel: string;
  };
  responseCount: number;
  // Scale question properties
  average?: number;
  median?: number;
  min?: number;
  max?: number;
  distribution?: Record<string, number>;
  // Single-choice properties
  options?: string[];
  topAnswer?: string;
  // Multiple-choice properties
  totalSelections?: number;
  // Ranking properties
  averageRanks?: Record<string, number>;
  rankCounts?: Record<string, number>;
  // Free-text properties
  responses?: string[];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json() as ExportRequest;
    const { data } = body;

    if (!data || !data.questions) {
      return NextResponse.json(
        { error: 'Missing required data' },
        { status: 400 }
      );
    }

    // Create new PowerPoint presentation
    const pptx = new PptxGenJS();

    // Set presentation properties
    pptx.author = 'OrgView Analytics';
    pptx.company = 'OrgView';
    pptx.title = `${data.questionnaireTitle} - Analytics Report`;

    // Title slide
    const titleSlide = pptx.addSlide();
    titleSlide.background = { color: '1E40AF' }; // Blue background
    titleSlide.addText(data.questionnaireTitle, {
      x: 0.5,
      y: 2.0,
      w: 9,
      h: 1.5,
      fontSize: 44,
      bold: true,
      color: 'FFFFFF',
      align: 'center'
    });
    titleSlide.addText('Analytics Report', {
      x: 0.5,
      y: 3.5,
      w: 9,
      h: 0.5,
      fontSize: 24,
      color: 'E5E7EB',
      align: 'center'
    });
    titleSlide.addText(`${data.responseCount} Responses`, {
      x: 0.5,
      y: 4.2,
      w: 9,
      h: 0.4,
      fontSize: 18,
      color: 'D1D5DB',
      align: 'center'
    });
    titleSlide.addText(new Date().toLocaleDateString(), {
      x: 0.5,
      y: 4.8,
      w: 9,
      h: 0.3,
      fontSize: 14,
      color: 'D1D5DB',
      align: 'center'
    });

    // Group questions by section
    const questionsBySection: Record<string, Array<[string, QuestionData]>> = {};
    Object.entries(data.questions).forEach(([questionId, questionData]) => {
      const section = questionData.sectionTitle;
      if (!questionsBySection[section]) {
        questionsBySection[section] = [];
      }
      questionsBySection[section].push([questionId, questionData]);
    });

    // Create slides for each section
    Object.entries(questionsBySection).forEach(([sectionTitle, questions]) => {
      // Section title slide
      const sectionSlide = pptx.addSlide();
      sectionSlide.background = { color: 'F3F4F6' };
      sectionSlide.addText(sectionTitle, {
        x: 0.5,
        y: 2.5,
        w: 9,
        h: 1.0,
        fontSize: 36,
        bold: true,
        color: '1F2937',
        align: 'center'
      });

      // Create a slide for each question
      questions.forEach(([questionId, questionData]) => {
        const slide = pptx.addSlide();

        // Question title
        slide.addText(questionData.questionText, {
          x: 0.5,
          y: 0.5,
          w: 9,
          h: 0.8,
          fontSize: 20,
          bold: true,
          color: '1F2937'
        });

        const statsY = 1.5;

        // Type-specific rendering
        if (questionData.type === 'scale') {
          // Scale question - numeric stats
          slide.addText('Statistics', {
            x: 0.5,
            y: statsY,
            w: 4,
            h: 0.4,
            fontSize: 16,
            bold: true,
            color: '374151'
          });

          const stats = [
            `Average: ${questionData.average}`,
            `Median: ${questionData.median}`,
            `Min: ${questionData.min} | Max: ${questionData.max}`,
            `Responses: ${questionData.responseCount}`
          ];

          stats.forEach((stat, index) => {
            slide.addText(stat, {
              x: 0.5,
              y: statsY + 0.5 + (index * 0.35),
              w: 4,
              h: 0.3,
              fontSize: 14,
              color: '4B5563'
            });
          });

          // Distribution chart
          if (questionData.distribution && Object.keys(questionData.distribution).length > 0) {
            const chartData = Object.entries(questionData.distribution)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([value, count]) => ({
                name: `Value ${value}`,
                labels: [value],
                values: [count]
              }));

            slide.addChart(pptx.ChartType.bar, chartData, {
              x: 5.0,
              y: 1.5,
              w: 4.5,
              h: 3.5,
              title: 'Response Distribution',
              showTitle: true,
              titleFontSize: 14,
              titleColor: '374151',
              showLegend: false,
              barDir: 'col',
              catAxisLabelColor: '6B7280',
              catAxisLabelFontSize: 10,
              valAxisLabelColor: '6B7280',
              valAxisLabelFontSize: 10
            });
          }
        } else if (questionData.type === 'single-choice') {
          // Single choice question
          slide.addText('Statistics', {
            x: 0.5,
            y: statsY,
            w: 4,
            h: 0.4,
            fontSize: 16,
            bold: true,
            color: '374151'
          });

          const stats = [
            `Responses: ${questionData.responseCount}`,
            `Top Answer: ${questionData.topAnswer || 'N/A'}`
          ];

          stats.forEach((stat, index) => {
            slide.addText(stat, {
              x: 0.5,
              y: statsY + 0.5 + (index * 0.35),
              w: 4,
              h: 0.3,
              fontSize: 14,
              color: '4B5563'
            });
          });

          // Distribution chart
          if (questionData.distribution && Object.keys(questionData.distribution).length > 0) {
            const chartData = (questionData.options || Object.keys(questionData.distribution)).map((option: string) => ({
              name: option,
              labels: [option],
              values: [questionData.distribution![option] || 0]
            }));

            slide.addChart(pptx.ChartType.bar, chartData, {
              x: 5.0,
              y: 1.5,
              w: 4.5,
              h: 3.5,
              title: 'Response Distribution',
              showTitle: true,
              titleFontSize: 14,
              titleColor: '374151',
              showLegend: false,
              barDir: 'bar',
              catAxisLabelColor: '6B7280',
              catAxisLabelFontSize: 10,
              valAxisLabelColor: '6B7280',
              valAxisLabelFontSize: 10
            });
          }
        } else if (questionData.type === 'multiple-choice') {
          // Multiple choice question
          slide.addText('Statistics', {
            x: 0.5,
            y: statsY,
            w: 4,
            h: 0.4,
            fontSize: 16,
            bold: true,
            color: '374151'
          });

          const stats = [
            `Responses: ${questionData.responseCount}`,
            `Total Selections: ${questionData.totalSelections || 0}`
          ];

          stats.forEach((stat, index) => {
            slide.addText(stat, {
              x: 0.5,
              y: statsY + 0.5 + (index * 0.35),
              w: 4,
              h: 0.3,
              fontSize: 14,
              color: '4B5563'
            });
          });

          // Distribution chart
          if (questionData.distribution && Object.keys(questionData.distribution).length > 0) {
            const chartData = (questionData.options || Object.keys(questionData.distribution)).map((option: string) => ({
              name: option,
              labels: [option],
              values: [questionData.distribution![option] || 0]
            }));

            slide.addChart(pptx.ChartType.bar, chartData, {
              x: 5.0,
              y: 1.5,
              w: 4.5,
              h: 3.5,
              title: 'Selection Count',
              showTitle: true,
              titleFontSize: 14,
              titleColor: '374151',
              showLegend: false,
              barDir: 'bar',
              catAxisLabelColor: '6B7280',
              catAxisLabelFontSize: 10,
              valAxisLabelColor: '6B7280',
              valAxisLabelFontSize: 10
            });
          }
        } else if (questionData.type === 'ranking') {
          // Ranking question
          slide.addText('Average Ranks (lower is better)', {
            x: 0.5,
            y: statsY,
            w: 4,
            h: 0.4,
            fontSize: 16,
            bold: true,
            color: '374151'
          });

          slide.addText(`Responses: ${questionData.responseCount}`, {
            x: 0.5,
            y: statsY + 0.5,
            w: 4,
            h: 0.3,
            fontSize: 14,
            color: '4B5563'
          });

          // Average rank chart
          if (questionData.averageRanks && Object.keys(questionData.averageRanks).length > 0) {
            const sortedOptions = (questionData.options || [])
              .map((option: string) => ({
                option,
                avgRank: questionData.averageRanks![option] || 999
              }))
              .sort((a: any, b: any) => a.avgRank - b.avgRank);

            const chartData = sortedOptions.map(({ option, avgRank }: any) => ({
              name: option,
              labels: [option],
              values: [avgRank === 999 ? 0 : avgRank]
            }));

            slide.addChart(pptx.ChartType.bar, chartData, {
              x: 5.0,
              y: 1.5,
              w: 4.5,
              h: 3.5,
              title: 'Average Rank',
              showTitle: true,
              titleFontSize: 14,
              titleColor: '374151',
              showLegend: false,
              barDir: 'bar',
              catAxisLabelColor: '6B7280',
              catAxisLabelFontSize: 10,
              valAxisLabelColor: '6B7280',
              valAxisLabelFontSize: 10
            });
          }
        } else if (questionData.type === 'free-text') {
          // Free text question
          slide.addText(`Text Responses (${questionData.responseCount})`, {
            x: 0.5,
            y: statsY,
            w: 9,
            h: 0.4,
            fontSize: 16,
            bold: true,
            color: '374151'
          });

          // Add up to 10 responses as text
          const responses = questionData.responses || [];
          const maxResponses = Math.min(10, responses.length);

          for (let i = 0; i < maxResponses; i++) {
            slide.addText(`${i + 1}. ${responses[i]}`, {
              x: 0.5,
              y: statsY + 0.6 + (i * 0.35),
              w: 9,
              h: 0.3,
              fontSize: 11,
              color: '4B5563'
            });
          }

          if (responses.length > 10) {
            slide.addText(`... and ${responses.length - 10} more responses`, {
              x: 0.5,
              y: statsY + 0.6 + (10 * 0.35),
              w: 9,
              h: 0.3,
              fontSize: 11,
              italic: true,
              color: '6B7280'
            });
          }
        }
      });
    });

    // Generate PowerPoint file
    const pptxData = await pptx.write({ outputType: 'arraybuffer' });

    // Return as downloadable file
    return new NextResponse(pptxData as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="analytics-${Date.now()}.pptx"`
      }
    });

  } catch (error) {
    console.error('PowerPoint export error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PowerPoint' },
      { status: 500 }
    );
  }
}

