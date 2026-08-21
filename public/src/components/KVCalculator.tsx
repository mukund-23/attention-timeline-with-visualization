import { useState } from 'react'

const SCHEMES = [
  { id: 'mha', name: 'MHA', entry: 'scaled-dot-product-attention', year: 2017 },
  { id: 'mqa', name: 'MQA', entry: 'multi-query-attention', year: 2019 },
  { id: 'gqa', name: 'GQA', entry: 'grouped-query-attention', year: 2023 },
  { id: 'mla', name: 'MLA', entry: 'multi-head-latent-attention', year: 2024 },
] as const

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
            <p className="calcfine">
              Arithmetic only: bytes = per-token KV x layers x tokens x precision x batch. Real
              serving adds fragmentation, paging overhead and framework padding. MLA's figure assumes
              a compressed latent plus the uncompressed slice that carries position.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
