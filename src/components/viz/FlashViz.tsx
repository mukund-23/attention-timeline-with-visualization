import { useState } from 'react'
import { COLORS } from '../../colors'

const D = 64, SRAM_KB = 192

export default function FlashViz() {
  const [nK, setNK] = useState(8)
  const N = nK * 1024
  const standard = 2 * N * N * 2 + 4 * N * D * 2
  const M = SRAM_KB * 1024
  const tiled = (4 * N * D * 2) * Math.max(1, (N * D * 2) / M) * 0.5 + 4 * N * D * 2
  const ratio = standard / tiled
  const fmt = (b: number) => b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.round(b / 1e6)} MB`
  const barW = (v: number) => Math.max(2, (v / standard) * 250)

  return (
    <div className="viz">
      <div className="viz-head">
        <span className="viz-title">Bytes moved between HBM and on-chip SRAM</span>
        <span className="viz-stat">at {nK}K tokens: <b>{ratio.toFixed(1)}x</b> less traffic</span>
      </div>
      <div className="viz-body">
        <svg width={330} height={190} viewBox="0 0 330 190" role="img"
          aria-label="Comparison of HBM traffic between standard and tiled attention">
          <rect x={10} y={14} width={130} height={68} fill="none" stroke={COLORS.rule} strokeWidth={0.5} />
          <text x={75} y={34} fontSize={10} fontFamily="monospace" fill={COLORS.muted} textAnchor="middle">HBM — large, slow</text>
          <rect x={30} y={44} width={90} height={26} fill={COLORS.cost} opacity={0.55} />
          <text x={75} y={61} fontSize={9.5} fontFamily="monospace" fill={COLORS.white} textAnchor="middle">N x N scores</text>

          <rect x={190} y={14} width={130} height={68} fill="none" stroke={COLORS.rule} strokeWidth={0.5} />
          <text x={255} y={34} fontSize={10} fontFamily="monospace" fill={COLORS.muted} textAnchor="middle">SRAM — small, fast</text>
          <rect x={228} y={44} width={54} height={26} fill={COLORS.keep} opacity={0.75} />
          <text x={255} y={61} fontSize={9.5} fontFamily="monospace" fill={COLORS.white} textAnchor="middle">one tile</text>

          <text x={10} y={108} fontSize={10} fontFamily="monospace" fill={COLORS.muted}>standard</text>
          <rect x={72} y={98} width={250} height={13} fill={COLORS.cost} opacity={0.7} />
          <text x={72} y={124} fontSize={9.5} fontFamily="monospace" fill={COLORS.faint}>{fmt(standard)}</text>

          <text x={10} y={150} fontSize={10} fontFamily="monospace" fill={COLORS.muted}>tiled</text>
          <rect x={72} y={140} width={barW(tiled)} height={13} fill={COLORS.keep} opacity={0.8} />
          <text x={72} y={166} fontSize={9.5} fontFamily="monospace" fill={COLORS.faint}>{fmt(tiled)}</text>

          <text x={10} y={185} fontSize={9.5} fontFamily="monospace" fill={COLORS.faint}>identical output in both cases</text>
        </svg>
        <div className="viz-side">
          <p className="viz-note">
            The standard implementation writes the whole score matrix out to HBM and reads it back
            twice — once for the softmax, once for the value multiply. Tiling keeps blocks in SRAM and
            never materialises the matrix, using a running softmax normaliser so the result stays exact.
            Nothing is approximated; the same numbers come out.
          </p>
          <label className="viz-ctl">
            <span>Sequence</span>
            <input type="range" min={1} max={64} step={1} value={nK} onChange={e => setNK(+e.target.value)} />
            <b>{nK}K</b>
          </label>
          <p className="viz-fine">
            Simplified traffic model: head dim {D}, fp16, {SRAM_KB}KB SRAM. It shows the scaling
            relationship — standard traffic grows with N squared, tiled traffic close to linear — not
            a benchmark of any specific kernel.
          </p>
        </div>
      </div>
    </div>
  )
}
