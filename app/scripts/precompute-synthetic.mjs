// Computes MiniLM-L6 embeddings for the synthetic transcripts (Node, no GPU).
// Run: npm run precompute:demo
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { pipeline, env } from '@xenova/transformers'

env.allowLocalModels = false

const here = dirname(fileURLToPath(import.meta.url))
const srcPath = join(here, '../src/data/synthetic-source.json')
const outPath = join(here, '../src/data/synthetic-memory.json')

const source = JSON.parse(readFileSync(srcPath, 'utf8'))
const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')

const out = []
for (const item of source) {
  const t = await extractor(item.transcript, { pooling: 'mean', normalize: true })
  out.push({ ...item, embedding: Array.from(t.data) })
}

writeFileSync(outPath, JSON.stringify(out, null, 2))
console.log(`Wrote ${out.length} embedded memories (dim ${out[0].embedding.length}) to ${outPath}`)
