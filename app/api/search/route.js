// app/api/search/route.js
import fs from 'node:fs/promises'
import path from 'node:path'

async function loadMock() {
  const file = path.join(process.cwd(), 'public', 'mock.json')
  const raw = await fs.readFile(file, 'utf8')
  return JSON.parse(raw)
}

function parseQuery(q = '') {
  const text = (q || '').toLowerCase()
  const distrito =
    /miraflores/.test(text) ? 'miraflores' :
    /surco/.test(text) ? 'surco' : null

  const habMatch = text.match(/(\d+)\s*(hab|habitaciones?)/)
  const hab = habMatch ? Number(habMatch[1]) : null

  const mar = /mar|vista al mar|oc[eé]ano/.test(text)
  return { distrito, hab, mar }
}

function applyFilters(rows, q) {
  const { distrito, hab, mar } = parseQuery(q)
  let out = rows
  if (distrito) out = out.filter(r => (r.direccion || '').toLowerCase().includes(distrito))
  if (hab) out = out.filter(r => (r.habitaciones || 0) >= hab)
  if (mar) out = out.filter(r => (r.titulo + ' ' + (r.direccion || '')).toLowerCase().includes('mar'))
  return out
}

export async function GET(req) {
  try {
    const url = new URL(req.url)
    const q = url.searchParams.get('q') || ''
    const data = await loadMock()
    const items = applyFilters(data, q)
    return new Response(JSON.stringify({ ok: true, items }), {
      headers: { 'content-type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'error' }), { status: 500 })
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}))
    const q = body?.q || ''
    const data = await loadMock()
    const items = applyFilters(data, q)
    return new Response(JSON.stringify({ ok: true, items }), {
      headers: { 'content-type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'error' }), { status: 500 })
  }
}
