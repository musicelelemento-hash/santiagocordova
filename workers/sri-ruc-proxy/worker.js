/**
 * sri-ruc-proxy — consulta del padrón público del SRI para la web del estudio.
 *
 * Por qué existe: el navegador no puede llamar directo al SRI (CORS), y el
 * proxy gratuito que se usaba (corsproxy.io) pasó a cobrar en 2026. Este Worker
 * hace sólo esa consulta, desde la cuenta de Cloudflare del estudio (plan
 * gratis: 100.000 solicitudes/día).
 *
 * Qué NO es: un proxy abierto. Sólo acepta GET /ruc/<10 o 13 dígitos> y sólo
 * reenvía al endpoint público de contribuyentes del SRI. CORS sólo para los
 * dominios del estudio, Vercel del proyecto y localhost.
 *
 * Desplegado vía API de Cloudflare como script «sri-ruc-proxy».
 * URL: https://sri-ruc-proxy.santiagocordova.workers.dev/ruc/<ruc>
 */

// Fuentes públicas del SRI, en orden. Las dos se normalizan a la forma que
// espera la web (services/sri.ts): razonSocial, nombreComercial, estado,
// actividadEconomicaPrincipal, establecimientos.
const FUENTES = [
  {
    nombre: 'movil',
    url: (ruc) => `https://srienlinea.sri.gob.ec/movil-servicios/api/v1.0/contribuyente/${ruc}`,
    normalizar: (d) => (d && (d.razonSocial || d.nombreComercial)) ? d : null,
  },
  {
    nombre: 'catastro',
    url: (ruc) => `https://srienlinea.sri.gob.ec/sri-catastro-sujeto-servicio-internet/rest/ConsolidadoContribuyente/obtenerPorNumerosRuc?&ruc=${ruc}`,
    normalizar: (d) => {
      const c = Array.isArray(d) ? d[0] : d;
      if (!c || !c.razonSocial) return null;
      return {
        razonSocial: c.razonSocial,
        nombreComercial: c.nombreComercial || '',
        estado: c.estadoContribuyenteRuc || c.estado || '',
        actividadEconomicaPrincipal: c.actividadEconomicaPrincipal || '',
        regimen: c.regimen || '',
        obligadoContabilidad: c.obligadoLlevarContabilidad || '',
        establecimientos: [],
      };
    },
  },
];
const CACHE_SEGUNDOS = 6 * 60 * 60; // el padrón cambia poco; evita golpear al SRI

const ORIGENES = [
  /^https:\/\/([a-z0-9-]+\.)*santiagocordova\.com$/,
  /^https:\/\/gestiones-tributarias-[a-z0-9-]*santiagos-projects-f4184cd4\.vercel\.app$/,
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
];

const origenPermitido = (o) => !!o && ORIGENES.some((re) => re.test(o));

function cors(origin) {
  const h = { 'Vary': 'Origin' };
  if (origenPermitido(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
    h['Access-Control-Max-Age'] = '86400';
  }
  return h;
}

const json = (obj, status, origin, extra = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(origin), ...extra },
  });

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin');
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (request.method !== 'GET') return json({ error: 'Método no permitido' }, 405, origin);
    if (origin && !origenPermitido(origin)) return json({ error: 'Origen no permitido' }, 403, origin);

    const m = url.pathname.match(/^\/ruc\/(\d{10}|\d{13})$/);
    if (!m) return json({ error: 'Uso: GET /ruc/<cédula de 10 o RUC de 13 dígitos>' }, 400, origin);
    const ruc = m[1].length === 10 ? `${m[1]}001` : m[1];

    const cache = caches.default;
    const clave = new Request(`https://cache.sri-ruc-proxy/${ruc}`);
    const guardado = await cache.match(clave);
    if (guardado) {
      const r = new Response(guardado.body, guardado);
      for (const [k, v] of Object.entries(cors(origin))) r.headers.set(k, v);
      r.headers.set('X-Cache', 'HIT');
      return r;
    }

    // Dos servicios públicos del SRI. El WAF filtra según cabeceras y origen,
    // así que se piden como lo haría el navegador desde el propio portal.
    const NAV = {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'es-EC,es;q=0.9',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
      'Referer': 'https://srienlinea.sri.gob.ec/sri-en-linea/SriRucWeb/ConsultaRuc/Consultas/consultaRuc',
      'Origin': 'https://srienlinea.sri.gob.ec',
    };
    const intentos = [];
    let cuerpo = null;
    for (const fuente of FUENTES) {
      try {
        const resp = await fetch(fuente.url(ruc), { headers: NAV, cf: { cacheTtl: 0 } });
        const txt = await resp.text();
        const t = txt.trim();
        if (resp.ok && (t.startsWith('{') || t.startsWith('['))) {
          const datos = fuente.normalizar(JSON.parse(t));
          if (datos) { cuerpo = JSON.stringify(datos); break; }
          intentos.push({ fuente: fuente.nombre, status: resp.status, motivo: 'sin datos' });
        } else {
          intentos.push({ fuente: fuente.nombre, status: resp.status, muestra: t.slice(0, 120) });
        }
      } catch (e) {
        intentos.push({ fuente: fuente.nombre, error: String(e).slice(0, 120) });
      }
    }
    // El WAF del SRI responde 200 con una página HTML de rechazo: no es un dato.
    if (!cuerpo) return json({ error: 'El SRI rechazó o no devolvió datos', intentos }, 502, origin);

    const ok = new Response(cuerpo, {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${CACHE_SEGUNDOS}` },
    });
    ctx.waitUntil(cache.put(clave, ok.clone()));
    const r = new Response(cuerpo, ok);
    for (const [k, v] of Object.entries(cors(origin))) r.headers.set(k, v);
    r.headers.set('X-Cache', 'MISS');
    return r;
  },
};
