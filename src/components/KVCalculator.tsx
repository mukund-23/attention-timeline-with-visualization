import { useState } from 'react'

const SCHEMES = [
  { id: 'mha', name: 'MHA', entry: 'scaled-dot-product-attention', year: 2017 },
  { id: 'mqa', name: 'MQA', entry: 'multi-query-attention', year: 2019 },
  { id: 'gqa', name: 'GQA', entry: 'grouped-query-attention', year: 2023 },
  { id: 'mla', name: 'MLA', entry: 'multi-head-latent-attention', year: 2024 },
] as const

interface Preset {
  id: string; name: string; note: string
  layers: number; heads: number; headDim: number; groups: number; latent: number
  native: 'mha' | 'mqa' | 'gqa' | 'mla'
}

// Figures from each model's published config. Verify against the model card before quoting.
const PRESETS: Preset[] = [
  { id: 'l3-8b', name: 'Llama 3 8B', note: 'GQA, 8 KV heads', native: 'gqa',
    layers: 32, heads: 32, headDim: 128, groups: 8, latent: 512 },
  { id: 'l3-70b', name: 'Llama 3 70B', note: 'GQA, 8 KV heads', native: 'gqa',
    layers: 80, heads: 64, headDim: 128, groups: 8, latent: 512 },
  { id: 'mistral-7b', name: 'Mistral 7B', note: 'GQA + sliding window', native: 'gqa',
    layers: 32, heads: 32, headDim: 128, groups: 8, latent: 512 },
  { id: 'dsv3', name: 'DeepSeek-V3', note: 'MLA, latent 512 + 64 rope', native: 'mla',
    layers: 61, heads: 128, headDim: 128, groups: 8, latent: 512 },
]

const fmt = (b: number) =>
  b >= 1e12 ? `${(b / 1e12).toFixed(2)} TB`
    : b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB`
      : b >= 1e6 ? `${Math.round(b / 1e6)} MB`
        : `${Math.round(b / 1e3)} KB`

export default function KVCalculator() {
  const [seqK, setSeqK] = useState(32)
  const [layers, setLayers] = useState(60)
  const [heads, setHeads] = useState(64)
  const [headDim, setHeadDim] = useState(128)
  const [groups, setGroups] = useState(8)
  const [latent, setLatent] = useState(512)
  const [batch, setBatch] = useState(1)
  const [fp8, setFp8] = useState(false)
  const [preset, setPreset] = useState<string | null>(null)

  const apply = (p: Preset) => {
    setLayers(p.layers); setHeads(p.heads); setHeadDim(p.headDim)
    setGroups(p.groups); setLatent(p.latent); setPreset(p.id)
  }
  const cur = PRESETS.find(p => p.id === preset)

  const bytes = fp8 ? 1 : 2
  const seq = seqK * 1024

  const perToken = (id: string) =>
    id === 'mha' ? 2 * heads * headDim
      : id === 'mqa' ? 2 * headDim
        : id === 'gqa' ? 2 * groups * headDim
          : latent + 64

  const total = (id: string) => perToken(id) * layers * seq * bytes * batch
  const max = total('mha')

  return (
    <section className="tool">
      <div className="wrap">
        <h2>What the cache actually costs</h2>
        <p className="toollede">
          The quadratic bill gets all the attention. This is the other one — the memory a model
          re-reads for every single token it generates. Set a shape and see why four separate
          mechanisms on this timeline exist to shrink it.
        </p>

        <div className="calcpresets" role="group" aria-label="Model preset">
          <span className="threadlabel">Start from</span>
          {PRESETS.map(p => (
            <button key={p.id} aria-pressed={preset === p.id} onClick={() => apply(p)}>
              <b>{p.name}</b><i>{p.note}</i>
            </button>
          ))}
          {preset && <button className="threadclear" onClick={() => setPreset(null)}>custom</button>}
        </div>

        <div className="calcgrid">
          <div className="calcinputs">
            {([
              ['Context', seqK, setSeqK, 1, 1024, 'K tokens'],
              ['Layers', layers, setLayers, 8, 128, ''],
              ['Query heads', heads, setHeads, 8, 128, ''],
              ['Head dim', headDim, setHeadDim, 64, 256, ''],
              ['KV groups (GQA)', groups, setGroups, 1, 32, ''],
              ['Latent dim (MLA)', latent, setLatent, 128, 1024, ''],
              ['Batch', batch, setBatch, 1, 64, 'seqs'],
            ] as const).map(([label, val, set, lo, hi, unit]) => (
              <label className="calcrow" key={label}>
                <span>{label}</span>
                <input type="range" min={lo} max={hi} value={val}
                  onChange={e => (set as (n: number) => void)(+e.target.value)} />
                <b>{val}{unit ? ` ${unit}` : ''}</b>
              </label>
            ))}
            <label className="calccheck">
              <input type="checkbox" checked={fp8} onChange={e => setFp8(e.target.checked)} />
              fp8 cache instead of fp16
            </label>
          </div>

          <div className="calcout">
            {SCHEMES.map(s => {
              const t = total(s.id)
              return (
                <a className="calcbar" key={s.id} href={`#${s.entry}`}>
                  <span className="calcname">{s.name} <i>{s.year}</i></span>
                  <span className="calctrack">
                    <span className="calcfill" style={{ width: `${Math.max(0.6, (t / max) * 100)}%` }} />
                  </span>
                  <span className="calcval">
                    {fmt(t)}
                    {s.id !== 'mha' && <i>{(max / t).toFixed(1)}x</i>}
                  </span>
                </a>
              )
            })}
            <p className="calcnote">
              At this shape, MHA needs <strong>{fmt(total('mha'))}</strong> of cache and MLA needs{' '}
              <strong>{fmt(total('mla'))}</strong>. On an 80GB accelerator, the cache alone
              would consume {Math.round((total('mha') / 80e9) * 100)}% of the card under MHA
              and {Math.round((total('mla') / 80e9) * 100)}% under MLA — before the weights.
              That gap is the entire reason the KV thread exists.
            </p>
            {cur && (
              <p className="calcpresetnote">
                <b>{cur.name}</b> ships with <b>{cur.native.toUpperCase()}</b>, so its real cache is the{' '}
                {cur.native.toUpperCase()} row — {fmt(total(cur.native))} at this context. The other rows
                show what the same model shape would have cost under the schemes it did not choose.
              </p>
            )}
            <p className="calcfine">
              Shapes are taken from each model's published config; verify against the model card before
              quoting them. Arithmetic only: bytes = per-token KV x layers x tokens x precision x batch. Real
              serving adds fragmentation, paging overhead and framework padding. MLA's figure assumes
              a compressed latent plus the uncompressed slice that carries position.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
