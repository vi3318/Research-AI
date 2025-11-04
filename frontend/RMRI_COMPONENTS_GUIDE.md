# RMRI Frontend Components - Complete Guide

## 📦 Components Overview

### 1. **RMRIStartPanel.jsx**
**Purpose:** Form to initiate new RMRI analysis runs

**Features:**
- ✅ Research query input
- ✅ Multi-domain selection (7 domains)
- ✅ Advanced configuration (iterations, convergence threshold)
- ✅ PDF paper upload to Supabase Storage
- ✅ Real-time upload progress
- ✅ Form validation
- ✅ Framer Motion animations

**Props:**
- `onRunStarted(runId)` - Callback when run is created

**Usage:**
```jsx
import { RMRIStartPanel } from '@/components/RMRI';

<RMRIStartPanel 
  onRunStarted={(runId) => console.log('Started:', runId)} 
/>
```

---

### 2. **RMRIProgress.jsx**
**Purpose:** Live tracker for RMRI run execution

**Features:**
- ✅ Overall progress bar with percentage
- ✅ Iteration counter (current / total)
- ✅ Agent statistics (Micro, Meso, Meta)
- ✅ Live activity log with color-coded levels
- ✅ Iteration timeline visualization
- ✅ Auto-refresh every 3 seconds
- ✅ Cancel run button

**Props:**
- `runId` - The RMRI run ID to track

**Usage:**
```jsx
import { RMRIProgress } from '@/components/RMRI';

<RMRIProgress runId="uuid-here" />
```

**API Endpoints Used:**
- `GET /api/rmri/:id/status` - Fetch run status
- `POST /api/rmri/:id/cancel` - Cancel run

---

### 3. **ContextExplorer.jsx**
**Purpose:** Browse and explore saved RMRI contexts

**Features:**
- ✅ Context list with search and filtering
- ✅ Type-based icons (Micro 🔬, Meso 🧩, Meta 🧠)
- ✅ Full context data display (JSON)
- ✅ Version history tracking
- ✅ Download context as JSON
- ✅ Two-panel layout (list + details)

**Props:**
- `runId` - The RMRI run ID

**Usage:**
```jsx
import { ContextExplorer } from '@/components/RMRI';

<ContextExplorer runId="uuid-here" />
```

**API Endpoints Used:**
- `GET /api/rmri/:id/contexts` - List contexts
- `GET /api/rmri/:id/context/:key` - Get context data
- `GET /api/rmri/:id/context/:key/versions` - Get versions

---

### 4. **RMRIResults.jsx**
**Purpose:** Display final ranked research gaps

**Features:**
- ✅ Sortable table (rank, importance, novelty, feasibility, impact)
- ✅ Theme filtering
- ✅ Expandable row details
- ✅ Confidence badges (High/Medium/Low)
- ✅ Scoring breakdown visualization
- ✅ Export to CSV
- ✅ Summary statistics

**Props:**
- `runId` - The RMRI run ID

**Usage:**
```jsx
import { RMRIResults } from '@/components/RMRI';

<RMRIResults runId="uuid-here" />
```

**API Endpoints Used:**
- `GET /api/rmri/:id/results?finalOnly=true` - Fetch final results

---

### 5. **RMRIAdmin.jsx**
**Purpose:** Visualize agent hierarchy with interactive graph

**Features:**
- ✅ Force-directed graph using react-force-graph-2d
- ✅ Interactive node selection
- ✅ Real-time status updates
- ✅ Color-coded by agent type and status
- ✅ Legend for types and statuses
- ✅ Details panel with metadata
- ✅ Connection visualization
- ✅ Statistics dashboard

**Props:**
- `runId` - The RMRI run ID

**Usage:**
```jsx
import { RMRIAdmin } from '@/components/RMRI';

<RMRIAdmin runId="uuid-here" />
```

**Graph Structure:**
```
Orchestrator (green)
  ├─ Micro Agents (blue) → Meso Agent (purple)
  ├─ Meso Agent (purple) → Meta Agent (pink)
  └─ Meta Agent (pink)
```

---

### 6. **RMRIDashboard.jsx**
**Purpose:** Main dashboard orchestrating all components

**Features:**
- ✅ Tab navigation (Start, Progress, Results, Contexts, Admin)
- ✅ Run selector dropdown
- ✅ Recent runs sidebar
- ✅ Auto-load most recent run
- ✅ Status badges
- ✅ User authentication check
- ✅ Responsive layout

**Props:** None (uses Supabase auth context)

**Usage:**
```jsx
import { RMRIDashboard } from '@/components/RMRI';

<RMRIDashboard />
```

---

## 🎨 Design System

### Color Palette
```javascript
// Agent Types
micro: '#3b82f6'    // blue
meso: '#a855f7'     // purple
meta: '#ec4899'     // pink
orchestrator: '#10b981' // green

// Status
pending: '#9ca3af'  // gray
active: '#3b82f6'   // blue
completed: '#10b981' // green
failed: '#ef4444'   // red

// Confidence
high: '#10b981'     // green
medium: '#fbbf24'   // yellow
low: '#ef4444'      // red
```

### Typography
- **Headings:** `font-bold text-gray-900`
- **Body:** `text-gray-600`
- **Labels:** `text-sm font-medium text-gray-700`

### Animations
All components use Framer Motion:
- **Entry:** `initial={{ opacity: 0, y: 20 }}`
- **Exit:** `exit={{ opacity: 0, y: -20 }}`
- **Hover:** `whileHover={{ scale: 1.02 }}`
- **Tap:** `whileTap={{ scale: 0.98 }}`

---

## 📦 Dependencies Required

Add to `frontend/package.json`:

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "framer-motion": "^10.16.0",
    "@supabase/auth-helpers-react": "^0.4.0",
    "@supabase/supabase-js": "^2.38.0",
    "axios": "^1.6.0",
    "react-force-graph-2d": "^1.25.0",
    "@heroicons/react": "^2.0.18"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "tailwindcss": "^3.3.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.31"
  }
}
```

Install:
```bash
cd frontend
npm install framer-motion @supabase/auth-helpers-react @supabase/supabase-js axios react-force-graph-2d @heroicons/react
```

---

## 🔧 Configuration

### 1. Environment Variables

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 2. Supabase Auth Setup

Wrap your app with Supabase providers:

```jsx
// frontend/src/main.jsx
import { createClient } from '@supabase/supabase-js';
import { SessionContextProvider } from '@supabase/auth-helpers-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <SessionContextProvider supabaseClient={supabase}>
    <App />
  </SessionContextProvider>
);
```

### 3. Tailwind Config

Ensure `tailwind.config.js` includes:

```javascript
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  safelist: [
    {
      pattern: /(bg|text|border)-(blue|purple|pink|green|yellow|red|gray|indigo)-(50|100|200|300|400|500|600|700|800|900)/,
    },
  ],
}
```

### 4. Supabase Storage Bucket

Create a storage bucket named `research-papers`:

```sql
-- In Supabase SQL Editor
insert into storage.buckets (id, name, public)
values ('research-papers', 'research-papers', true);

-- Create policy for authenticated users
create policy "Users can upload papers"
on storage.objects for insert
to authenticated
with check (bucket_id = 'research-papers' AND auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can read their papers"
on storage.objects for select
to authenticated
using (bucket_id = 'research-papers' AND auth.uid()::text = (storage.foldername(name))[1]);
```

---

## 🚀 Integration Example

Complete app setup:

```jsx
// frontend/src/App.jsx
import { useState } from 'react';
import { useUser } from '@supabase/auth-helpers-react';
import { RMRIDashboard } from './components/RMRI';
import Auth from './components/Auth'; // Your auth component

function App() {
  const user = useUser();

  if (!user) {
    return <Auth />;
  }

  return <RMRIDashboard />;
}

export default App;
```

---

## 📊 Component Communication Flow

```
User Action (RMRIStartPanel)
  → Upload papers to Supabase Storage
  → POST /api/rmri/start
  → POST /api/rmri/:id/execute
  → Navigate to Progress tab
  
Progress Monitoring (RMRIProgress)
  → Poll GET /api/rmri/:id/status every 3s
  → Update UI with agent stats
  → Show logs in real-time
  
View Results (RMRIResults)
  → GET /api/rmri/:id/results?finalOnly=true
  → Display ranked gaps table
  → Export to CSV
  
Explore Contexts (ContextExplorer)
  → GET /api/rmri/:id/contexts
  → GET /api/rmri/:id/context/:key
  → Display JSON data
  
Admin View (RMRIAdmin)
  → GET /api/rmri/:id/status
  → Build force-directed graph
  → Show agent hierarchy
```

---

## 🎯 Performance Optimizations

1. **Polling Optimization**
   - Progress: 3s interval, stops when completed
   - Dashboard runs: 10s interval
   - Admin graph: 5s interval

2. **Lazy Loading**
   - Graph only renders when Admin tab is active
   - Context data loaded on-demand

3. **Memoization**
   - Sorted/filtered data computed only when dependencies change
   - Graph rebuild triggered only on data change

4. **Animation Performance**
   - `layoutId` for smooth tab transitions
   - `AnimatePresence` for list animations
   - GPU-accelerated transforms

---

## 🐛 Error Handling

All components include:
- ✅ Try-catch blocks for API calls
- ✅ Error state display
- ✅ Fallback UI for loading states
- ✅ Toast notifications (optional)
- ✅ 401 handling (redirect to auth)

---

## 📱 Responsive Design

Breakpoints:
- **Mobile:** < 640px (single column)
- **Tablet:** 640px - 1024px (2 columns)
- **Desktop:** > 1024px (3 columns, sidebars)

All components use Tailwind responsive classes:
- `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- `flex-col lg:flex-row`

---

## 🧪 Testing Commands

```bash
# Start frontend dev server
cd frontend
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 📝 File Structure

```
frontend/src/components/RMRI/
├── index.js                 # Export all components
├── RMRIDashboard.jsx        # Main dashboard
├── RMRIStartPanel.jsx       # Start new run
├── RMRIProgress.jsx         # Progress tracker
├── RMRIResults.jsx          # Results table
├── ContextExplorer.jsx      # Context browser
└── RMRIAdmin.jsx            # Graph visualization
```

---

## ✅ Completion Checklist

- [x] RMRIStartPanel - Form with upload
- [x] RMRIProgress - Live tracker
- [x] ContextExplorer - Browse contexts
- [x] RMRIResults - Ranked gaps table
- [x] RMRIAdmin - Graph visualization
- [x] RMRIDashboard - Main orchestrator
- [x] Framer Motion animations
- [x] Supabase Auth integration
- [x] Tailwind styling
- [x] Responsive layout
- [x] Error handling
- [x] Documentation

---

**Status:** ✅ **ALL COMPONENTS COMPLETE AND PRODUCTION-READY**
