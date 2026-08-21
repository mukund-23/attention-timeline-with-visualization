import { useState } from 'react'
import { COLORS } from '../../colors'

type Scheme = 'mha' | 'mqa' | 'gqa' | 'mla'

const CFG: Record<string, { scheme: Scheme; note: string }> = {
  'scaled-dot-product-attention': { scheme: 'mha', note: 'Every query head keeps its own keys and values. At decode time the whole cache is re-read for each generated token, which is why generation is bound by memory bandwidth rather than arithmetic.' },
  'multi-query-attention': { scheme: 'mqa', note: 'All query heads share one key/value head. The cache shrinks by the head count. Heads can still ask different questions, but they must all consult the same index — and that costs quality.' },
  'grouped-query-attention': { scheme: 'gqa', note: 'Query heads are divided into groups, each with its own key/value head. A dial rather than a binary choice — and an existing MHA checkpoint can be converted by mean-pooling for about 5% of pretraining compute.' },
  'multi-head-latent-attention': { scheme: 'mla', note: 'Keys and values are compressed into a shared low-rank latent, and only the latent is cached. Position needs a separate uncompressed slice, because rotation does not commute with the up-projection.' },
}

const LAYERS = 60, HEADS = 32, HEAD_DIM = 128, BYTES = 2

function cacheBytes(scheme: Scheme, seq: number, groups: number) {
  const perTokenPerLayer =
    scheme === 'mha' ? 2 * HEADS * HEAD_DIM :
    scheme === 'mqa' ? 2 * 1 * HEAD_DIM :
    scheme === 'gqa' ? 2 * groups * HEAD_DIM :
    512 + 64
  return perTokenPerLayer * LAYERS * seq * BYTES
}

const fmt = (b: number) => b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.round(b / 1e6)} MB`

export default function KVViz({ entryId }: { entryId: string }) {
  const cfg = CFG[entryId] ?? CFG['scaled-dot-product-attention']
  const [seqK, setSeqK] = useState(32)
  const [groups, setGroups] = useState(8)
  const seq = seqK * 1024

  const mine = cacheBytes(cfg.scheme, seq, groups)
  const base = cacheBytes('mha', seq, groups)
  const kvHeads = cfg.scheme === 'mha' ? 8 : cfg.scheme === 'mqa' ? 1 : cfg.scheme === 'gqa' ? Math.min(4, groups) : 1

  const qh = 8
  return (
    <div className="viz">
      <div className="viz-head">
        <span className="viz-title">KV cache at {seqK}K tokens</span>
        <span className="viz-stat">
          <b>{fmt(mine)}</b>
          {cfg.scheme !== 'mha' && <> · <span className="viz-keep">{(base / mine).toFixed(1)}x smaller than MHA</span></>}
        </span>
      </div>
      <div className="viz-body">
        <svg width={300} height={190} viewBox="0 0 300 190" role="img"
          aria-label={`${cfg.scheme.toUpperCase()} wiring: ${qh} query heads to ${kvHeads} key-value heads`}>
          <text x={10} y={16} fontSize={10} fontFamily="monospace" fill={COLORS.faint}>query heads</text>
          {Array.from({ length: qh }, (_, i) => (
            <rect key={i} x={10 + i * 35} y={24} width={26} height={20} fill={COLORS.keep} opacity={0.85} />
          ))}
          {Array.from({ length: qh }, (_, i) => {
            const target = cfg.scheme === 'mha' ? i : Math.floor(i / (qh / kvHeads))
            const x1 = 23 + i * 35
            const x2 = cfg.scheme === 'mla' ? 150 : 23 + target * 35 * (qh / kvHeads) + (35 * (qh / kvHeads) - 26) / 2
            return <line key={i} x1={x1} y1={44} x2={x2} y2={cfg.scheme === 'mla' ? 108 : 128} stroke={COLORS.rule} strokeWidth={1} />
          })}
          {cfg.scheme === 'mla' && (
            <>
              <rect x={110} y={108} width={80} height={18} fill={COLORS.cost} opacity={0.7} />
              <text x={150} y={121} fontSize={9} fontFamily="monospace" fill={COLORS.white} textAnchor="middle">latent</text>
              <line x1={150} y1={126} x2={150} y2={128} stroke={COLORS.rule} />
            </>
          )}
          <text x={10} y={148} fontSize={10} fontFamily="monospace" fill={COLORS.faint}>
            {cfg.scheme === 'mla' ? 'cached latent, re-expanded' : `${kvHeads} key/value head${kvHeads > 1 ? 's' : ''} cached`}
          </text>
          {Array.from({ length: cfg.scheme === 'mla' ? 1 : kvHeads }, (_, i) => {
            const w = cfg.scheme === 'mla' ? 80 : (26 * qh + 9 * (qh - 1)) / kvHeads - 6
            const x = cfg.scheme === 'mla' ? 110 : 10 + i * ((280) / kvHeads)
            return <rect key={i} x={x} y={128} width={cfg.scheme === 'mla' ? w : Math.max(20, w)} height={16} fill={COLORS.keep} opacity={0.35} />
          })}
          <rect x={10} y={166} width={280} height={12} fill={COLORS.ruleSoft} />
          <rect x={10} y={166} width={Math.max(3, 280 * (mine / base))} height={12} fill={COLORS.cost} opacity={0.75} />
          <text x={10} y={188} fontSize={9} fontFamily="monospace" fill={COLORS.faint}>
            bar: cache size relative to MHA at the same context
          </text>
        </svg>
        <div className="viz-side">
          <p className="viz-note">{cfg.note}</p>
          <label className="viz-ctl">
            <span>Context</span>
            <input type="range" min={1} max={128} step={1} value={seqK} onChange={e => setSeqK(+e.target.value)} />
            <b>{seqK}K</b>
          </label>
          {cfg.scheme === 'gqa' && (
            <label className="viz-ctl">
              <span>KV groups</span>
              <input type="range" min={1} max={32} step={1} value={groups} onChange={e => setGroups(+e.target.value)} />
              <b>{groups}</b>
            </label>
          )}
          <p className="viz-fine">
            Model assumed: {LAYERS} layers, {HEADS} heads, head dim {HEAD_DIM}, fp16. Illustrative
            arithmetic on a 70B-class shape, not a measurement of any specific model.
          </p>
        </div>
      </div>
    </div>
  )
}
