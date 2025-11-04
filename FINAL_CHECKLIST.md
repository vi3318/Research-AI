# ✅ FINAL INTEGRATION CHECKLIST

Complete this checklist to integrate the backend with your frontend and go live.

---

## 📦 Phase 1: Backend Setup (15 minutes)

### 1.1 Install Dependencies
- [ ] `cd backend && npm install`
- [ ] Verify: `npm list bull chartjs-node-canvas redis axios`

### 1.2 Configure Environment
- [ ] Copy: `cp backend/.env.example backend/.env`
- [ ] Edit `backend/.env`:
  - [ ] `SUPABASE_URL=https://xxx.supabase.co`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY=xxx`
  - [ ] `SUPABASE_ANON_KEY=xxx`
  - [ ] `REDIS_URL=redis://localhost:6379`
  - [ ] `CEREBRAS_API_KEY=xxx` (or leave empty for sandbox mode)

### 1.3 Setup Database
- [ ] Open Supabase SQL Editor
- [ ] Copy `COMPLETE_DATABASE_MIGRATION.sql`
- [ ] Paste and run in SQL Editor
- [ ] Verify: Check for `document_revisions`, `papers`, `chart_exports`, `humanizer_logs` tables

### 1.4 Create Storage Buckets
- [ ] Go to Supabase Dashboard > Storage
- [ ] Create bucket: `chart-exports` (set to public)
- [ ] Create bucket: `paper-pdfs` (set to private)

### 1.5 Start Services
- [ ] Option A (Docker): `docker-compose up -d`
- [ ] Option B (Local): 
  - [ ] Terminal 1: `redis-server`
  - [ ] Terminal 2: `cd backend && npm start`
  - [ ] Terminal 3: `npm run worker` (optional)

### 1.6 Verify Backend
- [ ] `curl http://localhost:3000/health` → Should return 200
- [ ] Check logs: `docker-compose logs -f backend` (if using Docker)

---

## 🧪 Phase 2: Testing (20 minutes)

### 2.1 Unit Tests
- [ ] `cd backend && npm test -- tests/services.test.js`
- [ ] All tests should pass (15/15)

### 2.2 Get Test Credentials
- [ ] Login to your frontend app
- [ ] Open browser console
- [ ] Copy JWT: `localStorage.getItem('sb-xxx-auth-token')`
- [ ] Find workspace ID in URL or database

### 2.3 Integration Tests
- [ ] `export TEST_JWT_TOKEN="your-token"`
- [ ] `export TEST_WORKSPACE_ID="your-workspace-id"`
- [ ] `npm test -- tests/integration.test.js`
- [ ] Verify: At least 12/15 tests pass (some may fail if workspace is empty)

### 2.4 Postman Tests
- [ ] Open Postman
- [ ] Import: `ResearchAI_Postman_Collection.json`
- [ ] Set variables:
  - [ ] `jwt_token`: Your JWT token
  - [ ] `workspace_id`: Your workspace ID
  - [ ] `base_url`: http://localhost:3000
- [ ] Run collection
- [ ] Verify: All requests succeed

### 2.5 Manual Smoke Tests
- [ ] `curl http://localhost:3000/health` → 200 OK
- [ ] Humanizer (sandbox):
  ```bash
  curl -X POST http://localhost:3000/api/humanize \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"text":"test","provider":"sandbox","workspace_id":"xxx"}'
  ```
  → Should return humanized text with quality_score

---

## 💻 Phase 3: Frontend Integration (2-3 hours)

### 3.1 Install Frontend Dependencies
- [ ] `cd frontend`
- [ ] `npm install y-websocket y-protocols lodash @types/lodash jsondiffpatch`
- [ ] Verify: `npm list y-websocket` shows installed

### 3.2 Update Frontend Environment
- [ ] Edit `frontend/.env`:
  ```bash
  REACT_APP_API_URL=http://localhost:3000
  REACT_APP_SUPABASE_URL=https://xxx.supabase.co
  REACT_APP_SUPABASE_ANON_KEY=xxx
  REACT_APP_YJS_WEBSOCKET_URL=ws://localhost:1234
  ```

### 3.3 Create Hooks
Open `FRONTEND_INTEGRATION_GUIDE.md` and copy:

- [ ] Create `frontend/src/hooks/useDocumentRealtime.ts`
  - [ ] Copy code from Section 2 (Realtime Supabase Integration)
  - [ ] Verify imports work

- [ ] Create `frontend/src/hooks/useAutosave.ts`
  - [ ] Copy code from Section 4 (Autosave Implementation)
  - [ ] Verify debounce import

- [ ] Create `frontend/src/hooks/useHumanizer.ts`
  - [ ] Copy code from Section 8 (Humanizer Integration)
  - [ ] Test: Should export `humanizeText` function

- [ ] Create `frontend/src/hooks/useCharts.ts`
  - [ ] Copy code from Section 9 (Chart Generation)
  - [ ] Test: Should export `generateChart` function

- [ ] Create `frontend/src/hooks/usePins.ts`
  - [ ] Copy code from Section 7 (Paper Pinning)
  - [ ] Test: Should export `pinPaper`, `unpinPaper`

### 3.4 Update DocEditor Component

Edit `frontend/src/components/DocEditorProduction.tsx`:

- [ ] Import new hooks at top:
  ```typescript
  import { useDocumentRealtime } from '../hooks/useDocumentRealtime';
  import { useAutosave } from '../hooks/useAutosave';
  import { useHumanizer } from '../hooks/useHumanizer';
  ```

- [ ] Add hooks in component:
  ```typescript
  const { lastUpdate, onlineUsers } = useDocumentRealtime(documentId);
  const { saveNow } = useAutosave(editor, documentId, {
    onSave: (success) => setSaveStatus(success ? 'saved' : 'error')
  });
  const { humanizeText, loading: humanizing } = useHumanizer(workspaceId);
  ```

- [ ] Add Y.js setup (Optional - see guide Section 3):
  - [ ] Create ydoc and provider
  - [ ] Configure Collaboration extension
  - [ ] Add cleanup in useEffect

- [ ] Add UI elements:
  - [ ] Save status indicator: `{saveStatus === 'saved' && '✅ Saved'}`
  - [ ] Online users: `{onlineUsers.length} online`
  - [ ] Humanize button: `<button onClick={handleHumanize}>Humanize</button>`

### 3.5 Test Frontend Integration

- [ ] `npm start`
- [ ] Navigate to `/workspace/:id/doc/:docId`
- [ ] **Test 1: Document Loading**
  - [ ] Document loads with content
  - [ ] No console errors
- [ ] **Test 2: Auto-save**
  - [ ] Type some text
  - [ ] Wait 3 seconds
  - [ ] See "✅ Saved" indicator
  - [ ] Refresh page → Changes persisted
- [ ] **Test 3: Humanizer**
  - [ ] Select text
  - [ ] Click "Humanize" button
  - [ ] Text is rewritten
  - [ ] Quality score shown (if UI added)
- [ ] **Test 4: Realtime (Optional)**
  - [ ] Open document in 2 browser windows
  - [ ] Edit in window 1
  - [ ] See change in window 2 (may need page refresh if Y.js not setup)
- [ ] **Test 5: Revision History (if implemented)**
  - [ ] Click "Version History"
  - [ ] See list of revisions
  - [ ] Can view past versions

---

## 🚀 Phase 4: Deployment (30 minutes)

### 4.1 Prepare for Production

- [ ] Update environment variables for production:
  ```bash
  NODE_ENV=production
  REDIS_URL=redis://production-redis:6379
  RATE_LIMIT_HUMANIZE_POINTS=10  # More conservative
  ```

- [ ] Build Docker image:
  ```bash
  docker build -t researchai-backend backend/
  ```

- [ ] Test production build locally:
  ```bash
  NODE_ENV=production npm start
  ```

### 4.2 Deploy Backend

Choose deployment platform:

- [ ] **Option A: Railway**
  ```bash
  railway login
  railway link
  railway up
  ```

- [ ] **Option B: Render**
  - [ ] Connect GitHub repo
  - [ ] Add environment variables
  - [ ] Deploy

- [ ] **Option C: Docker/VPS**
  ```bash
  docker-compose -f docker-compose.yml up -d
  ```

### 4.3 Deploy Redis

- [ ] **Option A: Railway** - Add Redis service
- [ ] **Option B: Redis Cloud** - Create database, copy URL
- [ ] **Option C: AWS ElastiCache** - Create cluster
- [ ] Update `REDIS_URL` in backend environment

### 4.4 Deploy Y.js Server (Optional)

- [ ] Deploy separate Y.js WebSocket server:
  ```bash
  npm install -g y-websocket
  PORT=1234 npx y-websocket
  ```
- [ ] Update `REACT_APP_YJS_WEBSOCKET_URL` in frontend

### 4.5 Deploy Frontend

- [ ] `cd frontend && npm run build`
- [ ] Deploy to Vercel/Netlify:
  ```bash
  # Vercel
  vercel --prod
  
  # Netlify
  netlify deploy --prod
  ```

### 4.6 Verify Production

- [ ] Backend health: `curl https://your-api.com/health`
- [ ] Frontend loads: `https://your-app.com`
- [ ] Test document creation end-to-end
- [ ] Check logs for errors

---

## 📊 Phase 5: Monitoring (15 minutes)

### 5.1 Setup Monitoring

- [ ] **Option A: Bull Board** (Job queue dashboard)
  ```bash
  docker-compose --profile debug up -d bull-board
  # Access: http://localhost:3001
  ```

- [ ] **Option B: Redis Commander** (Redis GUI)
  ```bash
  docker-compose --profile debug up -d redis-commander
  # Access: http://localhost:8081
  ```

- [ ] **Option C: Sentry** (Error tracking)
  - [ ] Create Sentry project
  - [ ] Add `SENTRY_DSN` to environment
  - [ ] Test error reporting

### 5.2 Verify Metrics

- [ ] Check job queue stats:
  ```bash
  curl http://localhost:3000/api/jobs/stats \
    -H "Authorization: Bearer $TOKEN"
  ```

- [ ] Check rate limiting:
  - [ ] Send 25+ humanize requests rapidly
  - [ ] Verify 429 responses received

- [ ] Check logs:
  ```bash
  docker-compose logs -f backend
  docker-compose logs -f worker
  ```

---

## ✅ Final Verification

### Must Work

- [ ] User can create a document
- [ ] Document auto-saves
- [ ] User can view revision history
- [ ] Humanizer works (at least sandbox mode)
- [ ] Paper pinning works
- [ ] Charts generate (even if workspace is empty, job should complete)
- [ ] Rate limiting triggers on excessive requests
- [ ] No console errors in frontend
- [ ] No server errors in backend logs

### Should Work (If Implemented)

- [ ] Real-time collaboration (Y.js)
- [ ] Multiple users see same document
- [ ] Cursor positions visible
- [ ] Chart generation completes successfully
- [ ] Paper metadata caching working

### Nice to Have

- [ ] Bull Board monitoring
- [ ] Redis Commander access
- [ ] Sentry error tracking
- [ ] Performance monitoring
- [ ] Automated tests in CI/CD

---

## 🎯 Success Criteria

You're ready to launch when:

1. ✅ All backend tests pass (30/30)
2. ✅ All Postman requests succeed
3. ✅ Frontend can create/edit documents
4. ✅ Auto-save works reliably
5. ✅ Humanizer returns results
6. ✅ No errors in production logs
7. ✅ Users can access the app without issues

---

## 📚 Reference Documentation

If you get stuck, check:

| Issue | Documentation |
|-------|---------------|
| Backend setup | `DEPLOYMENT_GUIDE.md` |
| Frontend integration | `FRONTEND_INTEGRATION_GUIDE.md` |
| Environment variables | `ENV_CONFIG.md` |
| API endpoints | `INTEGRATION_DELIVERY_SUMMARY.md` |
| Tests failing | `backend/tests/*.test.js` (read test code) |
| Docker issues | `docker-compose.yml` comments |

---

## 🆘 Common Issues & Fixes

### "Tests failing"
→ Check `TEST_JWT_TOKEN` and `TEST_WORKSPACE_ID` are set
→ Verify workspace has at least one document

### "Humanizer returns error"
→ Set `USE_SANDBOX_MODE=true` for testing without API keys
→ Or add `CEREBRAS_API_KEY`

### "Charts failing"
→ Workspace needs pinned papers for chart data
→ Check job logs: `docker-compose logs -f worker`

### "Frontend can't connect"
→ Verify `REACT_APP_API_URL=http://localhost:3000`
→ Check CORS in backend

### "Autosave not working"
→ Check browser console for errors
→ Verify token is valid
→ Check backend logs for save requests

---

## ✨ You're Done!

When all items are checked, you have:

- ✅ Fully integrated backend + frontend
- ✅ Production-ready deployment
- ✅ Comprehensive testing
- ✅ Monitoring and observability
- ✅ Documentation for maintenance

**🎉 Congratulations! Ship it! 🚀**

---

**Need help?** Review the documentation files or run the quick-start script:

```bash
chmod +x quick-start.sh
./quick-start.sh
```
