// lib/fetchHtml.js
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121 Safari/537.36'
const ACCEPT_LANG = 'es-PE,es;q=0.9,en;q=0.8'
const SCRAPEIT_KEY = process.env.SCRAPEIT_KEY

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)) }

async function fetchDirect(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept-Language': ACCEPT_LANG,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Upgrade-Insecure-Requests': '1'
    }
  }).catch(()=>null)
  if (!res || !res.ok) return null
  return await res.text().catch(()=>null)
}

async function fetchViaScrapeIt(url) {
  if (!SCRAPEIT_KEY) return null
  const api = `https://api.scrape-it.cloud/scrape?api_key=${encodeURIComponent(SCRAPEIT_KEY)}&url=${encodeURIComponent(url)}`
  const res = await fetch(api, { headers: { 'Accept': 'application/json' } }).catch(()=>null)
  if (!res || !res.ok) return null
  const json = await res.json().catch(()=>null)
  // API devuelve { content: "<html>..." }
  return json?.content || null
}

export async function fetchHtmlSmart(url, { tries=3, delay=600 } = {}) {
  for (let i=0; i<tries; i++) {
    // 1) Proxy si hay key
    const viaProxy = await fetchViaScrapeIt(url)
    if (viaProxy && viaProxy.includes('<html')) return viaProxy

    // 2) Directo
    const direct = await fetchDirect(url)
    if (direct && direct.includes('<html')) return direct

    await sleep(delay * (i+1))
  }
  return null
}
