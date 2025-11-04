// app/api/estimate/route.js
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { geocodeAddress } from '@/lib/geo/geocode';
import { searchEverywhere } from '@/lib/scrape/providers';

const InSchema = z.object({
  direccion: z.string(),
  distrito: z.string().optional().default(''),
  tipo: z.enum(['departamento','casa']).default('departamento'),
  m2_construidos: z.number().positive(),             // OBLIGATORIO
  m2_terreno: z.number().optional(),                  // OPCIONAL
  antiguedad_anos: z.number().optional().default(0),
  vista_mar: z.boolean().optional().default(false),
  habitaciones: z.number().optional().default(0),
  banos: z.number().optional().default(0),
  estacionamientos: z.number().optional().default(0)
});

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = (p/100)*(sorted.length-1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo===hi) return sorted[lo];
  return sorted[lo] + (sorted[hi]-sorted[lo])*(idx-lo);
}

export async function POST(req) {
  try {
    const body = await req.json();
    const input = InSchema.parse(body || {});

    // Geocode de la dirección
    const geo = await geocodeAddress(input.direccion, input.distrito || '');
    if (!geo.ok) return NextResponse.json({ ok:false, error:'no_geocode' }, { status: 200 });

    // Buscar comparables (al menos 40 si es posible)
    let comps = [];
    if (process.env.ENABLE_SCRAPING === '1') {
      comps = await searchEverywhere({
        q: input.direccion,
        district: input.distrito || '',
        minArea: Math.max(40, Math.round(input.m2_construidos*0.7)),
        minRooms: input.habitaciones || 0,
        maxPriceUSD: undefined,
        limit: 80
      });
    }
    if (!comps.length) {
      // fallback al mock
      try {
        comps = await (await fetch(new URL('/mock.json', req.url))).json();
      } catch { comps = []; }
    }

    // Filtrado por tipo aproximado + rango de área +/-30%
    const minA = input.m2_construidos*0.7, maxA = input.m2_construidos*1.3;
    comps = comps.filter(c => {
      const okArea = c.m2 && c.m2 >= minA && c.m2 <= maxA;
      const okRooms = (input.habitaciones || 0) ? ((c.habitaciones||0) >= input.habitaciones) : true;
      return !!c.precio && !!c.m2 && okArea && okRooms;
    }).slice(0, 60);

    if (comps.length < 8) {
      return NextResponse.json({ ok:false, error:'no_comps' }, { status: 200 });
    }

    // Calcular precio/m2 y percentiles
    const pm2 = comps.map(c => (c.precio / Math.max(1, c.m2))).filter(Number.isFinite).sort((a,b)=>a-b);
    const p10 = Math.round(percentile(pm2, 10));
    const p25 = Math.round(percentile(pm2, 25));
    const p50 = Math.round(percentile(pm2, 50));
    const p75 = Math.round(percentile(pm2, 75));
    const p90 = Math.round(percentile(pm2, 90));

    // Ajustes simples por vista al mar / antigüedad / tipo
    let mult = 1.0;
    if (input.vista_mar) mult += 0.08;
    if (input.antiguedad_anos > 25) mult -= 0.07;
    if (input.antiguedad_anos < 5)  mult += 0.03;
    if (input.tipo === 'casa' && input.m2_terreno) mult += 0.05;

    const base_m2 = p50;
    const estimado = Math.round(base_m2 * input.m2_construidos * mult);
    const rango = Math.round(estimado * 0.08);

    return NextResponse.json({
      ok: true,
      geo: { lat: geo.lat, lon: geo.lon, display: geo.display_name },
      precio_m2_zona: base_m2,
      percentiles: { p10,p25,p50,p75,p90 },
      estimado,
      rango_confianza: [estimado - rango, estimado + rango],
      comparables: comps.slice(0, 20)
    });
  } catch (e) {
    return NextResponse.json({ ok:false, error:String(e.message||e) }, { status: 400 });
  }
}
