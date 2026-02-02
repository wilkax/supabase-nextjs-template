# Reporting System Implementation Guide

## Key Design Decisions & Discussion Points

### 1. Data Aggregation Strategy

#### Option A: Real-time Aggregation
**Approach:** Calculate report data on-demand when viewing
- ✅ Always up-to-date
- ✅ No storage overhead
- ❌ Slow for large datasets
- ❌ Repeated computation

#### Option B: Pre-computed with Caching (RECOMMENDED)
**Approach:** Calculate once, store in `organization_reports.computed_data`
- ✅ Fast report viewing
- ✅ Consistent snapshots
- ✅ Can track changes over time
- ❌ Requires regeneration logic
- ❌ Storage overhead

**Decision:** Use Option B with smart invalidation
- Regenerate on questionnaire status change (draft → active → closed)
- Optional: Incremental updates on new responses
- Cache TTL: 24 hours for active questionnaires, permanent for closed

### 2. Question-to-Report Mapping Flexibility

#### Challenge: Different Approaches Have Different Structures

**Laloux Flower Example:**
- 6 dimensions (Purpose, Wholeness, Self-Management, etc.)
- Each dimension: 3-5 questions
- Aggregation: Average per dimension
- Visualization: Custom flower chart

**Future Approach Example (e.g., "Team Health Check"):**
- 8 categories (Communication, Trust, Autonomy, etc.)
- Each category: 2-4 questions
- Aggregation: Percentage distribution
- Visualization: Stacked bar chart

#### Solution: Generic Mapping Schema

```typescript
// In approach_report_templates.config
{
  dataMappings: {
    // Flexible key-value structure
    "dimension_name": {
      questionIds: ["q1", "q2", "q3"],
      aggregationType: "average",
      // Optional: question-specific weights
      weights?: { "q1": 1.0, "q2": 1.5, "q3": 1.0 },
      // Optional: filters (e.g., only certain participant segments)
      filters?: { role: "manager" }
    }
  }
}
```

**Key Insight:** The mapping is defined at the template level, not hardcoded in the renderer. This allows each approach to define its own structure.

### 3. Renderer Plugin Architecture

#### Problem: How to Support Multiple Report Types Generically?

**Solution: Factory Pattern + Interface**

```typescript
// Base interface all renderers must implement
interface ReportRenderer {
  type: ReportType
  render(data: ComputedReportData, config: ReportTemplateConfig): ReactNode
  validate(config: ReportTemplateConfig): ValidationResult
  export?(format: 'pdf' | 'png' | 'csv'): Promise<Blob>
}

// Factory to instantiate correct renderer
class ReportRendererFactory {
  private renderers: Map<ReportType, ReportRenderer>
  
  getRenderer(type: ReportType): ReportRenderer {
    return this.renderers.get(type) || throw new Error(`Unknown type: ${type}`)
  }
  
  register(type: ReportType, renderer: ReportRenderer) {
    this.renderers.set(type, renderer)
  }
}

// Usage
const factory = new ReportRendererFactory()
factory.register('visualization', new VisualizationRenderer())
factory.register('pdf', new PDFRenderer())
factory.register('dashboard', new DashboardRenderer())

// In component
const renderer = factory.getRenderer(reportTemplate.type)
return renderer.render(computedData, reportTemplate.config)
```

**Benefits:**
- Easy to add new report types
- Type-safe
- Testable in isolation
- Config validation per type

### 4. Visualization Customization

#### Challenge: Laloux Flower is Highly Custom

**Options:**

**A. Hardcode Laloux Flower Component**
- Simple, fast to implement
- Not reusable for other approaches
- Violates generic principle

**B. Generic Visualization with Custom Plugins (RECOMMENDED)**
- Base visualization types (bar, line, radar, pie)
- Custom visualization registry
- Laloux Flower as a custom plugin

```typescript
// Custom visualization registry
const customVisualizations = {
  'flower': LalouFlowerChart,
  'matrix': MatrixHeatmap,
  'timeline': TimelineChart,
  // ... future custom viz
}

// In VisualizationRenderer
render(data, config) {
  if (config.visualization.type in customVisualizations) {
    const CustomChart = customVisualizations[config.visualization.type]
    return <CustomChart data={data} options={config.visualization.options} />
  }
  
  // Fall back to standard Chart.js
  return <ChartJS type={config.visualization.type} data={data} />
}
```

### 5. Report Generation Triggers

#### When Should Reports Be Generated?

**Trigger Points:**

1. **Manual Generation**
   - Admin clicks "Generate Report" button
   - Use case: On-demand analysis, testing
   - Implementation: API endpoint `/api/org/[slug]/reports/generate`

2. **Automatic on Questionnaire Close**
   - When questionnaire status changes to 'closed'
   - Use case: Final report after data collection
   - Implementation: Database trigger or cron job

3. **Incremental Updates (Optional)**
   - After each new response submission
   - Use case: Real-time dashboards
   - Implementation: Background job queue
   - **Consideration:** May be expensive for large questionnaires

**Recommendation:**
- Start with Manual + Automatic on Close
- Add Incremental later if needed
- Use feature flag to enable/disable per approach

### 6. Data Privacy & Anonymization

#### Challenge: Ensure Individual Responses Are Not Identifiable

**Requirements:**
- Minimum response threshold (e.g., 5 responses) before showing aggregated data
- No drill-down to individual responses in reports
- Anonymize free-text responses (future)

**Implementation:**

```typescript
// In DataAggregator
class DataAggregator {
  private MIN_RESPONSES = 5
  
  async aggregate(questionnaireId: string): Promise<ComputedReportData> {
    const responses = await this.fetchResponses(questionnaireId)
    
    if (responses.length < this.MIN_RESPONSES) {
      throw new InsufficientDataError(
        `Need at least ${this.MIN_RESPONSES} responses, got ${responses.length}`
      )
    }
    
    // Proceed with aggregation
    return this.computeAggregates(responses)
  }
}
```

**UI Handling:**
- Show "Insufficient data" message if < 5 responses
- Display response count on report
- Add disclaimer about anonymization

### 7. Performance Optimization

#### Concern: Large Questionnaires with Many Responses

**Scenario:**
- 100 questions
- 500 participants
- 50,000 data points to aggregate

**Optimizations:**

**A. Database-Level Aggregation**
```sql
-- Use PostgreSQL aggregation functions
SELECT 
  question_id,
  AVG((answers->question_id)::numeric) as avg_score,
  COUNT(*) as response_count
FROM questionnaire_responses
WHERE questionnaire_id = $1
GROUP BY question_id
```

**B. Pagination for Large Datasets**
- Process responses in batches
- Use cursor-based pagination
- Show progress indicator

**C. Background Jobs**
- Use job queue (e.g., BullMQ, pg-boss)
- Generate reports asynchronously
- Notify user when complete

**D. Caching Layers**
- L1: In-memory cache (Redis) for active reports
- L2: Database cache (`computed_data`)
- L3: CDN for static exports (PDF, images)

### 8. Configuration UI for Admins

#### Challenge: How Do Admins Configure Report Templates?

**Phase 1: JSON Editor (MVP)**
- Simple textarea with JSON validation
- Syntax highlighting
- Schema validation
- Example templates

**Phase 2: Form-Based Editor**
- Structured form for common fields
- Dropdown for aggregation types
- Question selector with search
- Preview of data mapping

**Phase 3: Visual Editor (Future)**
- Drag-and-drop question mapping
- Visual chart configuration
- Live preview of report
- Template library

**Recommendation:** Start with Phase 1, iterate based on user feedback

### 9. Error Handling & Resilience

#### Potential Failure Points

**1. Data Aggregation Fails**
- Missing questions in responses
- Invalid data types
- Calculation errors

**Solution:**
```typescript
try {
  const data = await aggregator.aggregate(questionnaireId)
  await saveReport({ status: 'ready', computed_data: data })
} catch (error) {
  await saveReport({
    status: 'error',
    error_message: error.message,
    computed_data: {}
  })
  logger.error('Report generation failed', { questionnaireId, error })
}
```

**2. Renderer Fails**
- Invalid config
- Missing data
- Visualization library error

**Solution:**
- Validate config before rendering
- Graceful fallback to error state
- Show partial data if possible

**3. Export Fails**
- PDF generation timeout
- Memory issues
- File system errors

**Solution:**
- Implement retry logic
- Use streaming for large files
- Provide alternative export formats

### 10. Testing Strategy

#### Unit Tests
- Data aggregation functions
- Statistical calculations
- Config validation
- Renderer logic

#### Integration Tests
- End-to-end report generation
- API endpoints
- Database queries
- Cache invalidation

#### Visual Regression Tests
- Chart rendering consistency
- PDF layout
- Dashboard responsiveness

#### Performance Tests
- Load testing with large datasets
- Memory profiling
- Query optimization

**Test Data:**
- Seed database with sample approaches
- Generate synthetic responses
- Create test report templates

### 11. Migration Path

#### Existing Data Considerations

**Current State:**
- `approach_report_templates` table exists
- Some templates may already be defined
- No `organization_reports` table yet

**Migration Steps:**

1. **Create `organization_reports` table**
   ```sql
   -- See REPORTING_SYSTEM_ARCHITECTURE.md for full schema
   ```

2. **Backfill existing questionnaires**
   ```typescript
   // For each closed questionnaire with an approach
   // Generate initial reports
   async function backfillReports() {
     const questionnaires = await getClosedQuestionnaires()
     for (const q of questionnaires) {
       const templates = await getReportTemplates(q.approach_id)
       for (const template of templates) {
         await generateReport(q.id, template.id)
       }
     }
   }
   ```

3. **Update existing templates**
   - Ensure all templates have valid `config` JSON
   - Add default configs for templates without
   - Validate against schema

### 12. Laloux Flower Specific Implementation

#### Data Structure

**Questionnaire Schema:**
```typescript
{
  sections: [
    { id: "purpose", title: "Evolutionary Purpose", questions: [...] },
    { id: "wholeness", title: "Wholeness", questions: [...] },
    { id: "self_management", title: "Self-Management", questions: [...] },
    { id: "distributed_authority", title: "Distributed Authority", questions: [...] },
    { id: "listening_to_purpose", title: "Listening to Purpose", questions: [...] },
    { id: "striving_for_wholeness", title: "Striving for Wholeness", questions: [...] }
  ]
}
```

**Report Template Config:**
```typescript
{
  type: "visualization",
  config: {
    dataMappings: {
      "purpose": {
        questionIds: ["purpose_q1", "purpose_q2", "purpose_q3"],
        aggregationType: "average",
        scale: { min: 1, max: 5 }
      },
      // ... repeat for each dimension
    },
    visualization: {
      type: "flower",
      dimensions: [
        "purpose",
        "wholeness",
        "self_management",
        "distributed_authority",
        "listening_to_purpose",
        "striving_for_wholeness"
      ],
      options: {
        petals: 6,
        centerRadius: 50,
        petalLength: 150,
        colors: [
          "#FF6B6B", // Purpose - Red
          "#4ECDC4", // Wholeness - Teal
          "#45B7D1", // Self-Management - Blue
          "#FFA07A", // Distributed Authority - Orange
          "#98D8C8", // Listening to Purpose - Green
          "#F7DC6F"  // Striving for Wholeness - Yellow
        ],
        labels: {
          show: true,
          position: "outside"
        },
        interactive: true,
        showValues: true
      }
    }
  }
}
```

**Computed Data:**
```typescript
{
  dimensions: {
    purpose: {
      value: 3.8,
      responses: 25,
      distribution: { "1": 0, "2": 2, "3": 8, "4": 10, "5": 5 },
      questions: {
        "purpose_q1": { value: 3.9, responses: 25 },
        "purpose_q2": { value: 3.7, responses: 25 },
        "purpose_q3": { value: 3.8, responses: 25 }
      }
    },
    // ... repeat for each dimension
  },
  overall_score: 3.9,
  maturity_level: "Teal", // Calculated based on overall score
  response_count: 25,
  completion_rate: 0.83,
  generated_at: "2024-01-15T10:30:00Z"
}
```

#### Flower Visualization Component

**Key Features:**
- SVG-based for scalability
- Interactive hover states
- Smooth animations
- Responsive sizing
- Accessibility (ARIA labels)

**Implementation Approach:**
```typescript
// components/reports/visualizations/LalouFlower.tsx
export function LalouFlowerChart({ data, options }: LalouFlowerProps) {
  const dimensions = options.dimensions
  const values = dimensions.map(d => data.dimensions[d].value)

  // Calculate petal paths
  const petals = dimensions.map((dim, i) => {
    const angle = (i * 360) / dimensions.length
    const value = values[i]
    const normalizedValue = (value - 1) / 4 // Normalize 1-5 to 0-1
    const length = options.centerRadius + (options.petalLength * normalizedValue)

    return {
      dimension: dim,
      value: value,
      path: calculatePetalPath(angle, length, options.centerRadius),
      color: options.colors[i]
    }
  })

  return (
    <svg viewBox="0 0 400 400" className="w-full h-full">
      {/* Center circle */}
      <circle cx="200" cy="200" r={options.centerRadius} fill="#f0f0f0" />

      {/* Petals */}
      {petals.map((petal, i) => (
        <g key={i}>
          <path
            d={petal.path}
            fill={petal.color}
            opacity={0.7}
            className="transition-opacity hover:opacity-100"
          />
          {options.labels.show && (
            <text {...calculateLabelPosition(petal)}>
              {petal.dimension}: {petal.value.toFixed(1)}
            </text>
          )}
        </g>
      ))}

      {/* Center label */}
      <text x="200" y="200" textAnchor="middle" className="font-bold">
        {data.maturity_level}
      </text>
    </svg>
  )
}
```

### 13. API Design

#### Report Generation API

**POST /api/org/[slug]/reports/generate**
```typescript
// Request
{
  questionnaireId: string
  templateId?: string // Optional: generate specific template, or all if omitted
  force?: boolean // Force regeneration even if exists
}

// Response
{
  success: boolean
  reports: Array<{
    id: string
    templateId: string
    status: 'pending' | 'generating' | 'ready' | 'error'
    estimatedTime?: number // seconds
  }>
}
```

**GET /api/org/[slug]/reports/[reportId]**
```typescript
// Response
{
  id: string
  template: {
    id: string
    name: string
    type: 'visualization' | 'pdf' | 'dashboard'
    config: ReportTemplateConfig
  },
  questionnaire: {
    id: string
    title: string
    status: string
  },
  status: 'ready' | 'generating' | 'error',
  computedData: ComputedReportData,
  metadata: {
    generatedAt: string
    responseCount: number
    completionRate: number
  }
}
```

**GET /api/org/[slug]/questionnaires/[id]/reports**
```typescript
// Response
{
  questionnaire: {
    id: string
    title: string
    status: string
  },
  availableReports: Array<{
    id: string
    templateId: string
    name: string
    type: string
    status: string
    generatedAt?: string
  }>,
  canGenerate: boolean, // Based on response count, questionnaire status
  minimumResponses: number
}
```

### 14. Open Questions & Decisions Needed

#### Question 1: Report Versioning ✅ DECIDED
**Issue:** If questionnaire responses change, should we keep old report versions?

**Options:**
- A. Always overwrite (simpler, less storage)
- B. Version history (audit trail, compare over time)

**Recommendation:** Start with A, add B if needed

**✅ DECISION: Option A - Always overwrite (no historical versioning)**

#### Question 2: Real-time vs Batch ✅ DECIDED
**Issue:** Should reports update in real-time as responses come in?

**Options:**
- A. Batch: Generate once when questionnaire closes
- B. Real-time: Update on every response
- C. Hybrid: Batch by default, real-time opt-in

**Recommendation:** C - Hybrid approach with feature flag

**✅ DECISION: Option A - Batch generation only**

#### Question 3: Custom Aggregation Functions ✅ DECIDED
**Issue:** How to support approach-specific calculations?

**Options:**
- A. Hardcode in aggregator (not scalable)
- B. JavaScript eval (security risk)
- C. Plugin system with registered functions
- D. Database stored procedures

**Recommendation:** C - Plugin system with TypeScript functions

**✅ DECISION: Option C - Plugin system with registered TypeScript functions**

#### Question 4: Multi-Questionnaire Reports ✅ DECIDED
**Issue:** Should reports combine data from multiple questionnaires?

**Use Case:** Compare organization over time (Q1 vs Q2 vs Q3)

**Options:**
- A. Not supported initially
- B. Separate "comparative report" type
- C. Allow multiple questionnaire IDs in config

**Recommendation:** A for MVP, B for future enhancement

**✅ DECISION: Option A - Not supported initially**

---

## Next Steps

1. **Review & Approve Architecture**
   - Stakeholder review of this document
   - Confirm technical decisions
   - Prioritize features

2. **Create Database Migration**
   - `organization_reports` table
   - Indexes for performance
   - RLS policies

3. **Build Core Services**
   - DataAggregator
   - QuestionMapper
   - ReportGenerator

4. **Implement First Renderer**
   - VisualizationRenderer
   - Laloux Flower component
   - Basic report viewer page

5. **Iterate & Expand**
   - Add PDF renderer
   - Add dashboard renderer
   - Enhance configuration UI

---

**Document Version:** 1.0
**Last Updated:** 2026-02-01
**Status:** Planning Phase - Awaiting Approval


