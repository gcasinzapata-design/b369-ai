// lib/scrape/fetch.js
export async function politeGet(url){
  const r = await fetch(url, {
    headers:{
      'User-Agent':'b369-ai/1.0 (netlify)',
      'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    },
    redirect:'follow',
    cache:'no-store'
  })
  if(!r.ok) throw new Error(`GET ${url} ${r.status}`)
  return await r.text()
}
