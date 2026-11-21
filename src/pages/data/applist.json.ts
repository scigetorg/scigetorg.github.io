// Same-origin copy of the multi-domain application catalogs for /applications/,
// built once per deploy from domains.json and each domain's apps.json
// (see src/lib/appsCatalog.ts).
import type { APIRoute } from 'astro';
import { loadCatalog } from '../../lib/appsCatalog';

export const GET: APIRoute = async () =>
	new Response(JSON.stringify(await loadCatalog()), {
		headers: { 'Content-Type': 'application/json' },
	});
