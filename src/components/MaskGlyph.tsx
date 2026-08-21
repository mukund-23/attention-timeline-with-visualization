import { COLORS } from '../colors'

const N = 7

function pattern(id: string): (i: number, j: number) => number {
  const dense = (i: number, j: number) => (j <= i ? 1 : 0)
  switch (id) {
    case 'longformer':
      return (i, j) => (j <= i && i - j < 2 ? 1 : 0)
    case 'attention-sinks':
      return (i, j) => (j <= i && (j === 0 || i - j < 2) ? 1 : 0)
    case 'sparse-transformer':
      return (i, j) => (j <= i && (i - j < 1 || j % 3 === 0) ? 1 : 0)
    case 'bigbird':
      return (i, j) => (j <= i && (i - j < 1 || j === 0 || (i * 3 + j * 5) % 7 === 0) ? 1 : 0)
    case 'top-k-attention':
      return (i, j) => (j <= i && ((i * 5 + j * 3) % 4 < 2 || i - j < 1) ? 1 : 0)
    case 'native-sparse-attention':
      return (i, j) => {
        if (j > i) return 0
        const bi = Math.floor(i / 2), bj = Math.floor(j / 2)
        return bi === bj || bj === 0 ? 1 : 0
      }
    case 'deepseek-sparse-attention':
      return (i, j) => (j <= i && ((i * 7 + j * 11) % 5 < 2 || i - j < 1) ? 1 : 0)
    case 'alibi':
      return (i, j) => (j <= i ? Math.max(0.18, 1 - (i - j) * 0.28) : 0)
    case 'relative-position-representations':
      return (i, j) => (j <= i ? (i - j) % 2 === 0 ? 0.85 : 0.4 : 0)
    case 'linear-attention': case 'delta-rule': case 'deltanet-parallelized':
    case 'gated-deltanet': case 'kda': case 'performer': case 'transformer-xl':
      return (i, j) => (j <= i ? 0.55 : 0)
    case 'multi-query-attention':
      return (i, j) => (j <= i ? (j === 0 ? 1 : 0.3) : 0)
    case 'grouped-query-attention':
      return (i, j) => (j <= i ? (j % 3 === 0 ? 1 : 0.35) : 0)
    case 'multi-head-latent-attention':
      return (i, j) => (j <= i ? (j < 3 ? 0.95 : 0.3) : 0)
    default:
      return dense
  }
}

export default function MaskGlyph({ id, label }: { id: string; label: string }) {
  const f = pattern(id)
  const cells = []
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const v = f(i, j)
      cells.push(
        <rect key={`${i}-${j}`} x={j * 6} y={i * 6} width={5} height={5}
          fill={v > 0 ? COLORS.keep : 'none'}
          stroke={v > 0 ? 'none' : COLORS.ruleSoft} strokeWidth={0.5}
          opacity={v > 0 ? v : 1} />
      )
    }
  }
  return (
    <svg className="glyph" width={42} height={42} viewBox="0 0 41 41" role="img" aria-label={`Attention pattern for ${label}`}>
      {cells}
    </svg>
  )
}
