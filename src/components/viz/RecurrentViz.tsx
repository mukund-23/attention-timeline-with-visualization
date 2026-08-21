import { useMemo, useState } from 'react'
import { COLORS } from '../../colors'

type Rule = 'linear' | 'delta' | 'gated' | 'channel' | 'segment' | 'kernel'

const CFG: Record<string, { rule: Rule; label: string; note: string }> = {
  'linear-attention': { rule: 'linear', label: 'Additive state update', note: 'Every token adds an outer product to a fixed-size state. Nothing is ever removed, only diluted — so once the number of stored associations passes the state capacity, retrieval degrades and there is no mechanism to do anything about it.' },
  'performer': { rule: 'kernel', label: 'Random-feature approximation', note: 'Same associativity trick, but the feature map is chosen to approximate softmax with a bounded error rather than guessed. The error is smallest where attention is diffuse and largest where it is sharp — which is where it matters most.' },
  'transformer-xl': { rule: 'segment', label: 'Cached previous segment', note: 'Not a state update at all — the previous segment\'s hidden states are cached and attended to, with gradients stopped at the boundary. Context extends without the window extending, but the model never learns dependencies longer than what the cache happened to hold.' },
  'delta-rule': { rule: 'delta', label: 'Delta rule — read before write', note: 'Before writing key k, read what is currently stored there and write only the difference. Writing a key that already exists overwrites rather than superimposes. The update is sequential, which is exactly why it sat unused for three years.' },
  'deltanet-parallelized': { rule: 'delta', label: 'Delta rule, chunk-parallel', note: 'Identical semantics to the delta rule — the contribution is an algorithm that makes it trainable at scale by processing chunks in parallel. The capacity picture below is unchanged; only the throughput is.' },
  'gated-deltanet': { rule: 'gated', label: 'Gated delta — decay plus correction', note: 'A decay gate on the whole state plus the delta rule\'s targeted correction. Two independent controls: how much of everything to forget, and how much of this specific association to fix. Deliberate forgetting is what lets recent items stay sharp.' },
  'kda': { rule: 'channel', label: 'Channel-wise gated delta', note: 'The decay gate becomes diagonal rather than scalar, so each dimension of the state forgets at its own learned rate. Different channels hold information with different useful lifetimes.' },
}

const T_MAX = 64
const NKEYS = 10

function simulate(rule: Rule, d: number) {
  let seed = 99991
  const sym = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 * 2 - 1 }
  const uni = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
  const unit = () => {
    const v = Array.from({ length: d }, sym)
    const n = Math.hypot(...v)
    return v.map(x => x / n)
  }
  const keys = Array.from({ length: NKEYS }, unit)
  const S = Array.from({ length: d }, () => new Float64Array(d))
  const alphaCh = Array.from({ length: d }, (_, i) => 0.93 + 0.06 * (i / d))
  const read = (k: number[]) => {
    const o = new Float64Array(d)
    for (let a = 0; a < d; a++) { let t = 0; for (let b = 0; b < d; b++) t += S[a][b] * k[b]; o[a] = t }
    return o
  }
  const cos = (r: Float64Array, v: number[]) => {
    let dt = 0, nr = 0, nv = 0
    for (let a = 0; a < d; a++) { dt += r[a] * v[a]; nr += r[a] * r[a]; nv += v[a] * v[a] }
    return nr > 1e-9 ? dt / (Math.sqrt(nr) * Math.sqrt(nv)) : 0
  }

  const latest: Record<number, number[]> = {}
  const curve: { t: number; all: number; recent: number }[] = []

  for (let t = 0; t < T_MAX; t++) {
    const ki = Math.floor(uni() * NKEYS)
    const k = keys[ki], v = unit()
    latest[ki] = v
    const cur = read(k)
    const additive = rule === 'linear' || rule === 'kernel'

    for (let a = 0; a < d; a++) {
      for (let b = 0; b < d; b++) {
        let next = additive ? S[a][b] + v[a] * k[b] : S[a][b] + (v[a] - cur[a]) * k[b]
        if (rule === 'gated' || rule === 'segment') next *= 0.985
        if (rule === 'channel') next *= alphaCh[a]
        S[a][b] = next
      }
    }

    if (t % 2 === 1) {
      let sum = 0, n = 0
      for (const key in latest) { sum += cos(read(keys[+key]), latest[+key]); n++ }
      curve.push({
        t: t + 1,
        all: Math.max(0, sum / n),
        recent: Math.max(0, cos(read(k), v)),
      })
    }
  }
  return curve
}

const W = 420, H = 190, PAD = 36

export default function RecurrentViz({ entryId }: { entryId: string }) {
  const cfg = CFG[entryId] ?? CFG['linear-attention']
  const [d, setD] = useState(16)

  const { mine, baseline } = useMemo(() => ({
    mine: simulate(cfg.rule, d),
    baseline: cfg.rule === 'linear' ? null : simulate('linear', d),
  }), [cfg.rule, d])

  const px = (t: number) => PAD + ((t - 1) / (T_MAX - 1)) * (W - PAD * 2)
  const py = (v: number) => PAD + (1 - v) * (H - PAD * 2)
  const path = (c: typeof mine, key: 'all' | 'recent') =>
    c.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.t).toFixed(1)} ${py(p[key]).toFixed(1)}`).join('')

  const final = mine[mine.length - 1]

  return (
    <div className="viz">
      <div className="viz-head">
        <span className="viz-title">{cfg.label}</span>
        <span className="viz-stat">
          {NKEYS} keys, {T_MAX} writes, {d}x{d} state: <b>{Math.round(final.all * 100)}%</b> return the current value
        </span>
      </div>
      <div className="viz-body">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img"
          aria-label={`Retrieval quality against number of stored associations for ${cfg.label}`}>
          <line x1={PAD} y1={py(1)} x2={W - PAD} y2={py(1)} stroke={COLORS.ruleSoft} strokeWidth={0.5} />
          <line x1={px(NKEYS)} y1={PAD - 8} x2={px(NKEYS)} y2={H - PAD} stroke={COLORS.cost} strokeWidth={1} strokeDasharray="3 3" />
          <text x={px(NKEYS) + 5} y={PAD - 12} fontSize={9.5} fontFamily="monospace" fill={COLORS.cost}>keys start repeating</text>

          {baseline && <path d={path(baseline, 'all')} fill="none" stroke={COLORS.faint} strokeWidth={1.2} strokeDasharray="4 3" />}
          <path d={path(mine, 'recent')} fill="none" stroke={COLORS.keep} strokeWidth={1.2} opacity={0.4} />
          <path d={path(mine, 'all')} fill="none" stroke={COLORS.keep} strokeWidth={2} />

          <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke={COLORS.rule} strokeWidth={0.5} />
          <text x={PAD} y={H - 14} fontSize={9.5} fontFamily="monospace" fill={COLORS.faint}>writes (keys repeat) →</text>
          <text x={PAD - 6} y={py(1) + 3} fontSize={9.5} fontFamily="monospace" fill={COLORS.faint} textAnchor="end">1.0</text>
          <text x={PAD - 6} y={py(0) + 3} fontSize={9.5} fontFamily="monospace" fill={COLORS.faint} textAnchor="end">0</text>
        </svg>
        <div className="viz-side">
          <p className="viz-note">{cfg.note}</p>
          <label className="viz-ctl">
            <span>State size</span>
            <input type="range" min={8} max={32} step={4} value={d} onChange={e => setD(+e.target.value)} />
            <b>{d}</b>
          </label>
          <div className="viz-key">
            <span><i style={{ background: COLORS.keep, height: 2 }} />all keys — is the current value returned?</span>
            <span><i style={{ background: COLORS.keep, opacity: .4, height: 2 }} />the key just written</span>
            {baseline && <span><i style={{ background: COLORS.faint, height: 2 }} />plain additive update, same state size</span>}
          </div>
          <p className="viz-fine">
            A real simulation, not an illustration. {NKEYS} keys are written repeatedly, each time with a
            new value, then every key is queried back and compared against the value most recently
            written for it. An additive update superimposes every value that key ever had and returns
            the mixture; reading before writing replaces instead. Move the state size to change how
            much interference the state can absorb.
          </p>
        </div>
      </div>
    </div>
  )
}
