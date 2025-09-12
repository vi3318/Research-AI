import { useState } from 'react'
import { motion } from 'framer-motion'
import { searchLiterature } from '../lib/api'
import CitationButton from '../components/CitationButton'

export default function Literature() {
  const [topic, setTopic] = useState('')
  const [sources, setSources] = useState<string[]>(['scholar','arxiv','pubmed','unpaywall'])
  const [maxResults, setMaxResults] = useState(10)
  const [data, setData] = useState<any | null>(null)

  async function onSearch() {
    const res = await searchLiterature({ topic, sources: sources.join(','), maxResults })
    setData(res)
  }

  function toggle(src: string) {
    setSources(prev => prev.includes(src) ? prev.filter(s => s!==src) : [...prev, src])
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card">
        <h2 className="text-lg font-semibold mb-3">Literature search</h2>
        <div className="grid md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="text-sm text-slate-400">Topic</label>
            <input value={topic} onChange={e=>setTopic(e.target.value)} className="w-full px-3 py-2 rounded bg-slate-900/60 border border-white/10" />
          </div>
          <div>
            <label className="text-sm text-slate-400">Max Results</label>
            <input type="number" value={maxResults} onChange={e=>setMaxResults(parseInt(e.target.value||'10'))} className="w-full px-3 py-2 rounded bg-slate-900/60 border border-white/10" />
          </div>
          <div className="flex gap-2">
            {['scholar','arxiv','pubmed','unpaywall'].map(s => (
              <button key={s} onClick={()=>toggle(s)} className={`px-3 py-2 rounded ${sources.includes(s)?'bg-brand-600':'bg-white/10'}`}>{s}</button>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <button className="btn" onClick={onSearch}>Search</button>
        </div>
      </motion.div>

      {data && (
        <div className="space-y-6">
          <div className="text-sm text-slate-400">Topic: {data.topic} {data.cached && <span className="ml-2 text-xs">(cached)</span>}</div>
          <div className="grid md:grid-cols-2 gap-6">
            {(data.merged || []).filter((p:any)=>p && p.title).map((p: any, i: number) => (
              <div key={i} className="card">
                <div className="font-medium">{p.title}</div>
                <div className="text-xs text-slate-400">{p.authors} · {p.year} · {p.publication} · Cit:{p.citationCount||0}</div>
                <div className="text-xs text-slate-500 mt-1">
                  sources: {(p.sources||[]).join(', ')}
                  {p.isOpenAccess && <span className="ml-2 px-2 py-1 bg-green-600/20 text-green-400 rounded text-xs">Open Access</span>}
                  {p.oaHostType && <span className="ml-1 px-2 py-1 bg-blue-600/20 text-blue-400 rounded text-xs">{p.oaHostType}</span>}
                </div>
                <div className="flex gap-3 mt-2 text-sm">
                  {p.url && <a className="text-brand-400 hover:underline" href={p.url} target="_blank">Link</a>}
                  {p.pdfUrl && <a className="text-brand-400 hover:underline" href={p.pdfUrl} target="_blank">PDF</a>}
                  {p.doi && <a className="text-brand-400 hover:underline" href={`https://doi.org/${p.doi}`} target="_blank">DOI</a>}
                  <CitationButton paperData={p} variant="minimal" size="sm" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

