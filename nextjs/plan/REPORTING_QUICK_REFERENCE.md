# Reporting System - Quick Reference Guide

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        REPORTING SYSTEM                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│  │   APPROACH   │──────│ QUESTIONNAIRE│──────│   RESPONSES  │  │
│  │   TEMPLATES  │      │   INSTANCE   │      │              │  │
│  └──────────────┘      └──────────────┘      └──────────────┘  │
│         │                      │                      │         │
│         │                      │                      │         │
│         ▼                      ▼                      ▼         │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│  │    REPORT    │──────│     DATA     │──────│   COMPUTED   │  │
│  │   TEMPLATES  │      │  AGGREGATOR  │      │     DATA     │  │
│  └──────────────┘      └──────────────┘      └──────────────┘  │
│         │                                            │         │
│         │                                            │         │
│         ▼                                            ▼         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              REPORT RENDERER FACTORY                     │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  Visualization  │      PDF       │     Dashboard         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│                    ┌──────────────────┐                         │
│                    │  REPORT VIEWER   │                         │
│                    └──────────────────┘                         │
└─────────────────────────────────────────────────────────────────┘
```

## Key Concepts

### 1. Approach
A methodology for analyzing organizations (e.g., "Laloux Flower", "Team Health Check")
- Defines questionnaire structure
- Defines report types and configurations
- Reusable across multiple organizations

### 2. Report Template
A blueprint for generating a specific type of report
- Belongs to an Approach
- Defines data mappings (which questions → which report elements)
- Specifies visualization/PDF/dashboard configuration
- Type: `visualization` | `pdf` | `dashboard`

### 3. Organization Report
An instance of a report template for a specific organization's questionnaire
- Generated from responses
- Stores computed/aggregated data
- Cached for performance
- Status: `pending` | `generating` | `ready` | `error`

### 4. Data Mapping
Configuration that maps questionnaire questions to report data points
```typescript
{
  "dimension_name": {
    questionIds: ["q1", "q2", "q3"],
    aggregationType: "average"
  }
}
```

### 5. Computed Data
Aggregated and processed data ready for visualization
```typescript
{
  "dimension_name": {
    value: 3.8,
    responses: 25,
    distribution: { "1": 0, "2": 2, "3": 8, "4": 10, "5": 5 }
  }
}
```

## File Structure

```
nextjs/
├── src/
│   ├── lib/
│   │   └── reports/
│   │       ├── core/
│   │       │   ├── DataAggregator.ts
│   │       │   ├── QuestionMapper.ts
│   │       │   ├── StatisticalCalculator.ts
│   │       │   └── DataTransformer.ts
│   │       ├── renderers/
│   │       │   ├── BaseRenderer.ts
│   │       │   ├── VisualizationRenderer.tsx
│   │       │   ├── PDFRenderer.tsx
│   │       │   └── DashboardRenderer.tsx
│   │       ├── generators/
│   │       │   └── ReportGenerator.ts
│   │       ├── aggregators/
│   │       │   ├── average.ts
│   │       │   ├── distribution.ts
│   │       │   └── custom/
│   │       └── types.ts
│   │
│   ├── components/
│   │   └── reports/
│   │       ├── ReportViewer.tsx
│   │       ├── visualizations/
│   │       │   ├── RadarChart.tsx
│   │       │   ├── BarChart.tsx
│   │       │   ├── LalouFlower.tsx
│   │       │   └── ChartWrapper.tsx
│   │       ├── pdf/
│   │       │   ├── PDFTemplate.tsx
│   │       │   └── PDFGenerator.ts
│   │       └── dashboard/
│   │           ├── DashboardLayout.tsx
│   │           └── widgets/
│   │               ├── MetricCard.tsx
│   │               ├── ChartWidget.tsx
│   │               └── TableWidget.tsx
│   │
│   └── app/
│       ├── api/
│       │   └── org/
│       │       └── [slug]/
│       │           └── reports/
│       │               ├── generate/
│       │               │   └── route.ts
│       │               └── [reportId]/
│       │                   ├── route.ts
│       │                   └── export/
│       │                       └── route.ts
│       │
│       └── app/
│           └── org/
│               └── [slug]/
│                   └── questionnaires/
│                       └── [id]/
│                           └── reports/
│                               ├── page.tsx
│                               └── [reportSlug]/
│                                   └── page.tsx
│
└── supabase/
    └── migrations/
        └── YYYYMMDD_create_organization_reports.sql
```

## Database Schema

### organization_reports
```sql
id                UUID PRIMARY KEY
organization_id   UUID → organizations(id)
template_id       UUID → approach_report_templates(id)
questionnaire_id  UUID → questionnaires(id)
status            TEXT (pending|generating|ready|error)
computed_data     JSONB
config_override   JSONB
generated_at      TIMESTAMP
error_message     TEXT
response_count    INTEGER
created_at        TIMESTAMP
updated_at        TIMESTAMP

UNIQUE(organization_id, template_id, questionnaire_id)
```

## Common Workflows

### Admin: Create New Approach with Reports

1. Navigate to `/app/admin/approaches`
2. Click "Create Approach"
3. Fill in approach details (name, slug, description)
4. Create questionnaire template
   - Add sections and questions
   - Define question types and scales
5. Create report templates
   - Choose type (visualization/pdf/dashboard)
   - Configure data mappings
   - Set visualization options
6. Activate approach

### Admin: Configure Report Template

1. Navigate to `/app/admin/approaches/[id]`
2. Click "Add Report Template"
3. Fill in basic info:
   - Name: "Laloux Flower Visualization"
   - Slug: "laloux-flower"
   - Type: "visualization"
4. Configure data mappings (JSON):
```json
{
  "dataMappings": {
    "purpose": {
      "questionIds": ["q1", "q2", "q3"],
      "aggregationType": "average"
    }
  },
  "visualization": {
    "type": "flower",
    "dimensions": ["purpose", "wholeness", ...],
    "options": { ... }
  }
}
```
5. Save template

### Org Admin: Generate Reports

1. Navigate to `/app/org/[slug]/questionnaires/[id]`
2. Wait for sufficient responses (minimum 5)
3. Click "Generate Reports" button
4. Wait for generation (status: generating → ready)
5. View reports in "Reports" tab

### Org Admin: View Report

1. Navigate to `/app/org/[slug]/questionnaires/[id]/reports`
2. See list of available reports
3. Click on report to view
4. Options:
   - Export as PDF
   - Share link
   - Print
   - Regenerate (if new responses)

## API Endpoints Reference

### Generate Report
```
POST /api/org/[slug]/reports/generate
Body: { questionnaireId, templateId?, force? }
Response: { success, reports: [...] }
```

### Get Report Data
```
GET /api/org/[slug]/reports/[reportId]
Response: { id, template, questionnaire, status, computedData, metadata }
```

### List Reports for Questionnaire
```
GET /api/org/[slug]/questionnaires/[id]/reports
Response: { questionnaire, availableReports: [...], canGenerate, minimumResponses }
```

### Export Report
```
GET /api/org/[slug]/reports/[reportId]/export?format=pdf
Response: Blob (PDF file)
```

## Configuration Examples

### Simple Average Report
```json
{
  "type": "visualization",
  "config": {
    "dataMappings": {
      "satisfaction": {
        "questionIds": ["q1", "q2", "q3"],
        "aggregationType": "average"
      }
    },
    "visualization": {
      "type": "bar",
      "dimensions": ["satisfaction"],
      "options": {
        "title": "Average Satisfaction",
        "xAxis": { "label": "Score" },
        "yAxis": { "label": "Questions" }
      }
    }
  }
}
```

### Laloux Flower Report
```json
{
  "type": "visualization",
  "config": {
    "dataMappings": {
      "purpose": { "questionIds": ["q1", "q2", "q3"], "aggregationType": "average" },
      "wholeness": { "questionIds": ["q4", "q5", "q6"], "aggregationType": "average" },
      "self_management": { "questionIds": ["q7", "q8", "q9"], "aggregationType": "average" }
    },
    "visualization": {
      "type": "flower",
      "dimensions": ["purpose", "wholeness", "self_management"],
      "options": {
        "petals": 6,
        "colors": ["#FF6B6B", "#4ECDC4", "#45B7D1"],
        "interactive": true
      }
    }
  }
}
```

### Dashboard Report
```json
{
  "type": "dashboard",
  "config": {
    "dataMappings": {
      "overall_score": { "questionIds": ["*"], "aggregationType": "average" },
      "response_count": { "questionIds": ["*"], "aggregationType": "count" }
    },
    "dashboard": {
      "layout": "grid",
      "widgets": [
        {
          "type": "metric",
          "position": { "row": 0, "col": 0, "span": 1 },
          "dataSource": "overall_score",
          "options": { "label": "Overall Score", "format": "decimal" }
        },
        {
          "type": "metric",
          "position": { "row": 0, "col": 1, "span": 1 },
          "dataSource": "response_count",
          "options": { "label": "Responses", "format": "integer" }
        }
      ]
    }
  }
}
```

## Aggregation Types

| Type | Description | Use Case | Example |
|------|-------------|----------|---------|
| `average` | Mean of numeric values | Scale questions (1-5) | Average satisfaction: 3.8 |
| `sum` | Total of numeric values | Count-based questions | Total points: 95 |
| `count` | Number of responses | Response tracking | 25 responses |
| `distribution` | Frequency of each value | Understanding spread | {1: 2, 2: 5, 3: 10, 4: 6, 5: 2} |
| `percentage` | Percentage breakdown | Multiple choice | {A: 40%, B: 35%, C: 25%} |
| `median` | Middle value | Skewed distributions | Median score: 4 |
| `mode` | Most common value | Finding consensus | Most common: "Agree" |

## Report Types

### Visualization
- **Purpose:** Interactive charts and graphs
- **Best For:** Quick insights, presentations
- **Technologies:** Chart.js, D3.js, custom SVG
- **Examples:** Bar charts, radar charts, Laloux Flower

### PDF
- **Purpose:** Printable, shareable documents
- **Best For:** Formal reports, archiving
- **Technologies:** react-pdf, Puppeteer
- **Examples:** Executive summary, detailed analysis

### Dashboard
- **Purpose:** Multi-metric overview
- **Best For:** Real-time monitoring, KPIs
- **Technologies:** React components, grid layout
- **Examples:** Org health dashboard, progress tracker

## Performance Guidelines

### Response Count Thresholds
- **Minimum for generation:** 5 responses (privacy)
- **Optimal:** 20-50 responses (statistical significance)
- **Large dataset:** 100+ responses (consider pagination)

### Generation Time Estimates
- **Small (< 50 responses):** < 2 seconds
- **Medium (50-200 responses):** 2-5 seconds
- **Large (200-500 responses):** 5-15 seconds
- **Very Large (500+ responses):** 15-60 seconds (background job)

### Caching Strategy
- **Active questionnaires:** Cache for 24 hours
- **Closed questionnaires:** Cache permanently
- **Invalidation:** On new response (if incremental enabled)

## Troubleshooting

### Report Generation Fails
**Symptoms:** Status stuck on "generating" or shows "error"

**Common Causes:**
1. Insufficient responses (< 5)
2. Invalid data mapping configuration
3. Missing questions in responses
4. Database connection timeout

**Solutions:**
1. Check response count
2. Validate template config JSON
3. Review questionnaire schema vs responses
4. Check server logs for detailed error

### Report Shows No Data
**Symptoms:** Report renders but shows empty/zero values

**Common Causes:**
1. Question IDs mismatch
2. Wrong aggregation type
3. Data not yet computed

**Solutions:**
1. Verify question IDs in template config match questionnaire schema
2. Check aggregation type is appropriate for question type
3. Regenerate report manually

### Visualization Not Rendering
**Symptoms:** Blank space where chart should be

**Common Causes:**
1. Invalid visualization config
2. Missing data dimensions
3. Browser compatibility

**Solutions:**
1. Validate visualization options
2. Ensure all dimensions have data
3. Check browser console for errors

## Security Checklist

- [ ] Minimum 5 responses before showing aggregated data
- [ ] No individual response drill-down in reports
- [ ] RLS policies on `organization_reports` table
- [ ] Validate user has org membership before viewing
- [ ] Sanitize free-text responses (future)
- [ ] Rate limiting on report generation API
- [ ] Audit log for report access

## Next Steps After Planning

1. **Review Planning Documents**
   - [ ] REPORTING_SYSTEM_ARCHITECTURE.md
   - [ ] REPORTING_IMPLEMENTATION_GUIDE.md
   - [ ] REPORTING_QUICK_REFERENCE.md (this file)

2. **Make Key Decisions**
   - [ ] Approve data model
   - [ ] Confirm report types to implement
   - [ ] Choose visualization libraries
   - [ ] Decide on caching strategy

3. **Begin Implementation**
   - [ ] Create database migration
   - [ ] Build core services
   - [ ] Implement first renderer
   - [ ] Create report viewer UI

4. **Test & Iterate**
   - [ ] Unit tests
   - [ ] Integration tests
   - [ ] User acceptance testing
   - [ ] Performance optimization

---

**Quick Links:**
- [Full Architecture](./REPORTING_SYSTEM_ARCHITECTURE.md)
- [Implementation Guide](./REPORTING_IMPLEMENTATION_GUIDE.md)
- [Database Schema](../supabase/migrations/)
- [API Routes](../src/app/api/org/)

**Status:** Planning Complete - Ready for Implementation
**Last Updated:** 2026-02-01


