/**
 * GET /api/region — la provincia aproximada de quien visita (Vercel Function).
 *
 * Para qué: el mapa del Ecuador de la portada resalta la provincia del
 * visitante («Estás aquí»).
 *
 * Cómo: Vercel ya calcula el país y la subdivisión a partir de la conexión y
 * los pasa en los encabezados `x-vercel-ip-country` y
 * `x-vercel-ip-country-region` (código ISO 3166-2, p. ej. «G» = Guayas).
 * No se consulta ningún servicio externo, no se pide permiso de ubicación,
 * no se guarda nada y la IP no sale de acá: sólo se devuelve el código.
 * Si no es Ecuador, o Vercel no sabe, la respuesta va vacía.
 */

const json = (obj: unknown) =>
    new Response(JSON.stringify(obj), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
    });

export async function GET(request: Request): Promise<Response> {
    const pais = (request.headers.get('x-vercel-ip-country') || '').toUpperCase();
    const region = (request.headers.get('x-vercel-ip-country-region') || '').toUpperCase();
    if (pais !== 'EC' || !/^[A-Z]{1,3}$/.test(region)) return json({ pais: pais || null, region: null });
    return json({ pais, region });
}
