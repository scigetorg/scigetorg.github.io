import assert from 'node:assert/strict';
import test from 'node:test';
import {
	assertAllowedCatalogUrl,
	displayName,
	fetchCatalog,
	formatDomainLabel,
	groupApps,
	isArm64Build,
	latestReleases,
	methodsText,
	normalizeDoiUrl,
	parseAppsFeed,
	parseDomainsFeed,
	toAppList,
} from '../src/lib/appsCatalog.ts';

const feed = () => ({
	afni: {
		categories: ['functional imaging'],
		description: 'Analysis of Functional NeuroImages',
		apps: {
			'afni 24.3.00': {
				version: '20241003',
				exec: '',
				image: 'afni_24.3.00',
				doi: 'https://doi.org/10.5281/zenodo.1',
				license: ['GPL-3.0'],
			},
			'sumaGUI-afni 24.3.00': {
				version: '20241003',
				exec: 'suma',
				image: 'afni_24.3.00',
			},
			'afni 26.3.11': {
				version: '20261101',
				exec: '',
				image: 'afni_26.3.11',
				license: ['GPL-3.0', 'MIT'],
			},
		},
	},
	amico: {
		categories: ['diffusion imaging'],
		description: 'Accelerated microstructure imaging',
		apps: {
			'amico 2.1.0': {
				version: '20250101',
				exec: '',
				image: 'amico_2.1.0_arm64',
			},
			'amico hidden': {
				version: '20260101',
				exec: '',
				image: 'amico_9.9.9',
				show_in_applist: false,
			},
		},
	},
	musclemap: {
		categories: ['image segmentation'],
		description: 'Muscle segmentation pipeline',
		openrecon: true,
		apps: {
			'musclemap 1.0': {
				version: '20260601',
				exec: '',
				image: 'musclemap_1.0',
			},
		},
	},
});

const list = () => toAppList(parseAppsFeed(feed()));

test('formatDomainLabel capitalizes single and hyphenated domain slugs', () => {
	assert.equal(formatDomainLabel('neuroimaging'), 'Neuroimaging');
	assert.equal(formatDomainLabel('microscopy'), 'Microscopy');
	assert.equal(formatDomainLabel('cellular-biology'), 'Cellular Biology');
	assert.equal(formatDomainLabel('clinical_research'), 'Clinical Research');
});

test('assertAllowedCatalogUrl enforces HTTPS and approved catalog origins', () => {
	assert.equal(
		assertAllowedCatalogUrl(
			'https://apps-catalog.scigetorg.workers.dev/neuroimaging/apps.json',
		).origin,
		'https://apps-catalog.scigetorg.workers.dev',
	);
	assert.throws(
		() =>
			assertAllowedCatalogUrl(
				'http://apps-catalog.scigetorg.workers.dev/neuroimaging/apps.json',
			),
		/must use https/,
	);
	assert.throws(
		() => assertAllowedCatalogUrl('https://evil.example/apps.json'),
		/not in allowed catalog origins/,
	);
});

test('normalizeDoiUrl validates and canonicalizes DOI links', () => {
	assert.equal(
		normalizeDoiUrl('https://doi.org/10.5281/zenodo.1'),
		'https://doi.org/10.5281/zenodo.1',
	);
	assert.equal(
		normalizeDoiUrl('https://dx.doi.org/10.5281/zenodo.1'),
		'https://doi.org/10.5281/zenodo.1',
	);
	assert.equal(
		normalizeDoiUrl('10.5281/zenodo.1'),
		'https://doi.org/10.5281/zenodo.1',
	);
	assert.equal(normalizeDoiUrl('javascript:alert(1)'), null);
	assert.equal(normalizeDoiUrl('http://doi.org/10.5281/zenodo.1'), null);
	assert.equal(normalizeDoiUrl('https://example.com/10.5281/zenodo.1'), null);
});

test('parseDomainsFeed extracts configured domains and metadata', () => {
	const domains = parseDomainsFeed({
		schemaVersion: 1,
		domains: {
			neuroimaging: {
				title: 'neurodesk',
				description: 'Neuroimaging tools.',
				defaultVersion: '2026-09-23',
				appJsonUrl:
					'https://apps-catalog.scigetorg.workers.dev/neuroimaging/apps.json',
			},
			microscopy: {
				title: 'microscopy',
				description: 'Microscopy tools.',
				defaultVersion: 'latest',
				appJsonUrl:
					'https://apps-catalog.scigetorg.workers.dev/microscopy/apps.json',
			},
		},
	});
	assert.deepEqual(domains, [
		{
			id: 'neuroimaging',
			label: 'Neuroimaging',
			title: 'neurodesk',
			description: 'Neuroimaging tools.',
			defaultVersion: '2026-09-23',
			appJsonUrl:
				'https://apps-catalog.scigetorg.workers.dev/neuroimaging/apps.json',
		},
		{
			id: 'microscopy',
			label: 'Microscopy',
			title: 'microscopy',
			description: 'Microscopy tools.',
			defaultVersion: 'latest',
			appJsonUrl:
				'https://apps-catalog.scigetorg.workers.dev/microscopy/apps.json',
		},
	]);
});

test('parseDomainsFeed rejects malformed, unapproved, or empty domain manifests', () => {
	const cases: Array<[string, unknown]> = [
		['not an object', []],
		['missing domains key', { schemaVersion: 1 }],
		['empty domains', { schemaVersion: 1, domains: {} }],
		[
			'missing appJsonUrl',
			{ domains: { microscopy: { title: 'microscopy' } } },
		],
		[
			'unapproved host',
			{
				domains: {
					microscopy: { appJsonUrl: 'https://untrusted.example/apps.json' },
				},
			},
		],
		[
			'non-https appJsonUrl',
			{
				domains: {
					microscopy: {
						appJsonUrl:
							'http://apps-catalog.scigetorg.workers.dev/microscopy/apps.json',
					},
				},
			},
		],
		[
			'invalid description',
			{
				domains: {
					microscopy: {
						appJsonUrl:
							'https://apps-catalog.scigetorg.workers.dev/microscopy/apps.json',
						description: 42,
					},
				},
			},
		],
	];
	for (const [label, payload] of cases) {
		assert.throws(() => parseDomainsFeed(payload), Error, label);
	}
});

test('every build of a tool carries its description, so search can match it', () => {
	const afni = list().filter((entry) => entry.name === 'afni');
	assert.equal(afni.length, 2);
	for (const entry of afni) {
		assert.equal(entry.description, 'Analysis of Functional NeuroImages');
	}
});

test('every build of a tool carries its feed citation, and blank citations are dropped', () => {
	const data = feed() as Record<string, any>;
	data.afni.citation = 'Cox RW (1996). AFNI. doi:10.1006/cbmr.1996.0014\n';
	data.amico.citation = '   ';
	const entries = toAppList(parseAppsFeed(data));
	for (const entry of entries.filter((entry) => entry.name === 'afni')) {
		assert.equal(
			entry.citation,
			'Cox RW (1996). AFNI. doi:10.1006/cbmr.1996.0014',
		);
	}
	for (const entry of entries.filter((entry) => entry.name !== 'afni')) {
		assert.equal('citation' in entry, false);
	}
});

test('OpenRecon tools are flagged and other tools are not', () => {
	const flagged = list()
		.filter((entry) => entry.openrecon)
		.map((entry) => entry.name);
	assert.deepEqual(flagged, ['musclemap']);
	assert.equal(
		list().find((entry) => entry.name === 'afni')?.openrecon,
		undefined,
	);
});

test('launchers sharing an image collapse to one entry and hidden launchers are dropped', () => {
	assert.deepEqual(
		list().map((entry) => entry.application),
		[
			'afni_24.3.00_20241003',
			'afni_26.3.11_20261101',
			'amico_2.1.0_arm64_20250101',
			'musclemap_1.0_20260601',
		],
	);
});

test('a hidden launcher does not hide a visible one built from the same image', () => {
	const data = feed() as Record<string, any>;
	data.afni.apps['sumaGUI-afni 24.3.00'].show_in_applist = false;
	const afni = toAppList(parseAppsFeed(data)).filter(
		(entry) => entry.name === 'afni',
	);
	assert.equal(afni.length, 2);
});

test('names come from the tool key, so versions may contain underscores', () => {
	const amico = list().find((entry) => entry.name === 'amico');
	assert.deepEqual(
		{
			name: amico?.name,
			version: amico?.version,
			build_date: amico?.build_date,
		},
		{ name: 'amico', version: '2.1.0_arm64', build_date: '20250101' },
	);
});

test('licenses and DOIs are kept per build', () => {
	const [older, newer] = list().filter((entry) => entry.name === 'afni');
	assert.deepEqual(older.license, ['GPL-3.0']);
	assert.equal(older.doi_url, 'https://doi.org/10.5281/zenodo.1');
	assert.deepEqual(newer.license, ['GPL-3.0', 'MIT']);
	assert.equal(newer.doi_url, undefined);
});

test('latestReleases reports the newest visible build of each tool', () => {
	const latest = latestReleases(list());
	assert.deepEqual(
		Object.fromEntries([...latest].map(([name, entry]) => [name, entry.version])),
		{ afni: '26.3.11', amico: '2.1.0_arm64', musclemap: '1.0' },
	);
});

test('malformed feeds and unsafe DOI URLs are rejected with source URL context', () => {
	const cases: Array<[string, (data: any) => unknown]> = [
		['not an object', () => []],
		['tool without apps', (data) => ({ ...data, afni: { categories: [] } })],
		[
			'categories not a list',
			(data) => ({ ...data, afni: { ...data.afni, categories: 'x' } }),
		],
		[
			'bad build date',
			(data) => (
				(data.afni.apps['afni 24.3.00'].version = '2024-10-03'),
				data
			),
		],
		[
			'image from another tool',
			(data) => ((data.afni.apps['afni 24.3.00'].image = 'fsl_6.0'), data),
		],
		[
			'image without a version',
			(data) => ((data.afni.apps['afni 24.3.00'].image = 'afni_'), data),
		],
		[
			'unsafe DOI URL',
			(data) => (
				(data.afni.apps['afni 24.3.00'].doi = 'javascript:alert(1)'),
				data
			),
		],
		[
			'license not a list',
			(data) => ((data.afni.apps['afni 24.3.00'].license = 'GPL-3.0'), data),
		],
		[
			'non-boolean visibility',
			(data) => (
				(data.afni.apps['afni 24.3.00'].show_in_applist = 'no'),
				data
			),
		],
		['non-string description', (data) => ((data.afni.description = 1), data)],
		['non-string citation', (data) => ((data.afni.citation = ['x']), data)],
	];
	for (const [label, mutate] of cases) {
		assert.throws(
			() =>
				parseAppsFeed(
					mutate(feed()),
					'https://example.test/neuroimaging/apps.json',
				),
			/https:\/\/example\.test\/neuroimaging\/apps\.json/,
			label,
		);
	}
});

test('a feed with nothing visible fails instead of publishing an empty catalog', () => {
	assert.throws(() => toAppList(parseAppsFeed({})), /no visible applications/);
	const hidden = {
		afni: {
			categories: [],
			apps: {
				a: { version: '20240101', image: 'afni_1', show_in_applist: false },
			},
		},
	};
	assert.throws(
		() => toAppList(parseAppsFeed(hidden)),
		/no visible applications/,
	);
});

test('fetchCatalog loads all domain feeds and allows an empty or unavailable domain when healthy catalogs exist', async () => {
	const warnings: string[] = [];
	const responses: Record<string, Response> = {
		'https://example.test/domains.json': new Response(
			JSON.stringify({
				schemaVersion: 1,
				domains: {
					neuroimaging: {
						title: 'neurodesk',
						description: 'Neuroimaging tools',
						defaultVersion: '2026-09-23',
						appJsonUrl: 'https://example.test/neuroimaging/apps.json',
					},
					microscopy: {
						title: 'microscopy',
						description: 'Microscopy tools',
						defaultVersion: 'latest',
						appJsonUrl: 'https://example.test/microscopy/apps.json',
					},
					genomics: {
						title: 'genomics',
						description: 'Coming soon',
						appJsonUrl: 'https://example.test/genomics/apps.json',
					},
					broken: {
						title: 'broken',
						description: 'Temporarily failing',
						appJsonUrl: 'https://example.test/broken/apps.json',
					},
				},
			}),
			{ status: 200, headers: { 'Content-Type': 'application/json' } },
		),
		'https://example.test/neuroimaging/apps.json': new Response(
			JSON.stringify(feed()),
			{ status: 200, headers: { 'Content-Type': 'application/json' } },
		),
		'https://example.test/microscopy/apps.json': new Response(
			JSON.stringify({
				nextpyp: {
					categories: ['cryo EM'],
					description: 'Cryo-EM processing',
					apps: {
						'nextpyp 0.7.3': {
							version: '20261118',
							image: 'nextpyp_0.7.3',
						},
					},
				},
			}),
			{ status: 200, headers: { 'Content-Type': 'application/json' } },
		),
		'https://example.test/genomics/apps.json': new Response(
			JSON.stringify({}),
			{ status: 200, headers: { 'Content-Type': 'application/json' } },
		),
		'https://example.test/broken/apps.json': new Response('Server Error', {
			status: 500,
		}),
	};

	const mockFetch = (async (input: string | URL | Request) => {
		const url = String(input);
		const res = responses[url];
		return res ? res.clone() : new Response('Not Found', { status: 404 });
	}) as typeof fetch;

	const catalog = await fetchCatalog({
		fetchImpl: mockFetch,
		domainsUrl: 'https://example.test/domains.json',
		retries: 0,
		onDomainError: (id, url, err) => warnings.push(`${id}:${url}:${err.message}`),
	});

	assert.deepEqual(
		catalog.domains.map((d) => ({
			id: d.id,
			label: d.label,
			count: d.list.length,
			unavailable: !!d.unavailable,
		})),
		[
			{ id: 'neuroimaging', label: 'Neuroimaging', count: 4, unavailable: false },
			{ id: 'microscopy', label: 'Microscopy', count: 1, unavailable: false },
			{ id: 'genomics', label: 'Genomics', count: 0, unavailable: false },
			{ id: 'broken', label: 'Broken', count: 0, unavailable: true },
		],
	);
	assert.equal(warnings.length, 1);
	assert.match(warnings[0], /^broken:https:\/\/example\.test\/broken\/apps\.json:/);
});

test('fetchCatalog blocks redirects to unapproved origins and fails closed when no catalogs succeed', async () => {
	const mockFetch = (async (input: string | URL | Request) => {
		const url = String(input);
		if (url === 'https://example.test/domains.json') {
			return new Response(
				JSON.stringify({
					domains: {
						neuroimaging: {
							appJsonUrl: 'https://example.test/redirect',
						},
					},
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } },
			);
		}
		if (url === 'https://example.test/redirect') {
			return new Response(null, {
				status: 302,
				headers: { location: 'https://untrusted.example/apps.json' },
			});
		}
		return new Response('Not Found', { status: 404 });
	}) as typeof fetch;

	await assert.rejects(
		() =>
			fetchCatalog({
				fetchImpl: mockFetch,
				domainsUrl: 'https://example.test/domains.json',
				retries: 0,
				onDomainError: () => {},
			}),
		/not in allowed catalog origins/,
	);
});

test('fetchCatalog isolates a malformed domain entry while still publishing healthy catalogs', async () => {
	const warnings: string[] = [];
	const fetchedUrls: string[] = [];
	const mockFetch = (async (input: string | URL | Request) => {
		const url = String(input);
		fetchedUrls.push(url);
		if (url === 'https://example.test/domains.json') {
			return new Response(
				JSON.stringify({
					domains: {
						neuroimaging: {
							title: 'neurodesk',
							appJsonUrl: 'https://example.test/neuroimaging/apps.json',
						},
						disallowed: {
							title: 'disallowed',
							appJsonUrl: 'https://untrusted.example/apps.json',
						},
					},
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } },
			);
		}
		if (url === 'https://example.test/neuroimaging/apps.json') {
			return new Response(JSON.stringify(feed()), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		}
		return new Response('Not Found', { status: 404 });
	}) as typeof fetch;

	const catalog = await fetchCatalog({
		fetchImpl: mockFetch,
		domainsUrl: 'https://example.test/domains.json',
		retries: 0,
		onDomainError: (id, url, err) => warnings.push(`${id}:${url}:${err.message}`),
	});

	assert.deepEqual(
		catalog.domains.map((d) => ({
			id: d.id,
			count: d.list.length,
			unavailable: !!d.unavailable,
		})),
		[
			{ id: 'neuroimaging', count: 4, unavailable: false },
			{ id: 'disallowed', count: 0, unavailable: true },
		],
	);
	assert.deepEqual(fetchedUrls, [
		'https://example.test/domains.json',
		'https://example.test/neuroimaging/apps.json',
	]);
	assert.equal(warnings.length, 1);
	assert.match(warnings[0], /not in allowed catalog origins/);
});

test('groupApps merges tools shared across multiple domain catalogs without duplicating builds', () => {
	const neuro = {
		id: 'neuroimaging',
		label: 'Neuroimaging',
		defaultVersion: '2026-09-23',
	};
	const micro = {
		id: 'microscopy',
		label: 'Microscopy',
		defaultVersion: 'latest',
	};
	const sharedEntry = {
		application: 'relion_5.0_20260101',
		name: 'relion',
		version: '5.0',
		build_date: '20260101',
		categories: ['cryo EM'],
		description: 'Cryo-EM structure determination',
		doi_url: 'https://doi.org/10.5281/zenodo.42',
		license: ['GPL-2.0'],
	};
	const grouped = groupApps(
		[
			{ entry: sharedEntry, domain: neuro },
			{
				entry: {
					...sharedEntry,
					categories: ['cryo EM', 'image reconstruction'],
				},
				domain: micro,
			},
		],
		false,
	);
	assert.equal(grouped.length, 1);
	assert.equal(grouped[0].versions.length, 1);
	assert.deepEqual(
		grouped[0].domains.map((d) => d.id),
		['neuroimaging', 'microscopy'],
	);
	assert.deepEqual(
		grouped[0].versions[0].domains.map((d) => d.id),
		['neuroimaging', 'microscopy'],
	);
	assert.deepEqual(grouped[0].categories, ['cryo EM', 'image reconstruction']);
});

test('isArm64Build and displayName classify both _arm64 tool and version suffixes', () => {
	const entries = list();
	assert.equal(
		isArm64Build(entries.find((e) => e.name === 'amico')!),
		true,
	);
	assert.equal(
		isArm64Build(entries.find((e) => e.name === 'afni')!),
		false,
	);
	assert.equal(displayName('topaz_arm64'), 'topaz');
	assert.equal(displayName('topaz'), 'topaz');
});

test('methodsText only cites a platform release verified for the newest build and owning domain', () => {
	const neuro = {
		id: 'neuroimaging',
		label: 'Neuroimaging',
		defaultVersion: '2026-09-23',
	};
	const micro = {
		id: 'microscopy',
		label: 'Microscopy',
		defaultVersion: 'latest',
	};

	// Build on 2026-06-01 predates release 2026-09-23 -> include v2026-09-23.
	const [musclemap] = groupApps(
		list()
			.filter((e) => e.name === 'musclemap')
			.map((entry) => ({ entry, domain: neuro })),
		false,
	);
	assert.match(
		methodsText(musclemap, 'neuroimaging'),
		/musclemap \(v1\.0, built 2026-06-01\) was run in Sciget \/ Neurodesk \(v2026-09-23, Renton et al\., 2024\)\./,
	);

	// Newest AFNI build (2026-11-01) postdates release 2026-09-23 -> omit v2026-09-23.
	const [afni] = groupApps(
		list()
			.filter((e) => e.name === 'afni')
			.map((entry) => ({ entry, domain: neuro })),
		false,
	);
	assert.match(
		methodsText(afni, 'neuroimaging'),
		/afni \(v26\.3\.11, built 2026-11-01\) was run in Sciget \/ Neurodesk \(Renton et al\., 2024\)\./,
	);

	// Tool with older build in neuroimaging and newer build only in microscopy:
	// in All domains (null), must NOT attach neuroimaging's release to microscopy's build.
	const [crossDomain] = groupApps(
		[
			{
				entry: {
					application: 'shared_1.0_20250101',
					name: 'shared',
					version: '1.0',
					build_date: '20250101',
					categories: ['cryo EM'],
				},
				domain: neuro,
			},
			{
				entry: {
					application: 'shared_2.0_20260501',
					name: 'shared',
					version: '2.0',
					build_date: '20260501',
					categories: ['cryo EM'],
				},
				domain: micro,
			},
		],
		false,
	);
	assert.match(
		methodsText(crossDomain, null),
		/shared \(v2\.0, built 2026-05-01\) was run in Sciget \/ Neurodesk \(Renton et al\., 2024\)\./,
	);
});
