// Build-time loaders for Sciget metrics feeds:
// 1. Live GA4 analytics.json snapshots published by each Sciget / Neurodesk
//    webapp catalogue (mskapps, microscopyapps, preclinicalapps,
//    dermatologyapps, and webapps.neurodesk.org).
// 2. GitHub release asset download counts for scigetorg/neurodesk-app
//    (Sciget App / Neurodesk App).
//
// Both loaders use bounded timeouts and degrade gracefully so site builds
// never fail when an upstream API is unreachable or rate-limited.

export const FETCH_TIMEOUT_MS = 15_000;
const APP_PATH_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_2_PATTERN = /^[A-Z]{2}$/;

export interface WebappCatalogSource {
	id: string;
	label: string;
	host: string;
	analyticsUrl: string;
	scigetHosted: boolean;
}

export const WEBAPP_CATALOG_SOURCES: readonly WebappCatalogSource[] = [
	{
		id: 'msk',
		label: 'Musculoskeletal',
		host: 'mskapps.sciget.org',
		analyticsUrl: 'https://mskapps.sciget.org/analytics.json',
		scigetHosted: true,
	},
	{
		id: 'preclinical',
		label: 'Preclinical',
		host: 'preclinicalapps.sciget.org',
		analyticsUrl: 'https://preclinicalapps.sciget.org/analytics.json',
		scigetHosted: true,
	},
	{
		id: 'microscopy',
		label: 'Microscopy',
		host: 'microscopyapps.sciget.org',
		analyticsUrl: 'https://microscopyapps.sciget.org/analytics.json',
		scigetHosted: true,
	},
	{
		id: 'dermatology',
		label: 'Dermatology',
		host: 'dermatologyapps.sciget.org',
		analyticsUrl: 'https://dermatologyapps.sciget.org/analytics.json',
		scigetHosted: true,
	},
	{
		id: 'neuro',
		label: 'Neuroimaging',
		host: 'webapps.neurodesk.org',
		analyticsUrl: 'https://webapps.neurodesk.org/analytics.json',
		scigetHosted: false,
	},
];

export const APP_RELEASES_REPO = 'scigetorg/neurodesk-app';
export const APP_RELEASES_API_URL = `https://api.github.com/repos/${APP_RELEASES_REPO}/releases?per_page=100`;

export interface CountryCount {
	code: string;
	name: string;
	users: number;
}

export interface WebappAnalyticsEntry {
	id: string;
	path: string;
	title: string;
	url: string;
	users: number;
	pageViews: number;
}

export interface WebappCatalogMetrics {
	id: string;
	label: string;
	host: string;
	url: string;
	scigetHosted: boolean;
	generatedAt: string | null;
	source: string;
	periodDays: number;
	unavailable: boolean;
	totals: {
		users: number;
		pageViews: number;
	};
	countries: CountryCount[];
	apps: WebappAnalyticsEntry[];
}

export interface WebappMetricsPayload {
	generatedAt: string;
	source: string;
	periodDays: number;
	catalogs: WebappCatalogMetrics[];
}

export type AppPlatform = 'windows' | 'linux' | 'macos';

export interface ReleaseDownloadSummary {
	tag: string;
	publishedAt: string;
	windows: number;
	linux: number;
	macos: number;
	total: number;
}

export interface AppDownloadsPayload {
	generatedAt: string;
	repo: string;
	repoUrl: string;
	unavailable: boolean;
	totals: {
		windows: number;
		linux: number;
		macos: number;
		all: number;
	};
	releases: ReleaseDownloadSummary[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toNonNegativeInt(value: unknown): number {
	const num = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(num) || num < 0) return 0;
	return Math.round(num);
}

function parseCountries(raw: unknown): CountryCount[] {
	if (!Array.isArray(raw)) return [];
	const results: CountryCount[] = [];
	for (const item of raw) {
		if (!isRecord(item)) continue;
		const code = typeof item.code === 'string' ? item.code.trim().toUpperCase() : '';
		const name = typeof item.name === 'string' ? item.name.trim() : '';
		const users = toNonNegativeInt(item.users);
		if (!ISO_2_PATTERN.test(code) || users <= 0) continue;
		results.push({ code, name: name || code, users });
	}
	return results.sort((a, b) => b.users - a.users || a.name.localeCompare(b.name));
}

export function parseWebappAnalyticsFeed(
	raw: unknown,
	source: WebappCatalogSource,
): WebappCatalogMetrics {
	if (!isRecord(raw)) {
		throw new Error(`analytics.json (${source.analyticsUrl}) must be an object`);
	}

	const generatedAt = typeof raw.generatedAt === 'string' ? raw.generatedAt : null;
	const dataSource = typeof raw.source === 'string' && raw.source.trim()
		? raw.source.trim()
		: 'Google Analytics 4';
	const periodDays = toNonNegativeInt(raw.periodDays) || 30;
	const unavailable = raw.unavailable === true;

	const rawTotals = isRecord(raw.totals) ? raw.totals : {};
	const totals = {
		users: toNonNegativeInt(rawTotals.users),
		pageViews: toNonNegativeInt(rawTotals.pageViews),
	};

	const rawApps = Array.isArray(raw.apps) ? raw.apps : [];
	const seenPaths = new Set<string>();
	const apps: WebappAnalyticsEntry[] = [];
	for (const item of rawApps) {
		if (!isRecord(item)) continue;
		const path = typeof item.path === 'string' ? item.path.trim() : '';
		const title = typeof item.title === 'string' ? item.title.trim() : '';
		const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : path;
		if (!APP_PATH_PATTERN.test(path) || !title || seenPaths.has(path)) {
			continue;
		}
		seenPaths.add(path);
		apps.push({
			id,
			path,
			title,
			url: `https://${source.host}/${path}/`,
			users: toNonNegativeInt(item.users),
			pageViews: toNonNegativeInt(item.pageViews),
		});
	}

	apps.sort(
		(a, b) =>
			b.users - a.users ||
			b.pageViews - a.pageViews ||
			a.title.localeCompare(b.title),
	);

	return {
		id: source.id,
		label: source.label,
		host: source.host,
		url: `https://${source.host}/`,
		scigetHosted: source.scigetHosted,
		generatedAt,
		source: dataSource,
		periodDays,
		unavailable: unavailable || apps.length === 0,
		totals,
		countries: parseCountries(raw.countries),
		apps,
	};
}

function unavailableCatalog(source: WebappCatalogSource): WebappCatalogMetrics {
	return {
		id: source.id,
		label: source.label,
		host: source.host,
		url: `https://${source.host}/`,
		scigetHosted: source.scigetHosted,
		generatedAt: null,
		source: 'Google Analytics 4',
		periodDays: 30,
		unavailable: true,
		totals: { users: 0, pageViews: 0 },
		countries: [],
		apps: [],
	};
}

async function fetchJsonWithTimeout(
	url: string,
	fetchImpl: typeof fetch,
	headers: Record<string, string> = {},
	timeoutMs = FETCH_TIMEOUT_MS,
): Promise<{ data: unknown; headers: Headers }> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const response = await fetchImpl(url, {
			headers,
			signal: controller.signal,
		});
		if (!response.ok) {
			throw new Error(`HTTP ${response.status} from ${url}`);
		}
		return { data: await response.json(), headers: response.headers };
	} finally {
		clearTimeout(timer);
	}
}

export async function loadWebappMetrics(
	sources: readonly WebappCatalogSource[] = WEBAPP_CATALOG_SOURCES,
	fetchImpl: typeof fetch = fetch,
	timeoutMs = FETCH_TIMEOUT_MS,
): Promise<WebappMetricsPayload> {
	const catalogs = await Promise.all(
		sources.map(async (source) => {
			try {
				const { data } = await fetchJsonWithTimeout(
					source.analyticsUrl,
					fetchImpl,
					{ Accept: 'application/json' },
					timeoutMs,
				);
				return parseWebappAnalyticsFeed(data, source);
			} catch {
				return unavailableCatalog(source);
			}
		}),
	);

	const timestamps = catalogs
		.map((c) => c.generatedAt)
		.filter((v): v is string => typeof v === 'string' && v.length > 0)
		.sort();
	const generatedAt = timestamps[timestamps.length - 1] ?? new Date().toISOString();
	const activeCatalog = catalogs.find((c) => !c.unavailable);

	return {
		generatedAt,
		source: activeCatalog?.source ?? 'Google Analytics 4',
		periodDays: activeCatalog?.periodDays ?? 30,
		catalogs,
	};
}

/**
 * Classifies a GitHub release asset filename into its desktop OS platform,
 * matching neurodesk's write-neurodeskapp-metrics.py rules.
 */
export function classifyReleaseAsset(name: string): AppPlatform | null {
	if (/windows.*\.exe$/i.test(name)) return 'windows';
	if (/(debian|fedora).*\.(deb|rpm)$/i.test(name)) return 'linux';
	if (/macos.*\.(dmg|zip)$/i.test(name)) return 'macos';
	return null;
}

export function nextLinkUrl(linkHeader: string | null): string | null {
	if (!linkHeader) return null;
	for (const part of linkHeader.split(',')) {
		const segments = part.split(';').map((s) => s.trim());
		if (segments.length < 2 || !segments.slice(1).includes('rel="next"')) {
			continue;
		}
		const target = segments[0];
		if (target.startsWith('<') && target.endsWith('>')) {
			const candidate = target.slice(1, -1);
			try {
				const parsed = new URL(candidate);
				if (parsed.protocol === 'https:' && parsed.hostname === 'api.github.com') {
					return parsed.href;
				}
			} catch {
				return null;
			}
		}
	}
	return null;
}

export function summarizeReleases(rawReleases: unknown): ReleaseDownloadSummary[] {
	if (!Array.isArray(rawReleases)) {
		throw new Error('GitHub releases API response must be an array');
	}
	const summarized: ReleaseDownloadSummary[] = [];
	for (const release of rawReleases) {
		if (!isRecord(release)) continue;
		if (release.draft === true) continue;
		const tag = typeof release.tag_name === 'string' ? release.tag_name.trim() : '';
		const publishedAt =
			typeof release.published_at === 'string' ? release.published_at.trim() : '';
		if (!tag || !publishedAt || Number.isNaN(Date.parse(publishedAt))) continue;

		const counts: Record<AppPlatform, number> = { windows: 0, linux: 0, macos: 0 };
		const assets = Array.isArray(release.assets) ? release.assets : [];
		for (const asset of assets) {
			if (!isRecord(asset)) continue;
			const name = typeof asset.name === 'string' ? asset.name : '';
			const platform = classifyReleaseAsset(name);
			if (!platform) continue;
			counts[platform] += toNonNegativeInt(asset.download_count);
		}

		summarized.push({
			tag,
			publishedAt,
			windows: counts.windows,
			linux: counts.linux,
			macos: counts.macos,
			total: counts.windows + counts.linux + counts.macos,
		});
	}

	return summarized.sort(
		(a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt),
	);
}

export async function loadAppDownloads(options: {
	repo?: string;
	fetchImpl?: typeof fetch;
	token?: string;
	timeoutMs?: number;
} = {}): Promise<AppDownloadsPayload> {
	const repo = options.repo ?? APP_RELEASES_REPO;
	const fetchImpl = options.fetchImpl ?? fetch;
	const timeoutMs = options.timeoutMs ?? FETCH_TIMEOUT_MS;
	const token = options.token ?? process.env.GITHUB_TOKEN;
	const generatedAt = new Date().toISOString();
	const repoUrl = `https://github.com/${repo}`;

	const headers: Record<string, string> = {
		Accept: 'application/vnd.github+json',
		'User-Agent': 'sciget-metrics-builder',
		'X-GitHub-Api-Version': '2022-11-28',
	};
	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}

	try {
		const rawReleases: unknown[] = [];
		let nextUrl: string | null = `https://api.github.com/repos/${repo}/releases?per_page=100`;
		let pages = 0;
		while (nextUrl && pages < 10) {
			const { data, headers: responseHeaders } = await fetchJsonWithTimeout(
				nextUrl,
				fetchImpl,
				headers,
				timeoutMs,
			);
			if (!Array.isArray(data)) {
				throw new Error(`Unexpected non-array releases payload from ${nextUrl}`);
			}
			rawReleases.push(...data);
			nextUrl = nextLinkUrl(responseHeaders.get('link'));
			pages += 1;
		}

		const releases = summarizeReleases(rawReleases);
		if (!releases.length) {
			throw new Error(`No published releases found for ${repo}`);
		}

		const totals = releases.reduce(
			(acc, r) => {
				acc.windows += r.windows;
				acc.linux += r.linux;
				acc.macos += r.macos;
				acc.all += r.total;
				return acc;
			},
			{ windows: 0, linux: 0, macos: 0, all: 0 },
		);

		return {
			generatedAt,
			repo,
			repoUrl,
			unavailable: false,
			totals,
			releases,
		};
	} catch {
		return {
			generatedAt,
			repo,
			repoUrl,
			unavailable: true,
			totals: { windows: 0, linux: 0, macos: 0, all: 0 },
			releases: [],
		};
	}
}
