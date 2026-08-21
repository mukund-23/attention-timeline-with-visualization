# Attention Timeline — Content (Phase 2)

Status: draft for review. Dates marked ○ are pending primary verification and must not ship until locked.
29 timeline entries, 2017-05-08 → 2025-12-13. Tier 1 = full page + bespoke visualizer. Tier 2 = card + shared visualizer.
Cross-references use names, not numbers, so entries can be cut or added without cascading edits.

Threads: `origins` · `position` · `sparsity` · `kv` · `context` · `recurrent` · `hardware`

**Evidence convention.** Every performance claim carries a provenance tag in the registry, surfaced in the UI as a small label on the entry:

- `independent` — replicated or measured outside the originating group
- `author-reported` — the originating paper's own numbers, no independent replication we are aware of
- `preliminary` — recent enough that the result should be treated as provisional

Claims tagged `author-reported` must be written with the source named in the sentence ("DeepSeek reports…", "on Moonshot's benchmarks…"), never as bare fact. This is a schema field rather than a writing habit so it survives future edits. Current `author-reported` entries: MLA, NSA, DSA, Gated DeltaNet, KDA. Current `preliminary`: DroPE.

---

## Chapter 0 — Prologue (outside the timeline)

Two things go here, before the timeline starts.

**The pre-history, in a paragraph.** Attention was not invented by the Transformer. Bahdanau, Cho and Bengio introduced it in September 2014 to fix a specific failure: encoder–decoder translation crushed an entire source sentence into one fixed-length vector, and quality collapsed as sentences got longer. Their fix was to let the decoder look back at every encoder state and score each one, so the context vector differed for every output token. Luong, Pham and Manning replaced that scoring network with a plain dot product in August 2015, making it a single matmul instead of an MLP. Both still rode on an RNN, so training stayed sequential. That is the setup: attention worked, and it was chained to something slow.

**Standard attention, explained properly.** The scaled dot-product mechanism gets its full treatment here, because nothing after it parses without it. It then appears again in place at 2017-06-12, where it belongs chronologically.

Framing line for the prologue: *Attention was never wrong. It was expensive. Everything after this is somebody looking at the bill.*

---

## The short path

A parallel route through the timeline for the reader who asked "how does attention work now" and wants five minutes, not an hour. Six entries, one visual each, three lines of prose each:

standard attention → RoPE → GQA → sliding window → FlashAttention → Gated DeltaNet

Same content, condensed. Toggle at the top of the page switches between short path and the full 29. This is the version you would actually send to a friend; the full timeline is the reference behind it.

---
## 1 — Learned Absolute Positional Embeddings
`2017-05-08` · Tier 2 · position · threads: position

> Also present in Gehring et al., *A Convolutional Encoder Model for NMT* (1611.02344, 2016-11-07), same group. We date the timeline to ConvS2S because that is the citation the field uses; the earlier appearance is recorded in SOURCES.

**Problem.** Drop recurrence and you drop the only thing telling the model what order the tokens were in. A convolutional or attention-based encoder sees a bag, not a sequence. Something has to carry order.

**Mechanism.** Give every position index its own embedding vector, learned like any other embedding, and add it to the token embedding. Position 7 has a vector; position 8 has a different one; the model works out what to do with them.

**Buys.** Trivial to implement. Fully learned, so no assumption about what positional structure should look like. Whatever the data wants, it gets.

**Costs.** Hard-capped at the maximum length seen in training — position 2049 has no embedding, so the model simply cannot run there. Positions are learned independently, so nothing forces position 7 and 8 to be more similar than 7 and 700; the model must learn adjacency from scratch. Parameter cost grows with context length. Rare long positions get few gradient updates and stay badly trained.

**Pick when.** Fixed, known, modest context. BERT-style encoders. Simplicity matters more than extrapolation.

**Avoid when.** You will ever want more context than you trained on — which, since 2023, is always.

**Lineage.** Into BERT and GPT, which made it the default for years. Displaced by RoPE. Its failure mode is the entire reason the PI, NTK-aware and YaRN entries exist.

---

## 2 — Scaled Dot-Product Attention / Multi-Head Attention
`2017-06-12` · Tier 1 · heatmap + KV · threads: origins, kv

**Problem.** By 2017 attention worked, but it rode on an RNN. Every token had to wait for the one before it, so training time scaled with sequence length and no amount of hardware fixed it. The bottleneck wasn't quality — the fixed-vector problem was already solved. It was that recurrence made scale unaffordable.

**Mechanism.** Project each token into a query, a key, and a value. Score every query against every key by dot product, divide by √d_k, softmax into weights, take the weighted sum of values. Run h of these in parallel with different projections and concatenate. The √d_k matters more than it looks: dot products grow with dimension, and without it the softmax saturates and gradients vanish.

**Buys**
- Fully parallel across the sequence — the whole point, and the thing that made scaling laws reachable
- Any token reaches any other in one hop, no path length penalty
- Exact. No approximation, no error to characterise
- Heads specialise without being told to

**Costs**
- O(N²) time *and* memory in sequence length
- No notion of order whatsoever — position has to be bolted on separately, which is why the entire position thread exists
- At inference the KV cache grows linearly with context and is re-read every decoded token, making generation memory-bandwidth bound rather than compute bound. A completely different bill from the quadratic one, and it goes unpaid until MQA
- Softmax forces every query to spend exactly one unit of attention mass, whether or not anything in the sequence is worth attending to

**Pick when.** Contexts under a few thousand tokens; training from scratch where quality dominates; anywhere you have FlashAttention kernels, which change this calculus substantially.

**Avoid when.** Long contexts on constrained memory; high-throughput serving where cache size sets your batch size.

**Lineage.** From the 2014–15 additive and dot-product attention of the prologue. Ancestor of everything after.

---

## 3 — Sinusoidal Positional Encoding
`2017-06-12` · Tier 1 · position · threads: position

**Problem.** Same paper, same need as the learned absolute positions entry, but the authors wanted something that might extrapolate past training length and wouldn't cost parameters.

**Mechanism.** No learning at all. Each dimension of the encoding is a sine or cosine of position at a different frequency, geometrically spaced from very fast to very slow. Read across dimensions and you get something like a binary encoding of position in continuous form. Because sin(a+b) and cos(a+b) expand into terms in a and b, any fixed offset k corresponds to a linear transform of the encoding — so relative position is in principle recoverable by a linear layer.

**Buys.** Zero parameters. Defined at every position, including ones never trained on, so it is at least *runnable* at any length. Structurally encodes both fine and coarse positional scale. Deterministic and reproducible.

**Costs.** Being defined at position 5000 is not the same as working there — in practice extrapolation is poor, and the Transformer authors' speculation that it would extrapolate did not hold up. The relative-position property is available to a linear layer but not enforced; the model has to learn to use it. Added to the token embedding, so positional and semantic information share the same vector space and compete for it. Empirically about on par with learned embeddings, which undercuts the elegance argument.

**Pick when.** Parameter budget is tight; you want determinism; you're teaching, because the structure is visible.

**Avoid when.** Long-context extrapolation is the goal. RoPE dominates on the same intuition, better executed.

**Lineage.** Same paper as (standard attention). The frequency-based idea is the direct ancestor of RoPE and, through it, of everything in the PI, NTK-aware and YaRN entries.

---

## 4 — Relative Position Representations
`2018-03-06` · Tier 1 · position + heatmap · threads: position

**Problem.** Absolute positions answer "where is this token?" But for most linguistic structure the useful question is "how far apart are these two tokens?" A verb three words after its subject is the same pattern whether it happens at position 5 or position 500, and absolute encodings force the model to learn that invariance separately at every offset.

**Mechanism.** Drop position from the input entirely. Instead, when computing attention between positions i and j, add a learned embedding indexed by the *relative* distance i−j. Clip distances beyond some k so the table stays finite and rare long distances don't need their own parameters.

**Buys.** Translation invariance is built in, not learned. Measurably better BLEU than absolute at the time. Positional information enters at the attention layer, where it is actually used, rather than being mixed into token semantics at the input.

**Costs.** Substantially slower — you now need a position-dependent term per (i, j) pair, which breaks the clean single matmul and needs custom gather operations. Memory grows with the relative-position table. The clipping distance k is a hyperparameter with real consequences: beyond k, all distances look identical, so the model genuinely cannot tell 60 tokens from 600. Notably, the paper found that combining relative *and* absolute gave no further gain, which quietly killed the idea that they were complementary.

**Pick when.** Structure matters more than absolute location; moderate contexts; you can afford the kernel work.

**Avoid when.** You need speed, or you need resolution beyond the clip distance.

**Lineage.** From (standard attention). Into Transformer-XL, which made the relative term efficient, and into T5's simplified learned-bucket bias — which is the direct conceptual predecessor of ALiBi, where the bias stops being learned at all. RoPE achieves the same relative property multiplicatively rather than additively.

---

## 5 — Transformer-XL / Segment-Level Recurrence
`2019-01-09` ○ · Tier 2 · recurrent state · threads: context, recurrent

**Problem.** Training a language model on long text means chopping it into fixed segments. Every segment boundary is a hard amnesia event: the model cannot see across it, and tokens at the start of a segment have no context at all. Dai et al. named this *context fragmentation*.

**Mechanism.** Cache the hidden states from the previous segment and let the current segment attend to them, with gradients stopped at the boundary. Context now extends beyond the segment without extending the attention window. Absolute positions break under this scheme — position 1 of segment 2 and position 1 of segment 3 would collide — so the paper also introduced an efficient relative encoding, which is arguably its more durable contribution.

**Buys.** Effective context far longer than the segment. No boundary amnesia. Much faster evaluation, because you advance one segment at a time instead of re-encoding a sliding window token by token.

**Costs.** Gradients don't flow across segments, so the model never directly learns to use very long dependencies — it only learns to use whatever the cache happens to contain. Memory grows with cache length. The recurrence is sequential across segments, reintroducing exactly the serialisation the Transformer was built to remove. Complex to implement correctly.

**Pick when.** Streaming or very long documents where a bounded window is acceptable and you want cheap evaluation.

**Avoid when.** You need true gradient-carrying long-range learning.

**Lineage.** From relative positions. Its cache idea reappears in StreamingLLM (sinks) and in every KV-cache-management system since.

---

## 6 — Sparse Transformer
`2019-04-23` ○ · Tier 1 · heatmap · threads: sparsity

**Problem.** The first serious attempt to state the quadratic problem as a problem. Generating images and audio autoregressively means sequences of tens of thousands of steps, and N² attention over 12,288 pixels is simply not payable. OpenAI needed long sequences for a generative model and there was no way to get them.

**Mechanism.** Replace the dense attention pattern with a fixed sparse one, factorised so that a small number of steps still connects any two positions. Two variants: *strided*, where one head attends locally and another attends to every k-th position; and *fixed*, where specific summary positions aggregate and rebroadcast. Cost drops to O(N√N). The paper also shipped the block-sparse GPU kernels without which none of it is fast.

**Buys.** First practical demonstration that a Transformer could handle sequences in the tens of thousands. Any-to-any connectivity preserved in two hops. Kernels released, so the savings were real rather than theoretical.

**Costs.** The pattern is fixed in advance and content-blind — it cannot notice that the token it needs is at an unattended position. Which factorisation to use is a per-domain guess: strided suits images with known row structure, fixed suits text, and getting it wrong is silently bad. Two-hop connectivity is weaker than one-hop; information degrades in the intermediate. Requires custom kernels, so it never became a drop-in.

**Pick when.** Structured data with known locality — images, audio, music. Very long sequences with predictable dependency patterns.

**Avoid when.** Dependencies are content-dependent and unpredictable, i.e. most language tasks.

**Lineage.** First entry in the sparsity thread. Into Longformer (sliding window), BigBird, and — after a five-year gap and a hardware-alignment rethink — NSA.

---

## 7 — Multi-Query Attention
`2019-11-06` · Tier 1 · KV memory · threads: kv

> Appeared 2019-11-06. Barely used until 2022–23 (PaLM, Falcon). A four-year gap, and the second-widest on the timeline.

**Problem.** Shazeer noticed a bill nobody else was itemising. Training attention is fast because it parallelises. *Decoding* is slow, and not because of flops — because every generated token requires re-reading the entire K and V tensors from memory. Generation is memory-bandwidth bound. The quadratic-cost crowd was optimising the wrong thing for inference.

**Mechanism.** Keep all h query heads. Collapse K and V to a single shared head. Every query head attends against the same keys and values. The KV cache shrinks by a factor of h.

**Buys.** Cache smaller by roughly the head count — often 8× to 64×. Decoding speeds up dramatically, because the bottleneck was bandwidth and you just removed most of the traffic. Larger batches fit, so throughput improves twice over. Trivial to implement.

**Costs.** Real quality degradation, which the paper is honest about. Heads lose the ability to attend to different subspaces of the sequence — they can still ask different questions, but they must all consult the same index. Training instability at scale was reported by later adopters. It is an architectural choice made at pretraining time; retrofitting was not solved until GQA. The quality loss is uneven across tasks and hardest to see in aggregate perplexity, which is exactly where you'd want to see it.

**Pick when.** Decode throughput dominates; memory-constrained serving; small models where cache is proportionally huge.

**Avoid when.** Quality is paramount and you have the memory. GQA is nearly always the better point on this curve.

**Lineage.** Opens the KV thread, four years before anyone else cared. Into GQA and MLA.

---

## 8 — Longformer / Sliding-Window Attention
`2020-04-10` ○ · adopted `2023-09-27` ○ · Tier 1 · heatmap · threads: sparsity, context

> Appeared 2020-04-10. Became standard 2023-09-27 with Mistral 7B. Three years and five months — the widest gap on the timeline.

**Problem.** BERT-era models capped at 512 tokens and long documents got truncated or chunked. Both lose information across the seam. The quadratic cost was the reason nobody just raised the cap.

**Mechanism.** Each token attends only to the *w* tokens nearest it. Cost becomes O(N·w), linear in sequence length. Stacking L layers gives an effective receptive field of roughly L·w, so distant tokens can still communicate — indirectly, through intermediate ones. Longformer added dilated windows and a handful of hand-chosen global tokens to shortcut this.

**Buys**
- Linear scaling in sequence length
- Drop-in: same architecture, different mask
- Receptive field grows with depth for free
- At inference the KV cache is *bounded* rather than growing. Mistral's motivation was this, not the training cost

**Costs**
- Information between distant tokens must hop through ⌈distance/w⌉ layers, degrading at every hop. Deep receptive field is not the same as direct access
- Needs custom kernels to realise the savings; a masked dense implementation is slower than dense attention
- Longformer's global tokens are chosen by hand per task, which doesn't generalise to a decoder-only LM
- In streaming decode, evicting tokens that fall out of the window destroys the model's output — a failure nobody explained until sinks, three years later

**Pick when.** Long documents where relevant context is genuinely local; memory-bound serving; as one branch of a hybrid design.

**Avoid when.** Exact long-range retrieval — needle-in-a-haystack tasks are where this fails most visibly; contexts short enough that full attention is affordable.

**Lineage.** From Sparse Transformer's local band. Into BigBird, sinks, NSA, and essentially every production long-context model.

---

## 9 — Linear Attention
`2020-06-29` ○ · Tier 1 · recurrent state · threads: recurrent

**Problem.** Everyone else was attacking the N² matrix by computing fewer of its entries. Katharopoulos et al. asked whether it needed to be computed at all.

**Mechanism.** Softmax attention is `softmax(QKᵀ)V`, and the softmax is what forces you to build the N×N matrix before multiplying by V. Replace it with a kernel feature map φ, so similarity is `φ(q)ᵀφ(k)`. Now associativity applies: compute `φ(K)ᵀV` first — a d×d matrix, independent of sequence length — then multiply by `φ(Q)`. Cost becomes O(N). Causally masked, this is exactly a recurrent network with a matrix-valued hidden state, updated by adding an outer product per token. The paper's title says it: transformers are RNNs.

**Buys.** Linear in sequence length for both time and memory. Constant-size state at inference — the cache does not grow with context at all. Genuinely unbounded context length. Reframes attention as memory, which turns out to be the more generative idea.

**Costs.** Quality drops, and not subtly. The fixed-size state is a hard information bottleneck: everything ever seen is summed into one d×d matrix, and old content is never removed, only diluted. Retrieval quality can degrade substantially as information accumulates in the fixed-size state; Schlag et al. formalised this eight months later as a capacity limit. The feature map φ is a design choice with no principled answer. Slower than dense attention at short lengths, since the crossover is in the thousands of tokens. And in 2020 the accuracy gap was large enough that almost nobody used it.

**Pick when.** Very long or streaming sequences; constant-memory inference is a hard requirement; as the cheap layer in a hybrid stack.

**Avoid when.** Exact retrieval matters. Pure linear attention still trails softmax attention on needle-in-a-haystack benchmarks, and the prominent 2025 models in this family are hybrids rather than pure recurrent stacks.

**Lineage.** The fork in the road. Into the delta rule, DeltaNet, Gated DeltaNet, KDA — and out of the timeline into the SSM literature. Its weakness is the problem every one of those descendants is solving.

---

## 10 — BigBird
`2020-07-28` ○ · Tier 2 · heatmap · threads: sparsity

**Problem.** Sliding windows are linear and local, but purely local attention has no guarantee it can represent what full attention can. Zaheer et al. wanted the efficiency with a theoretical backstop.

**Mechanism.** Three patterns combined: local windows, a few global tokens attending to and from everything, and — the novel part — *random* connections. Borrowing from random graph theory, sparse random edges make the attention graph an expander, giving short paths between any two nodes with high probability. The paper proves the result is a universal approximator of sequence functions and Turing complete.

**Buys.** Linear cost with theoretical guarantees rather than hope. Random edges give long-range paths without hand-designed structure. Strong results on long-document QA and summarisation; found real use in genomics.

**Costs.** The theory is asymptotic and needs more layers than the practical configuration uses, so the guarantee does not straightforwardly transfer to the deployed model. Random patterns are hostile to GPUs — scattered memory access is exactly what hardware punishes — so realised speedups lag the flop count badly. Three interacting mechanisms make it fiddly to tune. Decoder-only use is awkward, and it never displaced simple sliding windows in production.

**Pick when.** Long-document encoding where you want provable expressiveness.

**Avoid when.** Decoder-only generation; wall-clock speed matters more than flop count.

**Lineage.** From Sparse Transformer and Longformer (sliding window). Its lesson — that theoretically elegant sparsity can lose to hardware-friendly sparsity — is the premise NSA is built on.

---

## 11 — Performer / FAVOR+
`2020-09-30` ○ · Tier 2 · recurrent state · threads: recurrent, sparsity

**Problem.** Linear attention's arbitrary feature map bothered people. If φ is a guess, the resulting attention is some *other* operation, not an approximation of softmax with a known error. Choromanski et al. wanted linear cost while provably approximating actual softmax.

**Mechanism.** Softmax is a kernel, and kernels can be approximated by random features. FAVOR+ uses positive orthogonal random features to estimate the softmax kernel unbiasedly, then applies the same associativity trick as linear attention. The positivity matters — earlier trigonometric random features produced negative estimates and unstable training.

**Buys.** Linear time and space with an unbiased estimator and provable error bounds. Drops into a trained softmax model with limited fine-tuning. Rigorous where linear attention is heuristic.

**Costs.** Approximation error is provably bounded but not zero, and variance rises exactly where attention is sharpest — which is where it matters most. Needs many random features for acceptable accuracy, eating the speed advantage; at practical sequence lengths it is often no faster than dense attention. Sampling random features adds implementation surface. And it lost, empirically: this branch was largely abandoned once FlashAttention made exact attention fast enough that a bounded-error approximation stopped being worth it.

**Pick when.** Extremely long sequences where you need a formal error bound.

**Avoid when.** Almost always, now. Kept on this timeline because it is the best representative of the 2020 approximation wave — and because it is FlashAttention's opponent.

**Lineage.** From linear attention. Superseded in practice by (FlashAttention).

---

## 12 — Delta Rule / Fast Weight Programmers
`2021-02-22` · Tier 1 · recurrent state · threads: recurrent

**Problem.** Schlag, Irie and Schmidhuber diagnosed precisely what was wrong with linear attention. Its state update is `S ← S + vkᵀ` — pure addition. Write the same key twice with different values and both are in there, superimposed, forever. They formalised this as a capacity limit: once the number of stored associations exceeds the state's rank, retrieval degrades and there is no mechanism to do anything about it. They also pointed out that linear attention is mathematically identical to Schmidhuber's 1992 fast weight controllers, making this a thirty-year-old idea rediscovered.

**Mechanism.** Replace addition with the delta rule from Widrow–Hoff (1960). Before writing key k, *read* what is currently stored at k, and write only the difference: `S ← S + β(v − Sk)kᵀ`. Writing a key that already exists overwrites rather than superimposes. The model also learns β, a dynamic write strength — effectively a learned learning rate at inference time.

**Buys.** Removes the superposition failure directly. Massive improvement on associative recall, which is the exact task linear attention fails. Still O(N) and constant-memory. Gives the state a genuine *edit* operation, not just accumulate.

**Costs.** The update is inherently sequential — each step depends on reading the state the previous step wrote — so it does not parallelise across the sequence the way linear attention does. This made it slow to train and is the single reason it sat unused for three years. Still bounded capacity; delta rule manages the budget, it does not enlarge it. No forgetting: stale keys that are never rewritten stay forever. And in 2021 the results were on small models, so it read as a theory paper.

**Pick when.** Recall-heavy tasks under a constant-memory constraint.

**Avoid when.** You need training throughput and don't have the chunked parallel algorithm — which is to say, before 2024.

**Lineage.** From linear attention, and from Schmidhuber 1992. Into DeltaNet, which solved the parallelism problem, then Gated DeltaNet and KDA.

---

## 13 — Rotary Position Embeddings
`2021-04-20` · adopted `2023-02` ○ (LLaMA) · Tier 1 · position · threads: position, context

**Problem.** Absolute encodings are added to token vectors, mixing position into semantics and capping at training length. Relative encodings (relative positions) fix the semantics but are slow and clipped. Su et al. wanted the relative property with the cost of the absolute approach.

**Mechanism.** Don't add anything. *Rotate.* Treat each pair of dimensions in q and k as a 2-D plane and rotate it by an angle proportional to the token's position, with each pair rotating at a different frequency. Because a dot product between two rotated vectors depends only on the difference of their rotation angles, `⟨R_m q, R_n k⟩` is a function of m−n. Absolute rotations in, relative dependence out, for free, with no extra term in the attention computation.

**Buys.** Relative positioning with zero additional attention-time cost. No parameters. Position never contaminates the value vectors, only the query–key interaction. Attention decays gently with distance as an emergent property, not an imposed one. Compatible with linear attention, which additive relative biases are not. Defined at every position.

**Costs.** Extrapolation is *worse* than the elegance suggests — beyond training length, high-frequency dimensions have rotated into angular regions the model never saw, and quality collapses rather than degrading gracefully. This single failure mode generates the PI, NTK-aware and YaRN entries and arguably 31. The base frequency (usually 10000) is a hyperparameter with outsized effect that nobody tuned properly for years. It bakes in a recency bias that is right for language and wrong for some other modalities. And it interacts badly with KV compression — MLA needs a dedicated uncompressed slice purely to accommodate it.

**Pick when.** You need relative-position behaviour with no additional attention-time computation. This is the mechanism used by most modern decoder-only LMs.

**Avoid when.** You need extrapolation with no adaptation at all — ALiBi is more honest there.

**Lineage.** From sinusoidal and relative (relative positions). Into PI, NTK (NTK-aware), YaRN, MLA's carve-out (MLA), DroPE.

---

## 14 — Top-k Attention
`2021-06-13` · Tier 1 · heatmap · threads: sparsity

**Problem.** All sparsity to this point was decided in advance — by position, by pattern, by random draw. But attention distributions are empirically very peaked: most of the mass sits on a handful of tokens, and which tokens those are depends on the *content*, not the position. Fixed patterns cannot exploit that.

**Mechanism.** Compute the scores, keep only the k largest per query, zero the rest, renormalise. Because softmax weights decay fast, the top k captures nearly all the attention mass. The paper's contribution is doing this memory-efficiently — scores are computed in chunks and only the top k retained, so the full N×N matrix never materialises.

**Buys.** Content-dependent sparsity: the model attends to what matters rather than what is nearby. Provably close to full attention when the distribution is peaked, which it usually is. Memory savings without retraining. A clean knob — k — trading quality against cost.

**Costs.** You must compute all the scores to find the top k, so the *compute* cost stays O(N²) even though memory drops. This is the central limitation, and it is why the idea waited four years for a fix. Top-k selection is itself expensive and hostile to parallel hardware. Hard thresholding is discontinuous, so training with it is awkward; the paper leans toward inference-time use. And when attention genuinely is flat — which happens, particularly in early layers — truncating to k tokens discards real signal.

**Pick when.** Inference-time memory reduction on a trained model; long-context serving where attention is known to be peaked.

**Avoid when.** Training from scratch; early layers with diffuse attention.

**Lineage.** From sparse attention (Sparse Transformer). Into DSA, which is precisely this idea with a cheap learned scorer replacing the full score computation — the missing piece, four years later.

---

## 15 — ALiBi
`2021-08-27` · Tier 1 · position + heatmap · threads: position, context

**Problem.** Press et al. asked the question the Transformer paper had waved at and never answered: can a model trained on length L work at length 2L? They tested the existing options and found that none of them extrapolated — sinusoidal, learned, and rotary all degraded. Their diagnosis was that the problem is the positional *embedding* itself.

**Mechanism.** Delete positional embeddings entirely. Instead subtract a penalty from each attention score proportional to the distance between query and key: `score − m·|i−j|`, where m is a fixed per-head slope from a geometric sequence. Different heads get different slopes, so some are sharply local and others nearly global. Nothing is learned.

**Buys.** Extrapolates genuinely — train at 1024, run at 2048 or beyond with perplexity holding. Zero parameters. Trains 11% faster and uses 11% less memory than sinusoidal. Trivial to implement. Adding a bias to scores works with any attention implementation.

**Costs.** The linear recency penalty is a hard inductive bias, not a learned preference: distant tokens are penalised whether or not they matter. This makes ALiBi weaker on tasks requiring precise long-range retrieval, and later work found its "long context" is partly an illusion — it extrapolates perplexity well while not actually using the far context much. The slopes are hand-chosen and only weakly justified. It cannot express non-monotonic positional relationships at all. And it is incompatible with the KV-compression tricks that RoPE-based models use.

**Pick when.** Length extrapolation with no fine-tuning is the priority; streaming; perplexity-shaped workloads.

**Avoid when.** Long-range retrieval accuracy matters. Most frontier models chose RoPE plus a scaling method (21–23) over ALiBi, and that is the informative fact.

**Lineage.** From T5's relative position bias, which added a *learned* bias to scores — ALiBi's move is to stop learning it. From (relative positions). Conceptual sibling of NoPE and DroPE: all three argue that explicit position embeddings are the problem.

---

## 16 — FlashAttention
`2022-05-27` ○ · Tier 1 · IO diagram (bespoke) · threads: hardware

> **The odd one out.** Most entries on this timeline buy efficiency by giving up accuracy. This one does not — it returns the identical result. It pays elsewhere. See the callout below.

**Problem.** For five years the field had largely treated attention as compute-bound and attacked the flop count: sparsify it, approximate it, linearise it. Dao et al. profiled it and argued the binding constraint was memory bandwidth, not arithmetic. The expensive part is writing the N×N score matrix out to HBM and reading it back for the softmax and again for the value multiply. On that reading, flop reductions that leave the memory traffic intact would not translate into wall-clock speedups — which matched what several approximation methods had observed in practice.

**Mechanism.** Never materialise the N×N matrix. Tile Q, K and V into blocks that fit in on-chip SRAM and compute attention block by block, keeping a running softmax normaliser via the online-softmax trick so the result is exact despite never seeing a whole row at once. The backward pass recomputes scores from stored statistics rather than saving them — spending extra arithmetic to avoid memory traffic.

**Buys**
- Reported 2–4× speedups over standard implementations, increasing with sequence length
- Memory drops from O(N²) to O(N)
- **Exact.** The same attention result, not an approximation — no accuracy error to characterise or bound
- Longer contexts become affordable with no architectural change
- Drop-in: same model, same weights, same outputs

**Costs**
- Implementation complexity. This is kernel-level work, not a few lines of PyTorch
- Hardware-specific. Kernels must be rewritten for each GPU generation, which is why FlashAttention-2 and -3 exist; unsupported or older hardware gets nothing
- Extra arithmetic in the backward pass, since scores are recomputed rather than stored. Favourable on current hardware because memory is the scarcer resource, but it is a real trade and would invert on a machine with a different bandwidth-to-flops ratio
- Benefit varies with sequence length and hardware — at short lengths the gain is modest
- Version and framework dependence adds operational surface

> **Callout — a different kind of trade.**
> Read the timeline as a sequence of bills and this entry pays a different one. Reformer, Linformer, Performer and BigBird reduced cost by approximating attention, and paid in accuracy. FlashAttention reduces cost by restructuring the computation, and pays in engineering complexity and hardware coupling instead.
>
> Interest in the approximation methods declined over the following years. FlashAttention is plausibly part of that — when exact attention gets substantially faster, the case for accepting approximation error weakens — though model scale, context demand and kernel availability all changed over the same period, so this should be read as one factor rather than a demonstrated cause.
>
> The transferable lesson: before trading accuracy for cost, check which resource you are actually spending. A cost model that identifies the wrong bottleneck will send you optimising something that was never the constraint.

**Pick when.** Most training and inference workloads on supported hardware, particularly at longer sequence lengths where the gain is largest.

**Avoid when.** Unsupported or older hardware; environments where adding kernel dependencies is not acceptable.

**Lineage.** Independent of the sparsity and linear branches — it targets a different resource. Its arrival coincides with declining activity in the approximation branch, and its hardware-alignment argument is an explicit premise of NSA and DSA three years later.

## 17 — Grouped-Query Attention
`2023-05-22` · adopted `2023-07-18` ○ (Llama 2 70B) · Tier 1 · KV memory · threads: kv

**Problem.** MQA was four years old and had a known flaw — collapsing to one KV head costs quality and destabilises training. Meanwhile every existing model was MHA, and nobody wanted to retrain from scratch just to get faster inference. Two problems: the quality cliff, and the migration cost.

**Mechanism.** Interpolate. Divide h query heads into g groups; each group shares one KV head. g = h is MHA, g = 1 is MQA, and everything in between is available. Second contribution, arguably the more important one: *uptraining* — convert an existing MHA checkpoint by mean-pooling its KV heads into the target group count and fine-tuning for about 5% of original pretraining compute.

**Buys.** Most of MQA's speed with quality close to MHA. A tunable dial rather than a binary choice. Existing checkpoints can be converted cheaply, which lowered the barrier to adoption considerably. Trivial to implement. Training is more stable than MQA.

**Costs.** Still a real quality reduction versus MHA — smaller than MQA's, not zero. Query heads within a group are constrained to the same key/value subspace, so head diversity is genuinely reduced. Group count is another hyperparameter, and the papers give little guidance beyond "8 is fine." Grouping convention is fixed at training time and silently corrupts attention if served differently. And it is a crude compression: it discards KV heads outright rather than compressing what they contain, which is exactly the gap MLA exploits.

**Pick when.** You want most of MQA's decode speedup while keeping quality closer to MHA, or you need to convert an existing MHA checkpoint rather than retrain. It is the most common choice in current open-weight models.

**Avoid when.** You are training a very large model from scratch and inference economics dominate — then MLA is worth the complexity. Or contexts are short enough that the cache was never the bottleneck.

**Lineage.** From MQA. Into MLA and every hybrid since.

---

## 18 — NoPE (No Positional Encoding)
`2023-05-31` ○ · Tier 2 · position · threads: position

**Problem.** Every positional scheme since 2017 had been a design problem: which encoding, which frequencies, which biases. Kazemnejad et al. asked a question nobody had bothered to test properly — what happens if you use *none*?

**Mechanism.** Nothing. Remove positional encodings entirely from a decoder-only model. The causal mask alone is enough: because token i can only see tokens ≤ i, the number of visible tokens differs at every position, and the model can recover positional information from that asymmetry. The paper shows NoPE can implicitly represent both absolute and relative schemes.

**Buys.** Zero parameters, zero design decisions, zero implementation. Length generalisation on their benchmarks matched or beat explicit encodings. Removes the failure mode where a positional scheme's inductive bias is wrong for your data. Conceptually important: it proves explicit position encoding is not *necessary* in a causal model.

**Costs.** Only works with causal masking — encoders get nothing from this, since a bidirectional model genuinely cannot tell order without help. Results are on relatively small models and synthetic length-generalisation tasks, not frontier-scale pretraining. Implicit positional information is weaker and less precise than explicit rotation; tasks needing exact positional reasoning suffer. Nobody has trained a large production model this way, so the scaling behaviour is unknown. And the mechanism by which it works is not fully characterised, which makes failures hard to predict.

**Pick when.** Research on length generalisation; small causal models; when you suspect your positional bias is hurting you.

**Avoid when.** Encoders; precise positional tasks; production, for now.

**Lineage.** From ALiBi's argument (ALiBi) that embeddings are the problem, taken to its limit. The direct conceptual setup for DroPE — which is the same question asked about a *trained* model rather than an untrained one.

---

## 19 — Position Interpolation
`2023-06-27` · Tier 1 · position (shared frequency-stretch viz) · threads: position, context

**Problem.** LLaMA shipped with a 2048-token context and everyone immediately wanted more. Naive extrapolation — just feeding longer sequences — failed catastrophically, not gracefully: perplexity exploded within a few hundred tokens past the limit. Chen et al. diagnosed why. Beyond training length, RoPE's rotation angles enter regions never seen in training, and attention scores in that regime become unreliable.

**Mechanism.** Don't extrapolate — *interpolate*. Divide every position index by a scaling factor s, so position 4096 in a model trained to 2048 is presented as position 2048. All rotation angles stay inside the trained range. Then fine-tune briefly, on the order of a thousand steps.

**Buys.** Extends context 8× or more with minimal fine-tuning. Simple — one division. Theoretically motivated with an interpolation bound. Works on existing checkpoints, no retraining. Dramatically stabler than extrapolation.

**Costs.** Squashes *all* frequencies uniformly, including the high-frequency dimensions that encode fine local distance. Adjacent tokens become harder to distinguish, so local resolution degrades — and local structure is most of language. Performance on short sequences measurably drops after scaling, so you trade the common case for the rare one. Requires fine-tuning, so not free. And the scaling factor must be chosen in advance; the model does not adapt.

**Pick when.** Quick context extension with a fine-tuning budget and moderate scaling factors.

**Avoid when.** You cannot fine-tune, or short-context performance must be preserved. NTK (NTK-aware) and YaRN both exist because of this row's specific weakness.

**Lineage.** From RoPE. Directly provokes NTK-aware scaling (NTK-aware) two days later.

---

## 20 — NTK-Aware RoPE Scaling
`2023-06-29` · Tier 1 · position (shared) · threads: position, context

> **Not a paper.** A Reddit post by a pseudonymous user, `bloc97`, on r/LocalLLaMA. It became the default context-extension method in open-source LLMs for roughly six months before anything formal was written about it. Source: r/LocalLLaMA post `14lz7j5`. This is the messiest date on the timeline and the most honest one.

**Problem.** Two days after PI, someone spotted its flaw. Uniform interpolation destroys high-frequency information — the dimensions carrying fine local position get squashed exactly as hard as the slow ones carrying global position, and those are the dimensions that matter most for adjacent-token relationships.

**Mechanism.** Borrowing intuition from neural tangent kernel theory on how networks struggle to learn high-frequency functions: scale *non-uniformly*. Instead of dividing positions, change RoPE's base frequency, which stretches low-frequency dimensions a lot and high-frequency dimensions barely at all. Local resolution is preserved; the long-range dimensions absorb the extension.

**Buys.** Works with *no fine-tuning at all* — the property that made it explode in the open-source community. Preserves high-frequency detail, so short-context performance holds up far better than PI. One-line change to the base. Immediately usable on any existing RoPE checkpoint.

**Costs.** The NTK justification is intuition, not derivation — the name is more rigorous than the reasoning, and YaRN was written partly to give it a proper footing. Degrades at large scaling factors, worse than PI does past roughly 4×. Some dimensions still end up out of distribution because the treatment is smooth rather than targeted. No principled way to choose the new base; the community tuned it by trial. And its provenance means there was no peer review, no ablation, no error analysis — it worked, people used it, and the analysis came later.

**Pick when.** You need context extension right now with no fine-tuning and moderate scaling.

**Avoid when.** Large scaling factors; you want a method with a paper behind it.

**Lineage.** From PI, which it was written to fix. Into YaRN, which combines both and adds the missing rigour.

---

## 21 — YaRN
`2023-08-31` ○ · Tier 1 · position (shared) · threads: position, context

**Problem.** By August 2023 there were two context-extension methods, each with the other's strength. PI needed fine-tuning and wrecked local resolution. NTK-aware needed no fine-tuning but fell apart at large factors and had no theory. Peng et al. wanted one method that scaled far, cheaply, with a derivation.

**Mechanism.** Three ideas combined. *NTK-by-parts:* classify each RoPE dimension by whether its wavelength is shorter than the context — high-frequency dimensions that complete many rotations within the window are left alone, low-frequency ones are interpolated, and a ramp handles the middle. *Attention temperature:* scaling changes the entropy of the attention distribution, so YaRN adds a temperature correction on the logits, which turns out to matter a lot and is the least obvious contribution. *Dynamic scaling:* adjust the factor with the actual sequence length so short sequences are unaffected.

**Buys.** Extends context up to 128K. Needs roughly 10× fewer tokens and 2.5× fewer steps of fine-tuning than PI. Short-context performance essentially preserved thanks to dynamic scaling. The authors report strong results at large scaling factors. Offers a more principled formulation of the interpolation and frequency-scaling approach than its predecessors.

**Costs.** Three interacting mechanisms with several hyperparameters — considerably more to get wrong than PI's single division. Still needs some fine-tuning for the best results, so it is not free the way NTK-aware was. The attention temperature correction is empirically tuned rather than derived from first principles, so part of the method remains empirical. Extended context does not mean *effective* context — models scaled to 128K frequently fail retrieval well before that, and YaRN does not fix the underlying attention behaviour, only the positional encoding. Complexity has slowed adoption relative to plain NTK scaling.

**Pick when.** Serious long-context extension, 32K and beyond, with a fine-tuning budget.

**Avoid when.** Small extensions where PI or NTK suffices; no fine-tuning capacity; you value simplicity.

**Lineage.** From PI and NTK (NTK-aware), synthesising both. The maturation and effectively the end of the RoPE-extension line — after YaRN the field stops extending position and starts changing attention itself.

---

## 22 — Attention Sinks / StreamingLLM
`2023-09-29` ○ · Tier 1 · heatmap · threads: sparsity, context

**Problem.** For infinite streaming you want a fixed-size KV cache: keep the most recent tokens, evict the rest. Everyone had tried it. It fails immediately and bizarrely — perplexity explodes the moment the *first* few tokens are evicted, even though they are thousands of tokens in the past and obviously irrelevant to the current output.

**Mechanism.** Xiao et al. proposed an explanation: softmax forces attention weights to sum to one, so a head must allocate its full attention mass somewhere even when nothing is relevant, and models learn to place the excess on the first few tokens, which are visible to every query in a causal model. Those tokens are not carrying information — they are carrying *unwanted attention mass*. Evict them and the mass redistributes onto tokens that were never meant to receive it. The fix is almost trivial: keep the first four tokens permanently, plus a sliding window of recent ones.

**Buys.** Streaming over millions of tokens with constant memory. Up to 22× faster than sliding-window-with-recomputation. No fine-tuning, no retraining — four tokens pinned in the cache. It offers an explanation for the instability observed when early tokens are evicted from a streaming cache — a failure that had been encountered but not accounted for. The term "attention sink" subsequently entered general use.

**Costs.** It does not extend context — the model still cannot use information outside the window. It maintains fluency over infinite streams, which is a different and much weaker claim than long-context understanding, and this distinction is routinely misread. Everything evicted is gone permanently; there is no retrieval. The number of sink tokens is empirical. One reading is that sinks arise partly from softmax's normalisation behaviour — attention weights must sum to one, so a head has no way to decline to attend — which would make pinning tokens a workaround rather than a fix. That interpretation is plausible but not settled.

**Pick when.** Infinite streaming — long-running chat, live transcription — where recent context is what matters.

**Avoid when.** Retrieval from distant context. Streaming is not long-context.

**Lineage.** From sliding window, whose failure it explains. Sinks are now standard in production long-context serving and appear inside NSA and DSA.

---

## 23 — Multi-head Latent Attention
`2024-05-07` · Tier 1 · KV memory · threads: kv

**Problem.** By early 2024, GQA had become universal and the KV cache was *still* the binding constraint — 128K contexts meant the cache exceeded the weights. And GQA buys its savings the crude way: by deleting head diversity in K and V outright.

**Mechanism.** Instead of sharing KV heads, compress keys and values jointly into a low-rank latent vector per token. Cache the latent. Re-expand during attention via learned up-projections, which fold into the surrounding weight matrices so there's no runtime cost. RoPE gets a separate carve-out: rotation doesn't commute with the up-projection, so a slice of dimensions carries position uncompressed.

**Buys**
- DeepSeek reports a cache far smaller than GQA at comparable or better quality
- Compression is learned rather than imposed, so the model chooses what to keep
- Up-projections absorb into adjacent weights — the saving is not paid back in compute

**Costs**
- Materially harder to implement than GQA, which is a dozen lines
- The decoupled-RoPE carve-out is an admitted wart, not an elegance: position rides in a separate uncompressed slice because the maths doesn't otherwise work
- No cheap conversion path. GQA can be retrofitted onto an MHA checkpoint by mean-pooling for ~5% of pretraining compute; MLA has no equivalent, so it's a from-scratch decision
- Thinner kernel and framework support than GQA
- The quality-above-MHA claim comes principally from one lab's own ablations at their own scale. Plausible, partially reproduced, but not the evidence base GQA has

**Pick when.** Training a large model from scratch where inference economics dominate the lifetime cost; long-context serving at scale; you have kernel engineers.

**Avoid when.** Adapting an existing checkpoint; small teams; short-context workloads where the cache was never the bottleneck. For most people GQA remains the right answer, which is a useful thing for the app to say out loud.

**Lineage.** From MQA → GQA. Alongside it, DSA attacks the same bill from a different direction — fewer tokens rather than smaller per-token state.

---

## 24 — DeltaNet (parallelized)
`2024-06-10` ○ · Tier 2 · recurrent state · threads: recurrent

**Problem.** The delta rule had been sitting unused for three years for one reason: its update is sequential. Each step reads the state the previous step wrote, so it cannot be parallelised across the sequence the way linear attention can, and on modern hardware an algorithm that cannot saturate a GPU does not get trained at scale regardless of its merits.

**Mechanism.** Yang et al. reformulated the delta-rule update using the WY representation from Householder transformations, which lets a chunk of sequential rank-one updates be expressed as matrix operations over the whole chunk. Process the sequence in chunks: parallel within a chunk, sequential across chunks. Training throughput becomes competitive with linear attention while preserving the delta rule's semantics exactly.

**Buys.** Makes the delta rule trainable at scale — this is the unlock, not a new capability. Strong on associative recall and in-context retrieval, where linear attention and Mamba both struggle. Still O(N) with constant-size inference state. Hybrid variants match or beat comparable Transformers on several benchmarks.

**Costs.** Chunked parallelism is not full parallelism — throughput still trails softmax attention with FlashAttention kernels. Capacity remains bounded; the delta rule manages a fixed budget rather than growing it. No forgetting mechanism: keys never rewritten persist forever, which is what the Gated DeltaNet entry addresses six months later. Implementation is significantly harder than linear attention. And the strong results are largely hybrid results, which quietly concedes that pure recurrence still isn't enough.

**Pick when.** Long-context with constant-memory inference where recall matters; as the linear component of a hybrid stack.

**Avoid when.** Short contexts; you need maximum training throughput.

**Lineage.** From the delta rule and linear attention. Into Gated DeltaNet and KDA.

---

## 25 — Gated DeltaNet
`2024-12-09` · adopted `2025-09` ○ (Qwen3-Next) · Tier 1 · recurrent state · threads: recurrent

**Problem.** Two families had each solved half the memory problem. Mamba2 has a *gate* — it can decay the whole state, forgetting old information to make room — but its update is additive, so it cannot correct a specific stored association. DeltaNet has *precision* — targeted overwrite via the delta rule — but no decay, so irrelevant keys accumulate forever. Yang, Kautz and Hatamizadeh observed these are complementary, not competing.

**Mechanism.** Combine both in one update: `S ← α(S + β(v − Sk)kᵀ)`, where α is a data-dependent decay gate and β the delta-rule write strength. Two independent controls — how much of everything to forget, and how much of this specific association to correct. The chunked parallel algorithm from (DeltaNet) is extended to cover the gated form.

**Buys.** The authors report improvements over both Mamba2 and DeltaNet across language-modelling, recall and long-context benchmarks. Selective erasure plus selective correction, which no prior recurrent model had together. Still linear time and constant-memory inference. The paper reports hybrid stacks reaching parity with Transformers at a fraction of the KV cost.

**Costs.** Gating adds parameters and computation to an already complex update. Two coupled controls are harder to optimise than one and can interact in ways that are hard to debug. Fixed-size state is still fixed — better management, same budget, and it remains behind full attention on hard retrieval. Best results are hybrid, so this is a component, not a replacement. Kernel support is thin outside a few implementations. And α and β are coupled in the update, which is exactly the limitation GDN-2 unpicks eighteen months later.

**Pick when.** Long-context efficiency at scale; the linear layers of a hybrid model; constant-memory inference with recall requirements.

**Avoid when.** You need exact retrieval over very long context, or you want mature tooling.

**Lineage.** From DeltaNet and Mamba2. Into KDA and Gated DeltaNet-2, which is where the closing section picks up.

---

## 26 — Native Sparse Attention
`2025-02-16` · Tier 1 · heatmap · threads: sparsity, hardware

**Problem.** Sparse attention had been around since 2019 and none of it was used in frontier models. Yuan et al. named two reasons. First, most sparse methods are applied only at inference to a densely-trained model, so the model was never trained to work sparsely and the mismatch costs accuracy. Second — the FlashAttention lesson, learned again — theoretical flop reduction does not survive contact with the memory hierarchy; irregular access patterns leave GPUs idle.

**Mechanism.** Three branches per query, combined by a learned gate. *Compression:* coarse-grained blocks of tokens are summarised into single representations, giving cheap global coverage. *Selection:* the most relevant fine-grained blocks are retained at full resolution, chosen by scores derived from the compression branch. *Sliding window:* recent tokens, always. Everything operates on *blocks* rather than individual tokens, because contiguous blocks are what GPUs read efficiently — the sparsity pattern is designed around the hardware rather than the mathematics. And it is trainable end to end, so the model learns with sparsity present.

**Buys.** Reported speedups in decoding and in both forward and backward passes, not only flop-count reductions. The authors report matching or exceeding full attention on general, long-context and reasoning benchmarks. Native training removes the train/inference mismatch. The three branches cover genuinely different needs.

**Costs.** Must be trained in from the start; no retrofit path for existing checkpoints, which is a serious adoption barrier. Three branches plus a gate is a lot of moving parts and a lot of hyperparameters. Block granularity is a hard floor on precision — a single critical token in an unselected block is invisible. Kernels are hardware-specific and were tuned for particular GPUs. Results come from one lab at one scale.

**Pick when.** Training a long-context model from scratch where inference cost dominates.

**Avoid when.** Adapting an existing model; small teams without kernel engineers.

**Lineage.** From Sparse Transformer, sliding window, top-k, sinks — and philosophically from FlashAttention, whose lesson about hardware alignment is the premise. Alongside DSA.

---

## 27 — DeepSeek Sparse Attention
`2025-09-29` · Tier 1 · heatmap + KV · threads: sparsity, kv

> Shipped in DeepSeek-V3.2-Exp. Release date used per the dating rule's artifact fallback; technical report followed.

**Problem.** NSA required training from scratch. DeepSeek wanted the same sparsity benefit on an existing V3.1 checkpoint, and wanted it to attack the KV bill as well as the compute bill. Meanwhile top-k attention (top-k) had had the right idea since 2021 with one fatal flaw: finding the top k required computing all N scores, so compute stayed quadratic.

**Mechanism.** Add a *lightning indexer* — a small, cheap scoring network that estimates the relevance of every previous token to the current query at a fraction of the cost of full attention. Take the top k by that estimate, run full attention over only those. Fine-grained token selection rather than blocks. Trained in two stages onto the existing checkpoint: first the indexer alone against the dense model's own attention distribution, then the whole model with sparsity active.

**Buys.** Solves top-k's four-year-old problem — approximate scoring makes content-dependent sparsity affordable at last. Retrofittable onto a trained model, which NSA is not. DeepSeek reports large inference cost reductions at long context and cut API prices following the release. The company reports benchmark parity with its dense baseline. Token-level rather than block-level, so no block-granularity floor.

**Costs.** The indexer is an approximation and can miss relevant tokens — a cheap scorer is exactly the kind of thing that fails on adversarial or unusual inputs, and the failure is silent. Two-stage training is complex and depends on having the dense model to distill from. k is a fixed budget; genuinely diffuse attention gets truncated. Adds a component that must itself be trained, tuned and served. Evidence is one lab's own reporting on its own model. And it is entangled with MLA — the design assumes DeepSeek's KV architecture, so it is not straightforwardly portable.

**Pick when.** Long-context inference cost dominates and you have a trained model to adapt.

**Avoid when.** Short contexts; you need worst-case guarantees rather than average-case speed.

**Lineage.** Top-k attention (top-k) with the missing piece supplied. Alongside NSA, attacking the same bill from the retrofit side. Built on MLA.

---

## 28 — KDA / Kimi Linear
`2025-10-30` · Tier 2 · recurrent state · threads: recurrent, kv

**Problem.** The gated delta line worked, but its forgetting gate is coarse — a scalar decay applied to the whole state. Different feature channels hold different kinds of information with different useful lifetimes, and a single scalar cannot express that. Moonshot also wanted to demonstrate the linear branch at genuine production scale, which nobody had.

**Mechanism.** Kimi Delta Attention refines Gated DeltaNet's gating to be *channel-wise* — a fine-grained diagonal gate rather than a scalar, so each dimension of the state decays at its own learned rate. Deployed in a hybrid stack with a 3:1 ratio of KDA layers to full-attention layers, with the full-attention layers carrying exact retrieval.

**Buys.** A reported ~75% KV cache reduction versus full attention, with large decoding throughput gains at long context. On Moonshot's reported benchmarks it outperforms full attention — notable because linear methods have historically been positioned as an acceptable compromise rather than an improvement. Channel-wise gating is a real expressiveness gain over scalar decay. The method was evaluated in a deployed model rather than only as an isolated research component.

**Costs.** The result is a *hybrid* — a quarter of the layers are still full attention, which is a concession that pure linear attention remains insufficient. The 3:1 ratio is empirical and probably task-dependent. Fine-grained gating adds parameters and complexity to an already intricate update. Custom kernels required. Single-lab evaluation of its own model.

**Pick when.** Long-context production serving where KV cost dominates and you can train a hybrid.

**Avoid when.** You need mature tooling, or exact retrieval throughout the stack.

**Lineage.** From Gated DeltaNet. Sibling of the Qwen3-Next hybrids. Into Gated DeltaNet-2.

---

## 29 — DroPE
`2025-12-13` · Tier 1 · position · threads: position, context

**Problem.** Eight years of positional engineering — absolute, sinusoidal, relative, rotary, then four separate schemes for stretching rotary further. Every one of them is a workaround for the fact that the encoding was fixed at training time and does not fit the length you now want. Nobody had asked whether a *trained* model still needs its positional embeddings at all.

**Mechanism.** Drop them. Remove RoPE after training, with adaptation, and let the causal mask carry positional information the way NoPE showed it can in an untrained model. What NoPE established for training from scratch, DroPE asks of an existing checkpoint.

**Buys.** Removes the positional-encoding extrapolation problem rather than extending the encoding — no out-of-distribution rotation angles, no scaling factor to choose. Sidesteps the entire PI/NTK/YaRN apparatus. Conceptually clean, and a genuinely surprising result: the thing every model has carried since 2017 turns out to be removable.

**Costs.** Very new — December 2025 — with limited independent replication, and everything below should be read against that. Requires an adaptation procedure, so it is not free. Implicit positional information is weaker than explicit rotation, so precise positional reasoning is the natural place for it to fail, and that is not yet well characterised. Causal-only, like NoPE. No production deployment at frontier scale that we can point to. Whether it holds across model sizes and tasks is open.

**Pick when.** Research; length-generalisation work; you are prepared to validate it yourself.

**Avoid when.** Production, today. This is the frontier, not the default.

**Lineage.** From RoPE, whose failure mode motivates it, and from NoPE, whose argument it extends to trained models. The endpoint of the position thread — and the timeline's ending, because after eight years of adding machinery the most interesting recent move is subtraction.

---

# Closing section

## The arc

Six framings, in the instructor's own terms and ours.

**It wanted exactness (2014–2019).** Attention arrives, becomes self-attention, becomes the whole architecture. Nobody is economising yet. The costs are being discovered, not paid.

**It wanted cheapness (2019–2021).** The quadratic bill arrives and everything attacks it — sparse patterns, low-rank projection, random features, kernel tricks. All approximate. All pay in accuracy.

**It wanted exactness back (2022).** FlashAttention shows the bill was being misread. The argued constraint was memory traffic rather than flops, and restructuring the computation cut it while keeping the result exact — paying in kernel complexity and hardware coupling instead of accuracy. Activity in the approximation line drops off over the following years.

**It wanted length (2023).** RoPE is everywhere, and RoPE breaks past its training length. PI, NTK, YaRN in a four-month sprint. Sinks explain why streaming failed. This is the year of stretching what exists.

**It wanted memory back (2019, 2024–2025).** The KV cache becomes the binding constraint. MQA had been waiting since 2019; GQA makes it usable; MLA compresses instead of discarding. In parallel the recurrent branch — dormant since 2020 — returns with the delta rule made parallel, then gated, then channel-wise gated.

**It wanted sparsity back, done properly (2025–).** NSA and DSA revive 2019 ideas with hardware alignment and learned selection. Simultaneously DroPE asks whether the positional apparatus is needed at all.

**One sentence:** attention was never replaced because it was wrong; each generation found a different line on the bill — compute, bandwidth, cache, context, retention — and traded something to shrink it. Except once, when someone read the bill properly and found a charge that did not need paying at all.

## What comes next — the retrospective game

Not a forecast. The reader stands at a point on the timeline, sees only what existed by then, and predicts the next move. Then the app reveals what actually happened.

Proposed vantage points:

- **Stand at mid-2020.** Sparse, Linformer, linear, BigBird all exist. Everyone is approximating. *What's the next move?* — Answer: stop approximating, fix the memory hierarchy. Almost nobody saw it.
- **Stand at late 2019.** MQA has just been published and is ignored. *What's the next move?* — Answer: nothing, for four years, until models got big enough that inference economics mattered more than training economics.
- **Stand at June 2023.** PI has just landed. *What's the next move?* — Answer: two days later, someone on Reddit fixes its main flaw without a paper.
- **Stand at early 2021.** The delta rule has just been formalised and is unusable because it's sequential. *What's the next move?* — Answer: three years of silence, then a reformulation that makes it parallel.
- **Stand at late 2022.** FlashAttention has made dense attention fast. *What's the next move?* — Answer: sparsity does not die; it comes back three years later rebuilt around the same hardware lesson.

The pattern the reader should extract: **the gap between an idea appearing and an idea mattering is usually years, and it closes when some other constraint changes** — model size, context demand, or hardware. Not when the idea gets better.

## Where it's heading

Not speculation — the frontier as it currently stands, with sources.

Gated DeltaNet-2 (2026-05-21, arXiv 2605.22791) decouples the erase and write operations that Gated DeltaNet coupled, generalising both GDN and KDA. The direction of the recurrent branch over eighteen months is unmistakable: progressively finer-grained control over a fixed-size state. Scalar decay, then channel-wise decay, then decoupled erase and write.

Meanwhile every strong 2025–26 linear model is a *hybrid*, which is the field conceding that a fixed state cannot do exact retrieval and hedging accordingly. The live question is not whether attention gets replaced but what the ratio should be, and whether the ratio should be learned.

