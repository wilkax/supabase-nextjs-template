# Reporting System Architecture Plan

## Executive Summary

This document outlines the architecture for a generic, extensible reporting system that can adapt to multiple organizational analysis approaches. The first implementation will be the "Laloux Flower" approach, but the system is designed to support any approach with questionnaires and various report types.

## Current State Analysis

### Existing Components
- ✅ **Approaches**: System for defining different analysis methodologies
- ✅ **Questionnaire Templates**: Approach-specific questionnaire schemas
- ✅ **Questionnaire Instances**: Organization-specific questionnaires
- ✅ **Response Collection**: Participant response submission system
- ✅ **Report Templates**: Basic template structure (type, config, order)
- ❌ **Report Generation**: Not implemented
- ❌ **Report Viewing**: Not implemented
- ❌ **Data Aggregation**: Not implemented

### Database Schema (Existing)
```
approaches
├── approach_questionnaire_templates (questionnaire schemas)
└── approach_report_templates (report definitions)

organizations
├── questionnaires (instances of templates)
├── participants
└── questionnaire_responses (participant answers)
```

## Architecture Design

### 1. Core Principles

**Separation of Concerns**
- Template Definition (Admin) ↔ Report Generation (System) ↔ Report Viewing (User)
- Data Collection ↔ Data Processing ↔ Data Presentation

**Extensibility**
- Plugin-based renderer system for different report types
- Generic data aggregation layer
- Configurable report templates via JSON

**Performance**
- Computed data caching in `organization_reports` table
- Incremental regeneration on new responses
- Lazy loading for large datasets

### 2. Data Model Extensions

#### New Table: `organization_reports`
```sql
CREATE TABLE organization_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  template_id UUID NOT NULL REFERENCES approach_report_templates(id),
  questionnaire_id UUID NOT NULL REFERENCES questionnaires(id),
  
  -- Report state
  status TEXT NOT NULL DEFAULT 'pending', -- pending|generating|ready|error
  
  -- Cached computed data
  computed_data JSONB NOT NULL DEFAULT '{}',
  
  -- Allow org-specific customization
  config_override JSONB DEFAULT '{}',
  
  -- Metadata
  generated_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  response_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(organization_id, template_id, questionnaire_id)
);
```

### 3. Report Template Configuration Schema

Each `approach_report_templates.config` will follow this structure:

```typescript
interface ReportTemplateConfig {
  // Data mapping: which questions feed which report elements
  dataMappings: {
    [reportElementId: string]: {
      questionIds: string[]
      aggregationType: 'average' | 'sum' | 'count' | 'distribution' | 'custom'
      transformFunction?: string // Reference to custom transform
    }
  }
  
  // Visualization-specific config
  visualization?: {
    type: 'radar' | 'bar' | 'line' | 'pie' | 'flower' | 'custom'
    dimensions: string[] // Which data points to visualize
    options: Record<string, any> // Chart.js or custom options
  }
  
  // PDF-specific config
  pdf?: {
    template: string // Reference to PDF template
    sections: Array<{
      type: 'text' | 'chart' | 'table' | 'custom'
      dataSource: string
    }>
  }
  
  // Dashboard-specific config
  dashboard?: {
    layout: 'grid' | 'flex'
    widgets: Array<{
      type: string
      position: { row: number, col: number, span: number }
      dataSource: string
    }>
  }
}
```

## 4. Component Architecture

### Data Processing Layer (`/lib/reports/`)

**Core Services:**
- `DataAggregator`: Collects and aggregates questionnaire responses
- `QuestionMapper`: Maps question IDs to response data
- `StatisticalCalculator`: Computes averages, distributions, etc.
- `DataTransformer`: Applies custom transformations per report config

**File Structure:**
```
lib/reports/
├── core/
│   ├── DataAggregator.ts
│   ├── QuestionMapper.ts
│   ├── StatisticalCalculator.ts
│   └── DataTransformer.ts
├── renderers/
│   ├── BaseRenderer.ts
│   ├── VisualizationRenderer.tsx
│   ├── PDFRenderer.tsx
│   └── DashboardRenderer.tsx
├── generators/
│   └── ReportGenerator.ts
└── types.ts
```

### Rendering Layer (`/components/reports/`)

**Renderer Components:**
- `ReportViewer`: Main container component
- `VisualizationReport`: Renders charts (Chart.js, D3, custom)
- `PDFReport`: Generates/displays PDF reports
- `DashboardReport`: Multi-widget dashboard layout

**File Structure:**
```
components/reports/
├── ReportViewer.tsx
├── visualizations/
│   ├── RadarChart.tsx
│   ├── BarChart.tsx
│   ├── LalouFlower.tsx (custom for Laloux)
│   └── ChartWrapper.tsx
├── pdf/
│   ├── PDFTemplate.tsx
│   └── PDFGenerator.ts
└── dashboard/
    ├── DashboardLayout.tsx
    └── widgets/
        ├── MetricCard.tsx
        ├── ChartWidget.tsx
        └── TableWidget.tsx
```

## 5. Report Generation Flow

### Trigger Points
1. **Manual**: Admin clicks "Generate Report" button
2. **Automatic**: After questionnaire closes (status → 'closed')
3. **Incremental**: On new response submission (if enabled)

### Generation Process
```
1. Fetch questionnaire responses
2. Map responses to report template data mappings
3. Aggregate data per configuration
4. Apply statistical calculations
5. Transform data for visualization
6. Cache computed_data in organization_reports
7. Update status to 'ready'
```

### API Endpoints
```typescript
// Generate/regenerate report
POST /api/org/[slug]/reports/generate
Body: { questionnaireId, templateId }

// Get report data
GET /api/org/[slug]/reports/[reportId]

// List available reports for questionnaire
GET /api/org/[slug]/questionnaires/[id]/reports

// Export report (PDF download)
GET /api/org/[slug]/reports/[reportId]/export
```

## 6. Generic Data Mapping Strategy

### Question-to-Data Mapping

The key to genericity is the mapping configuration in `approach_report_templates.config`:

```typescript
// Example: Laloux Flower mapping
{
  dataMappings: {
    "purpose_dimension": {
      questionIds: ["q1", "q2", "q3"], // Questions about purpose
      aggregationType: "average",
      scale: { min: 1, max: 5 }
    },
    "wholeness_dimension": {
      questionIds: ["q4", "q5", "q6"],
      aggregationType: "average",
      scale: { min: 1, max: 5 }
    },
    // ... other dimensions
  },
  visualization: {
    type: "flower",
    dimensions: ["purpose_dimension", "wholeness_dimension", ...],
    options: {
      petals: 6,
      colors: ["#FF6B6B", "#4ECDC4", ...]
    }
  }
}
```

### Aggregation Types

**Built-in Aggregators:**
- `average`: Mean of numeric responses
- `sum`: Total of numeric responses
- `count`: Number of responses
- `distribution`: Frequency distribution
- `percentage`: Percentage breakdown
- `median`: Middle value
- `mode`: Most common value

**Custom Aggregators:**
- Defined in `lib/reports/aggregators/custom/`
- Referenced by name in config
- Implement `AggregatorInterface`

## 7. Laloux Flower Implementation Example

### Questionnaire Structure
```typescript
{
  sections: [
    {
      id: "purpose",
      title: "Evolutionary Purpose",
      questions: [
        { id: "q1", text: "...", type: "scale", scale: { min: 1, max: 5 } },
        { id: "q2", text: "...", type: "scale", scale: { min: 1, max: 5 } },
        { id: "q3", text: "...", type: "scale", scale: { min: 1, max: 5 } }
      ]
    },
    // ... 5 more sections for other dimensions
  ]
}
```

### Report Template Config
```typescript
{
  dataMappings: {
    "purpose": { questionIds: ["q1", "q2", "q3"], aggregationType: "average" },
    "wholeness": { questionIds: ["q4", "q5", "q6"], aggregationType: "average" },
    "self_management": { questionIds: ["q7", "q8", "q9"], aggregationType: "average" },
    // ... other dimensions
  },
  visualization: {
    type: "flower",
    dimensions: ["purpose", "wholeness", "self_management", ...],
    options: {
      centerLabel: "Organization Maturity",
      showLegend: true,
      interactive: true
    }
  }
}
```

### Computed Data Structure
```typescript
{
  dimensions: {
    purpose: { value: 3.8, responses: 25, distribution: {...} },
    wholeness: { value: 4.2, responses: 25, distribution: {...} },
    // ...
  },
  overall_score: 3.9,
  response_count: 25,
  completion_rate: 0.83,
  generated_at: "2024-01-15T10:30:00Z"
}
```

## 8. UI/UX Flow

### Organization Admin Perspective

**Step 1: Questionnaire Completion**
- Navigate to `/app/org/[slug]/questionnaires/[id]`
- View response progress
- See "Generate Reports" button when sufficient responses

**Step 2: Report Generation**
- Click "Generate Reports" or wait for auto-generation
- See loading state with progress indicator
- Receive notification when reports are ready

**Step 3: Report Viewing**
- Navigate to `/app/org/[slug]/questionnaires/[id]/reports`
- See list of available reports (from approach templates)
- Click on report to view
- Options: Export PDF, Share link, Print

**Report Viewer Page Structure:**
```
/app/org/[slug]/questionnaires/[id]/reports/[reportSlug]
├── Header (Report title, description, metadata)
├── Filters (date range, participant segments, etc.)
├── Report Content (visualization/pdf/dashboard)
└── Actions (Export, Share, Regenerate)
```

### System Admin Perspective

**Approach Configuration:**
```
/app/admin/approaches/[id]
├── Questionnaire Template Editor
└── Report Templates
    ├── Add Report Template
    │   ├── Name, Slug, Type
    │   ├── Data Mappings Configuration
    │   └── Visualization/PDF/Dashboard Config
    └── Edit Report Template
        └── Visual Config Editor (future enhancement)
```

## 9. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Create `organization_reports` table migration
- [ ] Build `DataAggregator` core service
- [ ] Implement `QuestionMapper` utility
- [ ] Create basic `ReportGenerator` service
- [ ] Add API endpoints for report generation

### Phase 2: Visualization Renderer (Week 3-4)
- [ ] Build `VisualizationRenderer` component
- [ ] Implement Chart.js integration
- [ ] Create `LalouFlower` custom visualization
- [ ] Build `ReportViewer` container component
- [ ] Create report viewing pages

### Phase 3: Data Processing (Week 5)
- [ ] Implement `StatisticalCalculator`
- [ ] Build aggregation functions
- [ ] Add caching mechanism
- [ ] Implement incremental updates
- [ ] Add error handling and retry logic

### Phase 4: PDF & Dashboard (Week 6-7)
- [ ] Implement `PDFRenderer` with react-pdf
- [ ] Create PDF templates
- [ ] Build `DashboardRenderer` component
- [ ] Implement dashboard widgets
- [ ] Add export functionality

### Phase 5: Polish & Testing (Week 8)
- [ ] Add loading states and error handling
- [ ] Implement report sharing
- [ ] Add filters and date ranges
- [ ] Performance optimization
- [ ] End-to-end testing

## 10. Technical Decisions

### Visualization Library
**Choice: Chart.js + Custom D3 for Laloux Flower**
- Pros: Lightweight, well-documented, React-friendly
- Cons: Less flexible than D3 for custom viz
- Decision: Use Chart.js for standard charts, D3 for custom

### PDF Generation
**Choice: react-pdf**
- Pros: React components → PDF, server-side rendering
- Cons: Learning curve, limited styling
- Alternative: Puppeteer (heavier, more flexible)

### State Management
**Choice: React Query for data fetching + local state**
- Pros: Built-in caching, refetching, optimistic updates
- Cons: Additional dependency
- Decision: Use for report data, avoid global state complexity

### Caching Strategy
**Choice: Database-level caching in `computed_data`**
- Pros: Persistent, shareable, version-controlled
- Cons: Requires regeneration logic
- Decision: Cache computed results, invalidate on new responses

## 11. Configuration Examples

### Example 1: Simple Bar Chart Report
```typescript
{
  type: "visualization",
  config: {
    dataMappings: {
      "satisfaction_scores": {
        questionIds: ["q1", "q2", "q3"],
        aggregationType: "average"
      }
    },
    visualization: {
      type: "bar",
      dimensions: ["satisfaction_scores"],
      options: {
        title: "Average Satisfaction Scores",
        xAxis: { label: "Questions" },
        yAxis: { label: "Score (1-5)" }
      }
    }
  }
}
```

### Example 2: Multi-Widget Dashboard
```typescript
{
  type: "dashboard",
  config: {
    dataMappings: {
      "overall_score": { questionIds: ["*"], aggregationType: "average" },
      "response_rate": { questionIds: ["*"], aggregationType: "count" },
      "dimension_scores": { questionIds: ["q1-q18"], aggregationType: "average" }
    },
    dashboard: {
      layout: "grid",
      widgets: [
        {
          type: "metric",
          position: { row: 0, col: 0, span: 1 },
          dataSource: "overall_score",
          options: { label: "Overall Score", format: "decimal" }
        },
        {
          type: "chart",
          position: { row: 1, col: 0, span: 2 },
          dataSource: "dimension_scores",
          options: { type: "radar" }
        }
      ]
    }
  }
}
```

## 12. Security & Permissions

### Access Control
- **System Admin**: Full access to approach and template configuration
- **Org Admin**: Can generate and view reports for their organization
- **Org Auditor**: Read-only access to reports
- **Participants**: No access to aggregated reports

### RLS Policies
```sql
-- organization_reports table
CREATE POLICY "Org members can view their reports"
  ON organization_reports FOR SELECT
  USING (is_org_member(organization_id));

CREATE POLICY "Org admins can generate reports"
  ON organization_reports FOR INSERT
  USING (is_org_admin(organization_id));
```

## 13. Future Enhancements

### Short-term
- Visual report template editor (drag-and-drop)
- Report scheduling (weekly/monthly auto-generation)
- Email notifications when reports are ready
- Comparative reports (compare across time periods)

### Long-term
- AI-powered insights and recommendations
- Custom report builder for org admins
- Real-time collaborative annotations
- Integration with external BI tools
- Multi-language report support

## 14. Success Metrics

### Technical Metrics
- Report generation time < 5 seconds for 100 responses
- Cache hit rate > 80%
- Zero data loss during aggregation
- 99.9% uptime for report viewing

### User Metrics
- Time to first report < 2 minutes after questionnaire close
- Report view rate > 70% of questionnaires
- Export rate > 30% of report views
- User satisfaction score > 4/5

---

## Appendix A: Type Definitions

```typescript
// Core types for the reporting system

export type ReportType = 'visualization' | 'pdf' | 'dashboard'

export type AggregationType =
  | 'average'
  | 'sum'
  | 'count'
  | 'distribution'
  | 'percentage'
  | 'median'
  | 'mode'
  | 'custom'

export interface DataMapping {
  questionIds: string[]
  aggregationType: AggregationType
  transformFunction?: string
  scale?: { min: number; max: number }
  filters?: Record<string, any>
}

export interface ReportTemplateConfig {
  dataMappings: Record<string, DataMapping>
  visualization?: VisualizationConfig
  pdf?: PDFConfig
  dashboard?: DashboardConfig
}

export interface ComputedReportData {
  [key: string]: {
    value: number | string | object
    responses: number
    distribution?: Record<string, number>
    metadata?: Record<string, any>
  }
}

export interface OrganizationReport {
  id: string
  organization_id: string
  template_id: string
  questionnaire_id: string
  status: 'pending' | 'generating' | 'ready' | 'error'
  computed_data: ComputedReportData
  config_override?: Partial<ReportTemplateConfig>
  generated_at?: string
  error_message?: string
  response_count: number
}
```

---

**Document Version:** 1.0
**Last Updated:** 2026-02-01
**Status:** Planning Phase - No Implementation Yet

