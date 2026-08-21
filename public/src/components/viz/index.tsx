import MaskViz from './MaskViz'
import PositionViz from './PositionViz'
import KVViz from './KVViz'
import RecurrentViz from './RecurrentViz'
import FlashViz from './FlashViz'
import type { Entry } from '../../types'

const MASK = new Set(['scaled-dot-product-attention', 'sparse-transformer', 'longformer',
  'bigbird', 'top-k-attention', 'attention-sinks', 'native-sparse-attention',
  'deepseek-sparse-attention'])
const POSITION = new Set(['learned-absolute-positional-embeddings', 'sinusoidal-positional-encoding',
  'relative-position-representations', 'rotary-position-embeddings', 'position-interpolation',
  'ntk-aware-rope-scaling', 'yarn', 'alibi', 'nope-no-positional-encoding', 'drope'])
const KV = new Set(['scaled-dot-product-attention', 'multi-query-attention',
  'grouped-query-attention', 'multi-head-latent-attention'])
const RECURRENT = new Set(['linear-attention', 'performer', 'transformer-xl', 'delta-rule',
  'deltanet-parallelized', 'gated-deltanet', 'kda'])

export default function Viz({ e }: { e: Entry }) {
  const out = []
  if (e.id === 'flashattention') out.push(<FlashViz key="flash" />)
  if (POSITION.has(e.id)) out.push(<PositionViz key="pos" entryId={e.id} />)
  if (MASK.has(e.id)) out.push(<MaskViz key="mask" entryId={e.id} />)
  if (KV.has(e.id)) out.push(<KVViz key="kv" entryId={e.id} />)
  if (RECURRENT.has(e.id)) out.push(<RecurrentViz key="rec" entryId={e.id} />)
  return out.length ? <>{out}</> : null
}
