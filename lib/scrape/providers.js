// lib/scrape/providers.js
import cheerio from 'cheerio';

const UA = 'Mozilla/5.0 (b369-ai; Netlify; +https://b369-ai.netlify.app)';
const SCRAPEIT_KEY = process.env.SCRAPEIT_KEY || '';

async function fetchHTML(url) {
  const headers = { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' };
  if (SCRAPEIT_KEY) {
    const prox = `https://api.scrape-it.cloud/scrape?api_key=${SCRAPEIT_KEY}&url=${encodeURIComponent(url)}&country=pe&block_resources=true`;
    const r = await fetch(prox, { headers });
    if (!r.ok) throw new Error(`proxy_${r.status}`);
    const json = await r.json();
    return json.content || '';
  } else {
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error(`direct_${r.status}`);
    return await r.text();
  }
}

function normalizeNumber(txt='') {
  const n = (txt||'').replace(/[^\d.,]/g,'').replace(/\.(?=\d{3}\b)/g,'').replace(',','.');
  const v = parseFloat(n); return Number.isFinite(v) ? v : undefined;
}

function parseCard($, el, fuente) {
  const $el = $(el);
  const titulo = $el.find('h2,h3,.title,.property-title').first().text().trim() || 'Propiedad';
  const precioTxt = $el.text();
  const precio = normalizeNumber(precioTxt);
  const moneda = /\$|USD/i.test(precioTxt) ? 'USD' : 'PEN';
  const m2 = normalizeNumber(($el.text().match(/(\d+)\s?m²/i)||[])[1]);
  const hab = normalizeNumber(($el.text().match(/(\d+)\s?(hab|dorm)/i)||[])[1]);
  const direccion = $el.find('.address,.location').first().text().trim() || '';
  const href = $el.find('a[href]').first().attr('href') || '';
  const url = href?.startsWith('http') ? href : (href ? new URL(href, 'https://example.com').toString() : '');
  return {
    id: `${fuente}_${Buffer.from((url||titulo).slice(0,200)).toString('base64')}`,
    titulo, precio, moneda, m2, habitaciones: hab, direccion, fuente, url
  };
}

// Proveedor genérico: devuelve hasta 'limit' items con parsers conservadores
async function scrapeGeneric(listUrl, itemSelector, fuente, limit=12) {
  try {
    const html = await fetchHTML(listUrl);
    const $ = cheerio.load(html);
    const out = [];
    $(itemSelector).each((_, el) => {
      if (out.length >= limit) return false;
      const it = parseCard($, el, fuente);
      if (it.precio && it.m2) out.push(it);
    });
    return out;
  } catch {
    return [];
  }
}

// Lima distritos → url params típicos
function qDistrict(d) {
  if (!d) return '';
  const map = {
    'miraflores':'miraflores','san isidro':'san-isidro','barranco':'barranco','surco':'santiago-de-surco',
    'jesus maria':'jesus-maria','san borja':'san-borja','la molina':'la-molina','magdalena':'magdalena-del-mar'
  };
  const k = d.toLowerCase();
  return map[k] || encodeURIComponent(k.replace(/\s+/g,'-'));
}

export async function searchEverywhere({ q, district, minArea, minRooms, maxPriceUSD, limit=20 }) {
  const dseg = qDistrict(district || '');
  const urls = [
    // 1) Urbania (venta departamentos)
    dseg ? `https://urbania.pe/buscar/venta-de-departamentos-en-${dseg}-lima` :
           `https://urbania.pe/buscar/venta-de-departamentos-en-lima`,
    // 2) Adondevivir
    dseg ? `https://www.adondevivir.com/departamentos-en-venta-en-${dseg}.html` :
           `https://www.adondevivir.com/departamentos-en-venta-en-lima.html`,
    // 3) Babilonia
    `https://babilonia.pe/busqueda/venta/departamento/${dseg || 'lima'}`,
    // 4) OLX
    `https://www.olx.com.pe/inmuebles_cat_16`,
    // 5) Properati
    dseg ? `https://www.properati.com.pe/s/${dseg}/departamentos/venta` :
           `https://www.properati.com.pe/s/lima/departamentos/venta`,
  ];

  const sel = [
    // selectores prudentes (pueden variar; si fallan, resultará vacío pero no rompe)
    'article, .posting-card, .prop-card, .property-card, .styles__Card-sc',
    'article, .posting-card, .prop-card, .search-item, .property-card',
    'article, .card, .property-card',
    'article, .listing-card, .display-item',
    'article, .posting-card, .search-card, .Card__Container',
  ];

  const fuentes = ['urbania','adondevivir','babilonia','olx','properati'];

  const requests = urls.map((u,i)=> scrapeGeneric(u, sel[i], fuentes[i], Math.ceil(limit/2)));
  let items = (await Promise.all(requests)).flat();

  // Filtrado básico por requisitos
  items = items.filter(it=>{
    if (minArea && (it.m2 || 0) < minArea) return false;
    if (minRooms && (it.habitaciones || 0) < minRooms) return false;
    if (maxPriceUSD && it.moneda==='USD' && (it.precio||0) > maxPriceUSD) return false;
    return true;
  });

  // orden por precio asc
  items.sort((a,b)=>(a.precio||Infinity)-(b.precio||Infinity));
  return items.slice(0, limit);
}
