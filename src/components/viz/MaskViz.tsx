import { useMemo, useState } from 'react'

const N = 20

const scores = (() => {
  let s = 7
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
  const m: number[][] = []
  for (let i = 0; i < N; i++) {
    m[i] = []
    for (let j = 0; j < N; j++) {
      m[i][j] = j > i ? -1 : rnd() * 0.35 + (i - j < 3 ? 0.55 : 0) + (j < 2 ? 0.45 : 0)
    }
  }
  return m
})()

type Kind = 'dense' | 'window' | 'sink' | 'topk' | 'strided' | 'bigbird' | 'block' | 'indexer'

interface Cfg { kind: Kind; label: string; param?: [string, number, number, number]; note: string }

const CFG: Record<string, Cfg> = {
  'scaled-dot-product-attention': { kind: 'dense', label: 'Full causal attention', note: 'Every query attends to every earlier key. Nothing discarded, nothing approximated.' },
  'sparse-transformer': { kind: 'strided', label: 'Strided factorised', param: ['Stride', 2, 6, 3], note: 'A fixed pattern chosen in advance. It cannot notice that the token it needs sits at an unattended position.' },
  'longformer': { kind: 'window', label: 'Sliding window', param: ['Window w', 1, 10, 3], note: 'Distant pairs are not lost outright — they must travel through intermediate layers, degrading at each hop.' },
  'bigbird': { kind: 'bigbird', label: 'Local + global + random', param: ['Window w', 1, 6, 2], note: 'Random edges give short paths between any two positions with high probability. They are also the worst possible memory access pattern for a GPU.' },
  'top-k-attention': { kind: 'topk', label: 'Top-k by score', param: ['k', 1, 14, 5], note: 'Content-chosen rather than position-chosen. But every score had to be computed to find the top k, so compute stays quadratic — the flaw that kept this idea unused for four years.' },
  'attention-sinks': { kind: 'sink', label: 'Sinks + sliding window', param: ['Window w', 1, 10, 3], note: 'Identical to sliding window except the first four columns are never evicted. That difference is the whole paper.' },
  'native-sparse-attention': { kind: 'block', label: 'Block-selected + local', param: ['Block size', 2, 5, 2], note: 'Selection happens over contiguous blocks, not tokens, because contiguous blocks are what GPUs read efficiently. A single critical token inside an unselected block is invisible.' },
  'deepseek-sparse-attention': { kind: 'indexer', label: 'Indexer top-k', param: ['k', 1, 14, 5], note: 'A cheap scorer estimates relevance first, so only k keys reach full attention. The estimate can be wrong, and when it is, the miss is silent.' },
}

function maskFn(kind: Kind, p: number) {
  return (i: number, j: number): boolean => {
    if (j > i) return false
    switch (kind) {
      case 'dense': return true
      case 'window': return i - j < p
      case 'sink': return j < 4 || i - j < p
      case 'strided': return i - j < 2 || j % p === 0
      case 'bigbird': return i - j < p || j < 2 || (i * 7 + j * 13) % 11 === 0
      case 'block': {
        const bi = Math.floor(i / p), bj = Math.floor(j / p)
        return bi === bj || bj === 0 || bi - bj === 1
      }
      case 'topk': case 'indexer': {
        const row: [number, number][] = []
        for (let c = 0; c <= i; c++) row.push([c, scores[i][c] + (kind === 'indexer' ? ((i * 3 + c * 5) % 7) * 0.02 : 0)])
        row.sort((a, b) => b[1] - a[1])
        return row.slice(0, Math.min(p, row.length)).some(r => r[0] === j)
      }
    }
  }
}

export default function MaskViz({ entryId }: { entryId: string }) {
  const cfg = CFG[entryId] ?? CFG['scaled-dot-product-attention']
  const [p, setP] = useState(cfg.param ? cfg.param[3] : 0)
  const [showLost, setShowLost] = useState(true)

  const { cells, kept, causal } = useMemo(() => {
    const f = maskFn(cfg.kind, p)
    const out: JSX.Element[] = []
    let kept = 0, causal = 0
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const x = j * 16, y = i * 16
        if (j > i) { out.push(<rect key={`${i}-${j}`} x={x} y={y} width={14} height={14} fill="none" stroke="#E4E9E7" strokeWidth={0.5} />); continue }
        causal++
        if (f(i, j)) {
          kept++
          const w = Math.min(1, Math.max(0.3, scores[i][j]))
          out.push(<rect key={`${i}-${j}`} x={x} y={y} width={14} height={14} fill="#21506E" opacity={w} />)
        } else {
          out.push(<rect key={`${i}-${j}`} x={x} y={y} width={14} height={14}
            fill={showLost ? '#B08A2A' : 'none'} opacity={showLost ? 0.5 : 1}
            stroke={showLost ? 'none' : '#E4E9E7'} strokeWidth={0.5} />)
        }
      }
    }
    return { cells: out, kept, causal }
  }, [cfg.kind, p, showLost])

  return (
    <div className="viz">
      <div className="viz-head">
        <span className="viz-title">{cfg.label}</span>
        <span className="viz-stat">
          <b>{kept}</b> of {causal} pairs computed
          {kept < causal && <> · <span className="viz-cost">{causal - kept} discarded</span></>}
        </span>
      </div>
      <div className="viz-body">
        <svg width={320} height={320} viewBox="0 0 320 320" role="img"
          aria-label={`${cfg.label}: ${kept} of ${causal} query-key pairs computed`}>
          {cells}
        </svg>
        <div className="viz-side">
          <p className="viz-note">{cfg.note}</p>
          {cfg.param && (
            <label className="viz-ctl">
              <span>{cfg.param[0]}</span>
              <input type="range" min={cfg.param[1]} max={cfg.param[2]} step={1}
                value={p} onChange={e => setP(+e.target.value)} />
              <b>{p}</b>
            </label>
          )}
          {kept < causal && (
            <label className="viz-check">
              <input type="checkbox" checked={showLost} onChange={e => setShowLost(e.target.checked)} />
              Show discarded pairs
            </label>
          )}
          <div className="viz-key">
            <span><i style={{ background: '#21506E' }} />computed, shaded by weight</span>
            <span><i style={{ background: '#B08A2A', opacity: .5 }} />discarded — dense would use it</span>
            <span><i style={{ border: '1px solid #E4E9E7' }} />masked by causality</span>
          </div>
        </div>
      </div>
    </div>
  )
}
