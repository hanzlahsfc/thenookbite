# Sales Reports Feature — The Nook Bite

## Overview

Build a `/dashboard/reports` page with sales analytics. Inspired by GriyoPOS's reporting screen, adapted for the TNB stack (Next.js + FastAPI + Supabase).

---

## Database (existing schema — no migrations needed)

```
orders        → id, total, created_at, status, payment_method, staff_id
order_items   → order_id, item_name, item_price, quantity, menu_item_id
menu_items    → id, name, category
```

Only count orders where `status = 'completed'`.

---

## FastAPI Endpoints

Base path: `/api/reports`

### 1. `GET /api/reports/summary`

Totals for the selected period.

**Query params:** `from_date`, `to_date` (ISO date strings, e.g. `2026-06-01`)

**Response:**
```json
{
  "total_revenue": 125000,
  "total_orders": 48,
  "total_items_sold": 130,
  "avg_order_value": 2604
}
```

**Supabase query logic:**
```sql
SELECT
  SUM(total)            AS total_revenue,
  COUNT(*)              AS total_orders,
  AVG(total)            AS avg_order_value
FROM orders
WHERE status = 'completed'
  AND created_at >= :from_date
  AND created_at <  :to_date + interval '1 day';

SELECT SUM(quantity) AS total_items_sold
FROM order_items
JOIN orders ON orders.id = order_items.order_id
WHERE orders.status = 'completed'
  AND orders.created_at >= :from_date
  AND orders.created_at <  :to_date + interval '1 day';
```

---

### 2. `GET /api/reports/sales-over-time`

Daily revenue for the bar chart.

**Query params:** `from_date`, `to_date`, `group_by` (`day` | `week` | `month`)

**Response:**
```json
[
  { "label": "Jun 10", "revenue": 18500, "orders": 12 },
  { "label": "Jun 11", "revenue": 22000, "orders": 15 }
]
```

**Supabase query logic:**
```sql
SELECT
  DATE_TRUNC(:group_by, created_at) AS period,
  SUM(total)                        AS revenue,
  COUNT(*)                          AS orders
FROM orders
WHERE status = 'completed'
  AND created_at >= :from_date
  AND created_at <  :to_date + interval '1 day'
GROUP BY period
ORDER BY period;
```

---

### 3. `GET /api/reports/top-items`

Top menu items ranked by revenue or quantity.

**Query params:** `from_date`, `to_date`, `sort_by` (`revenue` | `qty`), `limit` (default 10)

**Response:**
```json
[
  {
    "item_name": "Zinger Burger (Cheese)",
    "revenue": 15200,
    "qty": 40,
    "orders": 38
  }
]
```

**Supabase query logic:**
```sql
SELECT
  oi.item_name,
  SUM(oi.item_price * oi.quantity) AS revenue,
  SUM(oi.quantity)                 AS qty,
  COUNT(DISTINCT oi.order_id)      AS orders
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
WHERE o.status = 'completed'
  AND o.created_at >= :from_date
  AND o.created_at <  :to_date + interval '1 day'
GROUP BY oi.item_name
ORDER BY :sort_by DESC
LIMIT :limit;
```

---

### 4. `GET /api/reports/top-categories`

Revenue and qty grouped by menu category.

**Query params:** `from_date`, `to_date`, `sort_by` (`revenue` | `qty`)

**Response:**
```json
[
  { "category": "Burgers", "revenue": 42000, "qty": 120, "orders": 95 },
  { "category": "Pizza Regular v1", "revenue": 38000, "qty": 45, "orders": 40 }
]
```

**Supabase query logic:**
```sql
SELECT
  mi.category,
  SUM(oi.item_price * oi.quantity) AS revenue,
  SUM(oi.quantity)                 AS qty,
  COUNT(DISTINCT oi.order_id)      AS orders
FROM order_items oi
JOIN orders o  ON o.id  = oi.order_id
JOIN menu_items mi ON mi.id = oi.menu_item_id
WHERE o.status = 'completed'
  AND o.created_at >= :from_date
  AND o.created_at <  :to_date + interval '1 day'
GROUP BY mi.category
ORDER BY :sort_by DESC;
```

---

### 5. `GET /api/reports/export-csv`

Same data as top-items, returned as a CSV file download.

**Query params:** same as `/top-items` + `type` (`items` | `categories` | `daily`)

**Response:** `Content-Type: text/csv`, `Content-Disposition: attachment; filename="report.csv"`

---

## Next.js Page

**File:** `app/dashboard/reports/page.tsx`

### Layout (top → bottom)

```
┌─────────────────────────────────────────────────────┐
│  Sales Reports                    [Export CSV ↓]    │
├────────────────┬────────────────────────────────────┤
│ Date filter:   │ [Today] [7d] [30d] [Custom range]  │
├────────────────┴────────────────────────────────────┤
│  Summary cards (4 across)                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ Revenue  │ │ Orders   │ │Items Sold│ │ Avg    │ │
│  │ PKR 125k │ │    48    │ │   130    │ │ 2,604  │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
├─────────────────────────────────────────────────────┤
│  View toggle: [Chart] [Table]                       │
│                                                     │
│  Report type: [Daily Sales] [Top Items] [By Cat]    │
│  Sort by:     [Revenue] [Qty]  (for Items / Cat)    │
├─────────────────────────────────────────────────────┤
│  Chart view: Recharts BarChart (revenue per day)    │
│  OR          Recharts PieChart (category share)     │
│  OR          Recharts HorizontalBarChart (top items)│
├─────────────────────────────────────────────────────┤
│  Table view: sortable table with all columns        │
└─────────────────────────────────────────────────────┘
```

### State

```ts
type ReportType = 'daily' | 'top_items' | 'top_categories'
type SortBy     = 'revenue' | 'qty'
type ViewMode   = 'chart' | 'table'
type DatePreset = 'today' | '7d' | '30d' | 'custom'
```

### Components to create

| Component | File | Purpose |
|---|---|---|
| `ReportSummaryCards` | `components/reports/SummaryCards.tsx` | 4 KPI cards |
| `DateRangeFilter` | `components/reports/DateRangeFilter.tsx` | Preset + custom date picker |
| `ReportControls` | `components/reports/ReportControls.tsx` | Type toggle + sort toggle |
| `SalesBarChart` | `components/reports/SalesBarChart.tsx` | Daily revenue bar chart |
| `TopItemsChart` | `components/reports/TopItemsChart.tsx` | Horizontal bar chart |
| `CategoryPieChart` | `components/reports/CategoryPieChart.tsx` | Pie chart for categories |
| `ReportTable` | `components/reports/ReportTable.tsx` | Generic sortable table |

Use **Recharts** for all charts (already common in Next.js projects).

### Data fetching

Use `fetch` with `useEffect` or React Query. Call the FastAPI endpoints with the current date range and report type. Show a skeleton loader while fetching.

---

## FastAPI implementation notes

- Use `supabase-py` with the **service role key** (bypasses RLS) for all report queries.
- All monetary values in PKR integers (same as schema).
- Add a `router` in `routers/reports.py` and include it in `main.py`.
- Protect all report endpoints with the existing manager auth middleware.

**File:** `routers/reports.py`

```python
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from datetime import date
import io, csv

router = APIRouter(prefix="/api/reports", tags=["reports"])

# Inject your existing supabase client + manager auth dependency
```

---

## Chart library

Use **Recharts** — install if not already present:

```bash
npm install recharts
```

Chart colour palette (matches TNB brand amber/red):
- Primary bars: `#f59e0b` (amber-400)
- Secondary: `#ef4444` (red-500)
- Categories: use Recharts default colour array

---

## CSV export format

**Daily sales CSV:**
```
Date,Revenue (PKR),Orders
2026-06-10,18500,12
2026-06-11,22000,15
```

**Top items CSV:**
```
Item,Revenue (PKR),Qty Sold,Orders
Zinger Burger (Cheese),15200,40,38
```

**Categories CSV:**
```
Category,Revenue (PKR),Qty Sold,Orders
Burgers,42000,120,95
```

---

## Route protection

- Page only accessible to `role = 'manager'` staff.
- Redirect to `/dashboard` if cashier tries to access.
- Reuse existing auth middleware/guard.

---

## File structure summary

```
app/
  dashboard/
    reports/
      page.tsx                  ← main page

components/
  reports/
    SummaryCards.tsx
    DateRangeFilter.tsx
    ReportControls.tsx
    SalesBarChart.tsx
    TopItemsChart.tsx
    CategoryPieChart.tsx
    ReportTable.tsx

routers/
  reports.py                    ← FastAPI router
```
