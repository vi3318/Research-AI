import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export const api = axios.create({ baseURL })

// Set auth token for requests
export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
  } else {
    delete api.defaults.headers.common['Authorization']
  }
}

export async function startResearch(query: string) {
  const { data } = await api.post('/api/research', { query })
  return data
}

export async function getResearchStatus(jobId: string) {
  const { data } = await api.get(`/api/research/status/${jobId}`)
  return data
}

export async function getResearchResults(jobId: string) {
  const { data } = await api.get(`/api/research/results/${jobId}`)
  return data
}

export async function searchLiterature(params: { topic: string; sources?: string; maxResults?: number }) {
  const { topic, sources, maxResults } = params
  const { data } = await api.get('/api/literature/search', { params: { topic, sources, maxResults } })
  return data
}

export async function semanticIndex(namespace: string, items: any[]) {
  const { data } = await api.post('/api/semantic/index', { namespace, items })
  return data
}

export async function semanticQuery(namespace: string, query: string, topK = 10) {
  const { data } = await api.post('/api/semantic/query', { namespace, query, topK })
  return data
}

export async function createAlert(payload: { alertId: string; topic: string; cron: string; sources?: string; maxResults?: number }) {
  const { data } = await api.post('/api/alerts', payload)
  return data
}

export async function listAlerts() {
  const { data } = await api.get('/api/alerts')
  return data
}

export async function listAlertResults(alertId: string) {
  const { data } = await api.get(`/api/alerts/${alertId}/results`)
  return data
}

export async function deleteAlert(alertId: string) {
  const { data } = await api.delete(`/api/alerts/${alertId}`)
  return data
}

// Chat API functions
export async function createChatSession(title?: string, metadata?: any) {
  const { data } = await api.post('/api/chat/sessions', { title, metadata })
  return data
}

export async function getChatSessions() {
  const { data } = await api.get('/api/chat/sessions')
  return data
}

export async function getSessionMessages(sessionId: string) {
  const { data } = await api.get(`/api/chat/sessions/${sessionId}/messages`)
  return data
}

export async function sendMessage(sessionId: string, message: string, type: 'chat' | 'research' | 'paper_qa' = 'chat') {
  const { data } = await api.post(`/api/chat/sessions/${sessionId}/messages`, { message, type })
  return data
}

export async function addPapersToContext(sessionId: string, papers: any[]) {
  const { data } = await api.post(`/api/chat/sessions/${sessionId}/context`, { papers })
  return data
}

export async function getSessionContext(sessionId: string) {
  const { data } = await api.get(`/api/chat/sessions/${sessionId}/context`)
  return data
}

export async function updateSession(sessionId: string, title: string) {
  const { data } = await api.put(`/api/chat/sessions/${sessionId}`, { title })
  return data
}

export async function deleteSession(sessionId: string) {
  const { data } = await api.delete(`/api/chat/sessions/${sessionId}`)
  return data
}

// Presentation API functions
export async function generatePresentation(paper: any, options: any = {}) {
  const { data } = await api.post('/api/presentation/generate', { paper, options })
  return data
}

export async function exportPresentationToMarkdown(presentation: any) {
  const { data } = await api.post('/api/presentation/export/markdown', { presentation })
  return data.markdown
}

export async function exportPresentationToJSON(presentation: any) {
  const { data } = await api.post('/api/presentation/export/json', { presentation })
  return data.json
}

export async function exportPresentationToPowerPoint(presentation: any) {
  const { data } = await api.post('/api/presentation/export/pptx', { presentation })
  return data
}

export async function analyzePaper(paperId: string, question: string, sessionId: string) {
  const { data } = await api.post('/api/enhanced-research/analyze-paper', { paperId, question, sessionId })
  return data
}

export async function generateVisualization(sessionId: string, visualizationType = 'comprehensive') {
  const { data } = await api.post('/api/enhanced-research/gap-visualization', { sessionId, visualizationType })
  return data
}

export async function generateHypotheses(sessionId: string, researchArea?: string) {
  const { data } = await api.post('/api/enhanced-research/generate-hypotheses', { sessionId, researchArea })
  return data
}

// Auto-PPT API functions
export async function getAutoPptThemes() {
  const { data } = await api.get('/api/auto-ppt/themes')
  return data
}

export async function generatePresentationFromPdf(formData: FormData) {
  const { data } = await api.post('/api/auto-ppt/generate-from-pdf', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
  return data
}

export async function generatePresentationFromText(payload: {
  title: string
  abstract?: string
  introduction?: string
  methodology?: string
  results?: string
  conclusion?: string
  theme?: string
  author?: string
}) {
  const { data } = await api.post('/api/auto-ppt/generate-from-text', payload)
  return data
}

export async function downloadPresentation(downloadId: string) {
  const response = await api.get(`/api/auto-ppt/download/${downloadId}`, {
    responseType: 'blob'
  })
  return response
}

export async function checkAutoPptHealth() {
  const { data } = await api.get('/api/auto-ppt/health')
  return data
}

