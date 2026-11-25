import assert from 'node:assert/strict';
import test from 'node:test';
import {
	classifyReleaseAsset,
	loadAppDownloads,
	loadWebappMetrics,
	nextLinkUrl,
	parseWebappAnalyticsFeed,
	summarizeReleases,
	type WebappCatalogSource,
} from '../src/lib/metricsFeeds.ts';

const MSK_SOURCE: WebappCatalogSource = {
	id: 'msk',
	label: 'Musculoskeletal',
	host: 'mskapps.sciget.org',
	analyticsUrl: 'https://mskapps.sciget.org/analytics.json',
	scigetHosted: true,
};

const MICROSCOPY_SOURCE: WebappCatalogSource = {
	id: 'microscopy',
	label: 'Microscopy',
	host: 'microscopyapps.sciget.org',
	analyticsUrl: 'https://microscopyapps.sciget.org/analytics.json',
	scigetHosted: true,
};

test('parseWebappAnalyticsFeed validates, deduplicates, and sorts apps and countries', () => {
	const parsed = parseWebappAnalyticsFeed(
		{
			generatedAt: '2026-11-25T08:58:44.322Z',
			source: 'Google Analytics 4',
			periodDays: 30,
			unavailable: false,
			totals: { users: 978, pageViews: 1178 },
			countries: [
				{ code: 'au', name: 'Australia', users: 14 },
				{ code: 'US', name: 'United States', users: 102 },
				{ code: 'BAD', name: 'Invalid', users: 50 },
				{ code: 'DE', name: 'Germany', users: 0 },
			],
			apps: [
				{ id: 'seedseg', path: 'seedseg', title: 'SeedSeg', users: 15, pageViews: 18 },
				{ id: 'musclemap', path: 'musclemap', title: 'MuscleMap', users: 885, pageViews: 1043 },
				{ id: 'dup', path: 'seedseg', title: 'Duplicate', users: 999, pageViews: 999 },
				{ id: 'bad', path: '../escape', title: 'Bad Path', users: 100, pageViews: 100 },
				{ id: 'empty', path: 'empty-title', title: '   ', users: 10, pageViews: 10 },
			],
		},
		MSK_SOURCE,
	);

	assert.equal(parsed.unavailable, false);
	assert.equal(parsed.url, 'https://mskapps.sciget.org/');
	assert.deepEqual(
		parsed.apps.map((a) => ({ path: a.path, url: a.url, users: a.users })),
		[
			{ path: 'musclemap', url: 'https://mskapps.sciget.org/musclemap/', users: 885 },
			{ path: 'seedseg', url: 'https://mskapps.sciget.org/seedseg/', users: 15 },
		],
	);
	assert.deepEqual(parsed.countries, [
		{ code: 'US', name: 'United States', users: 102 },
		{ code: 'AU', name: 'Australia', users: 14 },
	]);
});

test('loadWebappMetrics degrades per catalogue when one feed fails', async () => {
	const fakeFetch: typeof fetch = async (input) => {
		const url = String(input);
		if (url === MSK_SOURCE.analyticsUrl) {
			return new Response(
				JSON.stringify({
					generatedAt: '2026-11-25T08:00:00Z',
					source: 'Google Analytics 4',
					periodDays: 30,
					unavailable: false,
					totals: { users: 50, pageViews: 80 },
					countries: [],
					apps: [{ id: 'musclemap', path: 'musclemap', title: 'MuscleMap', users: 50, pageViews: 80 }],
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } },
			);
		}
		return new Response('boom', { status: 503 });
	};

	const payload = await loadWebappMetrics([MSK_SOURCE, MICROSCOPY_SOURCE], fakeFetch);
	assert.equal(payload.generatedAt, '2026-11-25T08:00:00Z');
	assert.equal(payload.catalogs[0].unavailable, false);
	assert.equal(payload.catalogs[0].totals.users, 50);
	assert.equal(payload.catalogs[1].unavailable, true);
	assert.deepEqual(payload.catalogs[1].apps, []);
});

test('classifyReleaseAsset matches both ScigetApp and NeurodeskApp installers and ignores metadata', () => {
	assert.equal(classifyReleaseAsset('ScigetApp-Setup-Windows.exe'), 'windows');
	assert.equal(classifyReleaseAsset('NeurodeskApp-Setup-Windows.exe'), 'windows');
	assert.equal(classifyReleaseAsset('ScigetApp-Setup-Debian-x64.deb'), 'linux');
	assert.equal(classifyReleaseAsset('ScigetApp-Setup-Fedora-arm64.rpm'), 'linux');
	assert.equal(classifyReleaseAsset('ScigetApp-Setup-macOS-arm64.dmg'), 'macos');
	assert.equal(classifyReleaseAsset('NeurodeskApp-macOS-x64.zip'), 'macos');
	assert.equal(classifyReleaseAsset('latest.yml'), null);
	assert.equal(classifyReleaseAsset('checksums.txt'), null);
});

test('nextLinkUrl parses GitHub API pagination and rejects other origins', () => {
	assert.equal(
		nextLinkUrl(
			'<https://api.github.com/repos/scigetorg/neurodesk-app/releases?per_page=100&page=2>; rel="next", <https://api.github.com/repos/scigetorg/neurodesk-app/releases?per_page=100&page=3>; rel="last"',
		),
		'https://api.github.com/repos/scigetorg/neurodesk-app/releases?per_page=100&page=2',
	);
	assert.equal(nextLinkUrl('<https://evil.example/page=2>; rel="next"'), null);
	assert.equal(nextLinkUrl('<https://api.github.com/page=1>; rel="prev"'), null);
	assert.equal(nextLinkUrl(null), null);
});

test('summarizeReleases skips drafts, aggregates OS counts, and sorts chronologically', () => {
	const releases = summarizeReleases([
		{
			tag_name: 'v2.2.0',
			draft: false,
			published_at: '2026-10-22T05:06:03Z',
			assets: [
				{ name: 'latest.yml', download_count: 500 },
				{ name: 'ScigetApp-Setup-Windows.exe', download_count: 10 },
				{ name: 'ScigetApp-Setup-Debian-x64.deb', download_count: 4 },
				{ name: 'ScigetApp-Setup-Fedora-arm64.rpm', download_count: 6 },
				{ name: 'ScigetApp-Setup-macOS-arm64.dmg', download_count: 15 },
				{ name: 'ScigetApp-macOS-x64.zip', download_count: 5 },
			],
		},
		{
			tag_name: 'v2.3.0-draft',
			draft: true,
			published_at: '2026-11-01T00:00:00Z',
			assets: [{ name: 'ScigetApp-Setup-Windows.exe', download_count: 999 }],
		},
		{
			tag_name: 'v2.1.0',
			draft: false,
			published_at: '2026-10-09T07:11:02Z',
			assets: [{ name: 'NeurodeskApp-Setup-Windows.exe', download_count: 176 }],
		},
	]);

	assert.deepEqual(releases, [
		{
			tag: 'v2.1.0',
			publishedAt: '2026-10-09T07:11:02Z',
			windows: 176,
			linux: 0,
			macos: 0,
			total: 176,
		},
		{
			tag: 'v2.2.0',
			publishedAt: '2026-10-22T05:06:03Z',
			windows: 10,
			linux: 10,
			macos: 20,
			total: 40,
		},
	]);
});

test('loadAppDownloads follows pagination and falls back cleanly on errors', async () => {
	const seenAuth: Array<string | null> = [];
	const paginatedFetch: typeof fetch = async (input, init) => {
		const url = String(input);
		const headers = new Headers(init?.headers);
		seenAuth.push(headers.get('authorization'));
		if (!url.includes('page=2')) {
			return new Response(
				JSON.stringify([
					{
						tag_name: 'v2.0.0',
						draft: false,
						published_at: '2026-07-30T05:18:46Z',
						assets: [{ name: 'NeurodeskApp-Setup-Windows.exe', download_count: 100 }],
					},
				]),
				{
					status: 200,
					headers: {
						'Content-Type': 'application/json',
						Link: '<https://api.github.com/repos/scigetorg/neurodesk-app/releases?per_page=100&page=2>; rel="next"',
					},
				},
			);
		}
		return new Response(
			JSON.stringify([
				{
					tag_name: 'v1.0.0',
					draft: false,
					published_at: '2023-05-31T01:12:22Z',
					assets: [{ name: 'NeurodeskApp-Setup-macOS-arm64.dmg', download_count: 50 }],
				},
			]),
			{ status: 200, headers: { 'Content-Type': 'application/json' } },
		);
	};

	const ok = await loadAppDownloads({ fetchImpl: paginatedFetch, token: 'test-tok' });
	assert.equal(ok.unavailable, false);
	assert.deepEqual(ok.totals, { windows: 100, linux: 0, macos: 50, all: 150 });
	assert.deepEqual(ok.releases.map((r) => r.tag), ['v1.0.0', 'v2.0.0']);
	assert.deepEqual(seenAuth, ['Bearer test-tok', 'Bearer test-tok']);

	const failingFetch: typeof fetch = async () => new Response('rate limited', { status: 403 });
	const fallback = await loadAppDownloads({ fetchImpl: failingFetch, token: '' });
	assert.equal(fallback.unavailable, true);
	assert.deepEqual(fallback.releases, []);
});
