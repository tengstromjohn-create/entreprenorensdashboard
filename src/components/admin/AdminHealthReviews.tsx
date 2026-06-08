import { useState, useCallback } from 'react'
import { callEdgeFunction } from '@/lib/edge-functions'
import { Loader2, ShieldCheck, RefreshCw, Save, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react'

// ---------------------------------------------------------------------------
// Typer (speglar analysstrukturen från generate-health-check)
// ---------------------------------------------------------------------------
interface Recommendation {
  title: string
  description: string
  priority: string
  consequence_if_skipped: string
}
interface Area {
  name: string
  score: number
  color: 'green' | 'yellow' | 'red'
  key_findings: string[]
  recommendations: Recommendation[]
  johns_perspective: string | null
}
interface Analysis {
  company_name: string
  org_number: string
  analysis_date: string
  trust_level: string
  total_score: number
  total_color: 'green' | 'yellow' | 'red'
  areas: Area[]
  top_3_actions: { action: string; area: string; link_to_tool: string | null }[]
  regulatory_requirements?: unknown[]
  upgrade_cta: string | null
}
interface ListItem {
  id: string
  created_at: string
  org_number: string
  company_name: string
  score: number
  review_status: string
  total_color: string | null
}

const SECRET_KEY = 'grundat_admin_secret'
const COLORS = ['green', 'yellow', 'red'] as const

function colorFromScore(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 70) return 'green'
  if (score >= 40) return 'yellow'
  return 'red'
}

export function AdminHealthReviews() {
  const [secret, setSecret] = useState(() => sessionStorage.getItem(SECRET_KEY) || '')
  const [authed, setAuthed] = useState(false)
  const [items, setItems] = useState<ListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selected, setSelected] = useState<{ id: string; analysis: Analysis; status: string } | null>(null)
  const [reviewedBy, setReviewedBy] = useState('')
  const [reviewNote, setReviewNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)

  const loadList = useCallback(async (sec: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await callEdgeFunction<{ items: ListItem[] }>('admin-health-reviews', { action: 'list', adminSecret: sec })
      setItems(res.items)
      setAuthed(true)
      sessionStorage.setItem(SECRET_KEY, sec)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte hämta listan')
      setAuthed(false)
    } finally {
      setLoading(false)
    }
  }, [])

  const openReview = async (id: string) => {
    setLoading(true)
    setError(null)
    setSavedOk(false)
    try {
      const res = await callEdgeFunction<{ effective_analysis: Analysis; review_status: string; reviewed_by?: string; review_note?: string }>(
        'admin-health-reviews',
        { action: 'get', id, adminSecret: secret }
      )
      setSelected({ id, analysis: res.effective_analysis, status: res.review_status })
      setReviewedBy(res.reviewed_by || '')
      setReviewNote(res.review_note || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte hämta analysen')
    } finally {
      setLoading(false)
    }
  }

  const updateArea = (idx: number, patch: Partial<Area>) => {
    if (!selected) return
    const areas = selected.analysis.areas.map((a, i) => (i === idx ? { ...a, ...patch } : a))
    setSelected({ ...selected, analysis: { ...selected.analysis, areas } })
  }

  const save = async () => {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      // Räkna om total utifrån områdesbetygen (enkel medel; vikterna lever i prompten)
      await callEdgeFunction('admin-health-reviews', {
        action: 'save',
        id: selected.id,
        correctedAnalysis: selected.analysis,
        reviewedBy,
        reviewNote,
        adminSecret: secret,
      })
      setSavedOk(true)
      await loadList(secret)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte spara')
    } finally {
      setSaving(false)
    }
  }

  // -------------------------------------------------------------------------
  // Inloggning (admin-nyckel)
  // -------------------------------------------------------------------------
  if (!authed) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 max-w-md">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={18} className="text-[#0E3047]" />
          <h2 className="font-semibold text-[#0E3047]">Health Check-granskning</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">Ange admin-nyckel för att granska och rätta AI-analyser.</p>
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Admin-nyckel"
          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm mb-3"
          onKeyDown={(e) => e.key === 'Enter' && secret && loadList(secret)}
        />
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <button
          onClick={() => loadList(secret)}
          disabled={!secret || loading}
          className="w-full bg-[#0E3047] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#1A4060] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : null}
          Logga in
        </button>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Redigerare
  // -------------------------------------------------------------------------
  if (selected) {
    const a = selected.analysis
    return (
      <div className="space-y-4 max-w-3xl">
        <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#0E3047]">
          <ArrowLeft size={15} /> Tillbaka till listan
        </button>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-[#0E3047]">{a.company_name} · {a.org_number}</h2>
          <p className="text-sm text-gray-500">Analysdatum {a.analysis_date} · status: {selected.status}</p>
          <div className="mt-3 flex items-center gap-3">
            <label className="text-sm text-[#0E3047]">Totalpoäng</label>
            <input
              type="number" min={0} max={100}
              value={a.total_score}
              onChange={(e) => setSelected({ ...selected, analysis: { ...a, total_score: Number(e.target.value), total_color: colorFromScore(Number(e.target.value)) } })}
              className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
            />
            <span className="text-xs text-gray-400">färg sätts automatiskt: {a.total_color}</span>
          </div>
        </div>

        {a.areas.map((area, idx) => (
          <div key={idx} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#0E3047]">{area.name}</h3>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={0} max={100}
                  value={area.score}
                  onChange={(e) => updateArea(idx, { score: Number(e.target.value), color: colorFromScore(Number(e.target.value)) })}
                  className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                />
                <select
                  value={area.color}
                  onChange={(e) => updateArea(idx, { color: e.target.value as Area['color'] })}
                  className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                >
                  {COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Observationer (en per rad)</label>
              <textarea
                value={area.key_findings.join('\n')}
                onChange={(e) => updateArea(idx, { key_findings: e.target.value.split('\n').filter(Boolean) })}
                rows={3}
                className="w-full mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Johns perspektiv</label>
              <textarea
                value={area.johns_perspective || ''}
                onChange={(e) => updateArea(idx, { johns_perspective: e.target.value || null })}
                rows={3}
                className="w-full mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none"
              />
            </div>
          </div>
        ))}

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Granskad av</label>
              <input value={reviewedBy} onChange={(e) => setReviewedBy(e.target.value)} placeholder="Ditt namn" className="w-full mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Intern notering</label>
              <input value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="(valfritt)" className="w-full mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 bg-[#0E3047] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#1A4060] disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Spara som juristgranskad
            </button>
            {savedOk && <span className="flex items-center gap-1 text-sm text-green-600"><CheckCircle2 size={15} /> Sparat</span>}
          </div>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Lista
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-3 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-[#0E3047]" />
          <h2 className="font-semibold text-[#0E3047]">Health Check-granskning</h2>
        </div>
        <button onClick={() => loadList(secret)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#0E3047]">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Uppdatera
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {items.length === 0 && !loading && <p className="text-sm text-gray-500">Inga analyser ännu.</p>}
      <div className="space-y-2">
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => openReview(it.id)}
            className="w-full flex items-center gap-3 bg-white rounded-lg border border-gray-100 p-4 text-left hover:border-[#0E3047]/40 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium text-[#0E3047] truncate">{it.company_name}</p>
              <p className="text-xs text-gray-400">{it.org_number} · {new Date(it.created_at).toLocaleDateString('sv-SE')}</p>
            </div>
            <span className="text-sm font-medium text-[#0E3047]">{it.score}</span>
            {it.review_status === 'lawyer_reviewed' ? (
              <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 size={13} /> Granskad</span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-amber-600"><AlertTriangle size={13} /> AI</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
