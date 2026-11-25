// Same-origin build-time snapshot of GA4 webapp analytics from each
// Sciget / Neurodesk webapp catalogue (see src/lib/metricsFeeds.ts).
import type { APIRoute } from 'astro';
import { loadWebappMetrics } from '../../lib/metricsFeeds';

export const GET: APIRoute = async () =>
	new Response(JSON.stringify(await loadWebappMetrics()), {
		headers: { 'Content-Type': 'application/json' },
	});
