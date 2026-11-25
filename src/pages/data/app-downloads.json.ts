// Same-origin build-time snapshot of Sciget App release download counts from
// GitHub Releases (see src/lib/metricsFeeds.ts).
import type { APIRoute } from 'astro';
import { loadAppDownloads } from '../../lib/metricsFeeds';

export const GET: APIRoute = async () =>
	new Response(JSON.stringify(await loadAppDownloads()), {
		headers: { 'Content-Type': 'application/json' },
	});
