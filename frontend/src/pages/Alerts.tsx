import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { createAlert, listAlerts, listAlertResults, deleteAlert } from '../lib/api'

export default function Alerts() {
  const [alertId, setAlertId] = useState('weekly-ml')
  const [topic, setTopic] = useState('graph neural networks')
  const [cron, setCron] = useState('0 9 * * 1')
  const [sources, setSources] = useState('scholar,arxiv,pubmed')
  const [maxResults, setMaxResults] = useState(20)
  const [items, setItems] = useState<any[]>([])
  const [selected, setSelected] = useState<any | null>(null)

  async function refresh() {
    const data = await listAlerts()
    setItems(data.items || [])
  }

  useEffect(() => { refresh() }, [])

  async function onCreate() {
    await createAlert({ alertId, topic, cron, sources, maxResults })
    await refresh()
  }

  async function openResults(id: string) {
    const data = await listAlertResults(id)
    setSelected({ id, results: data.items || [] })
  }

  async function onDelete(id: string) {
    await deleteAlert(id)
    await refresh()
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card">
        <h2 className="text-lg font-semibold mb-3">Create alert</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <input value={alertId} onChange={e=>setAlertId(e.target.value)} placeholder="alert id" className="px-3 py-2 rounded bg-slate-900/60 border border-white/10" />
          <input value={topic} onChange={e=>setTopic(e.target.value)} placeholder="topic" className="px-3 py-2 rounded bg-slate-900/60 border border-white/10" />
          <input value={cron} onChange={e=>setCron(e.target.value)} placeholder="cron e.g. 0 9 * * 1" className="px-3 py-2 rounded bg-slate-900/60 border border-white/10" />
          <input value={sources} onChange={e=>setSources(e.target.value)} placeholder="sources" className="px-3 py-2 rounded bg-slate-900/60 border border-white/10" />
          <input type="number" value={maxResults} onChange={e=>setMaxResults(parseInt(e.target.value||'20'))} placeholder="max results" className="px-3 py-2 rounded bg-slate-900/60 border border-white/10" />
          <button className="btn" onClick={onCreate}>Create</button>
        </div>
        <div className="text-xs text-slate-400 mt-2">Cron uses standard format (min hour day month weekday). Example: "*/5 * * * *" = every 5 minutes.</div>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-6">
        {items.map((it, i) => (
          <div key={i} className="card">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{it.alertId}</div>
                <div className="text-xs text-slate-400">{it.topic} · {it.cron} · {it.sources} · {it.maxResults}</div>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-sm" onClick={()=>openResults(it.alertId)}>Results</button>
                <button className="px-3 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-sm" onClick={()=>onDelete(it.alertId)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/60 backdrop-blur flex items-center justify-center p-6" onClick={()=>setSelected(null)}>
          <div className="card max-w-4xl w-full max-h-[80vh] overflow-auto" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Alert results — {selected.id}</h3>
              <button onClick={()=>setSelected(null)} className="px-2 py-1 rounded bg-white/10">Close</button>
            </div>
            {(selected.results || []).map((snap: any, k: number) => (
              <div key={k} className="mb-6">
                <div className="text-sm text-slate-400 mb-2">Snapshot {k+1}</div>
                <div className="grid md:grid-cols-2 gap-4">
                  {(snap.merged || []).slice(0,8).map((p: any, i: number) => (
                    <div key={i} className="p-3 rounded bg-white/5">
                      <div className="font-medium">{p.title}</div>
                      <div className="text-xs text-slate-400">{p.authors} · {p.year} · {p.publication}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}

