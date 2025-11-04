// lib/scrape/fetch.js
const UA = 'Mozilla/5.0 (compatible; B369AI/1.0; +https://b369-ai.netlify.app)'
const delay = (ms)=>new Promise(r=>setTimeout(r,ms))

export async function politeGet(url, { tries=2, waitMs=800 } = {}){
  for(let i=0;i<tries;i++){
    const r = await fetch(url, { headers:{ 'User-Agent': UA, 'Accept-Language':'es-PE,es;q=0.9' } })
    if(r.ok) return await r.text()
    await delay(waitMs*(i+1))
  }
  throw new Error(`HTTP fail @ ${url}`)
}
