import { useMemo, useState } from 'react'

const W = 460, H = 190, PAD = 34
const DIMS = 8
const TRAINED = 2048

type Variant = 'learned' | 'sinusoidal' | 'relative' | 'rope' | 'scaling' | 'alibi' | 'nope' | 'drope'

const CFG: Record<string, { variant: Variant; label: string; note: string }> = {
  'learned-absolute-positional-embeddings': { variant: 'learned', label: 'Learned table, one vector per index', note: 'Nothing connects position 7 to position 8 — each is an independent vector. Adjacency has to be learned. Past the trained length there is no vector at all, so the model cannot run there.' },
  'sinusoidal-positional-encoding': { variant: 'sinusoidal', label: 'Fixed sinusoids across dimensions', note: 'Each dimension oscillates at a different rate, fast to slow. Defined at every position, including untrained ones — but being defined there is not the same as working there.' },
  'relative-position-representations': { variant: 'relative', label: 'Learned bias by distance, clipped at k', note: 'Beyond the clip distance every offset looks identical, so the model genuinely cannot distinguish 60 tokens away from 600.' },
  'rotary-position-embeddings': { variant: 'rope', label: 'Rotation angle per dimension', note: 'Rotate each dimension pair by an angle proportional to position. The dot product then depends only on the difference of angles — absolute rotations in, relative dependence out. Past the trained range, the fast dimensions have wrapped into angles never seen.' },
  'position-interpolation': { variant: 'scaling', label: 'Interpolation, uniform squash', note: 'Divide every position by a scaling factor so all angles stay inside the trained band. Every frequency is squashed equally — including the fast ones carrying fine local distance.' },
  'ntk-aware-rope-scaling': { variant: 'scaling', label: 'NTK-aware, non-uniform stretch', note: 'Change the base frequency instead. Slow dimensions stretch a lot, fast dimensions barely at all, so local resolution survives. Degrades faster than interpolation past roughly 4x.' },
  'yarn': { variant: 'scaling', label: 'YaRN, ramped by wavelength', note: 'Classify each dimension by whether its wavelength fits inside the context. Leave the fast ones, interpolate the slow ones, ramp between. Plus a temperature correction on the logits.' },
  'alibi': { variant: 'alibi', label: 'Linear distance penalty per head', note: 'No embedding at all — subtract a slope times distance from each score. Different heads get different slopes, so some stay local and some reach far. The penalty applies whether or not the distant token mattered.' },
  'nope-no-positional-encoding': { variant: 'nope', label: 'No encoding — causal mask only', note: 'Position is recoverable from the causal mask alone: token i sees exactly i predecessors, and that count differs at every position. Weaker and less precise than explicit rotation.' },
  'drope': { variant: 'drope', label: 'Encoding removed after training', note: 'The same question as NoPE, asked of a model that already trained with RoPE. Removes the extrapolation problem rather than stretching the encoding.' },
}

type ScaleMode = 'none' | 'pi' | 'ntk' | 'yarn'
const SCALE_MODE: Record<string, ScaleMode> = {
  'position-interpolation': 'pi', 'ntk-aware-rope-scaling': 'ntk', 'yarn': 'yarn',
}

function theta(d: number, base = 10000) { return Math.pow(base, -2 * d / (DIMS * 2)) }

function angleAt(pos: number, d: number, mode: ScaleMode, s: number) {
  const wl = 2 * Math.PI / theta(d)
  switch (mode) {
    case 'none': return pos * theta(d)
    case 'pi': return (pos / s) * theta(d)
    case 'ntk': return pos * theta(d, 10000 * Math.pow(s, (DIMS * 2) / (DIMS * 2 - 2)))
    case 'yarn': {
      const r = TRAINED / wl
      const ramp = r > 32 ? 0 : r < 1 ? 1 : (32 - r) / 31
      return (pos / (1 + (s - 1) * ramp)) * theta(d)
    }
  }
}

export default function PositionViz({ entryId }: { entryId: string }) {
  const cfg = CFG[entryId] ?? CFG['rotary-position-embeddings']
  const [scale, setScale] = useState(4)
  const [reach, setReach] = useState(2)
  const mode: ScaleMode = SCALE_MODE[entryId] ?? 'none'
  const isRot = cfg.variant === 'rope' || cfg.variant === 'scaling'

  const paths = useMemo(() => {
    const maxPos = TRAINED * reach
    const out: { d: string; dim: number }[] = []
    if (isRot) {
      for (let d = 0; d < DIMS; d++) {
        let s = ''
        for (let px = 0; px <= 80; px++) {
          const pos = (px / 80) * maxPos
          const a = angleAt(pos, d, mode, scale)
          const y = PAD + (H - PAD * 2) * (1 - ((Math.cos(a) + 1) / 2))
          s += `${px === 0 ? 'M' : 'L'}${PAD + (px / 80) * (W - PAD * 2)} ${y}`
        }
        out.push({ d: s, dim: d })
      }
    } else if (cfg.variant === 'alibi') {
      for (let h = 0; h < 6; h++) {
        const slope = Math.pow(2, -(h + 1))
        let s = ''
        for (let px = 0; px <= 80; px++) {
          const dist = (px / 80) * 512
          const y = PAD + Math.min(H - PAD * 2, slope * dist * 3)
          s += `${px === 0 ? 'M' : 'L'}${PAD + (px / 80) * (W - PAD * 2)} ${y}`
        }
        out.push({ d: s, dim: h })
      }
    } else if (cfg.variant === 'sinusoidal') {
      for (let d = 0; d < DIMS; d++) {
        let s = ''
        for (let px = 0; px <= 80; px++) {
          const pos = (px / 80) * 128
          const y = PAD + (H - PAD * 2) * (1 - (Math.sin(pos * theta(d)) + 1) / 2)
          s += `${px === 0 ? 'M' : 'L'}${PAD + (px / 80) * (W - PAD * 2)} ${y}`
        }
        out.push({ d: s, dim: d })
      }
    } else if (cfg.variant === 'relative') {
      let s = ''
      for (let px = 0; px <= 80; px++) {
        const dist = (px / 80) * 40
        const v = dist > 16 ? 0.15 : 1 - dist / 20
        s += `${px === 0 ? 'M' : 'L'}${PAD + (px / 80) * (W - PAD * 2)} ${PAD + (H - PAD * 2) * (1 - v)}`
      }
      out.push({ d: s, dim: 0 })
    } else {
      for (let d = 0; d < 5; d++) {
        let s = ''
        for (let px = 0; px <= 80; px++) {
          const v = ((px * 7 + d * 31) % 23) / 23
          s += `${px === 0 ? 'M' : 'L'}${PAD + (px / 80) * (W - PAD * 2)} ${PAD + (H - PAD * 2) * (1 - v)}`
        }
        out.push({ d: s, dim: d })
      }
    }
    return out
  }, [cfg.variant, isRot, mode, scale, reach])

  const bandW = isRot ? (W - PAD * 2) / reach : 0

  return (
    <div className="viz">
      <div className="viz-head">
        <span className="viz-title">{cfg.label}</span>
        {isRot && <span className="viz-stat">trained to {TRAINED} · showing to {TRAINED * reach}</span>}
      </div>
      <div className="viz-body">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={cfg.label}>
          {isRot && (
            <>
              <rect x={PAD} y={PAD - 10} width={bandW} height={H - PAD * 2 + 20} fill="#21506E" opacity={0.07} />
              <line x1={PAD + bandW} y1={PAD - 10} x2={PAD + bandW} y2={H - PAD + 10} stroke="#B08A2A" strokeWidth={1} strokeDasharray="3 3" />
              <text x={PAD + bandW + 6} y={PAD - 14} fontSize={10} fill="#B08A2A" fontFamily="monospace">trained length</text>
            </>
          )}
          {paths.map(p => (
            <path key={p.dim} d={p.d} fill="none" stroke="#21506E"
              strokeWidth={1.2} opacity={0.25 + (1 - p.dim / DIMS) * 0.6} />
          ))}
          <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#C7D0CE" strokeWidth={0.5} />
          <text x={PAD} y={H - 12} fontSize={10} fill="#8B959A" fontFamily="monospace">
            {isRot ? 'position' : cfg.variant === 'alibi' ? 'distance between tokens' : 'position / distance'}
          </text>
        </svg>
        <div className="viz-side">
          <p className="viz-note">{cfg.note}</p>
          {isRot && (
            <>
              <label className="viz-ctl">
                <span>Show out to</span>
                <input type="range" min={1} max={8} step={1} value={reach} onChange={e => setReach(+e.target.value)} />
                <b>{reach}x</b>
              </label>
              {mode !== 'none' && (
                <label className="viz-ctl">
                  <span>Scale factor</span>
                  <input type="range" min={1} max={8} step={1} value={scale} onChange={e => setScale(+e.target.value)} />
                  <b>{scale}x</b>
                </label>
              )}
            </>
          )}
          <div className="viz-key">
            <span><i style={{ background: '#21506E', opacity: .85 }} />fast dimensions — fine local position</span>
            <span><i style={{ background: '#21506E', opacity: .3 }} />slow dimensions — coarse global position</span>
            {isRot && <span><i style={{ background: '#21506E', opacity: .07 }} />trained range</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
