import assert from 'node:assert/strict';
import test from 'node:test';
import {
	assertAllowedCatalogUrl,
	displayName,
	eessiLaunchCommand,
	eessiLoadCommand,
	fetchCatalog,
	formatDomainLabel,
	groupApps,
	groupEessiApps,
	isArm64Build,
	isEessiArm64Build,
	latestReleases,
	methodsText,
	normalizeDoiUrl,
	parseAppsFeed,
	parseDomainsFeed,
	parseEessiFeed,
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

const eessiFeed = () => ({
	schemaVersion: 1,
	backend: 'eessi',
	explicitSelectionRequired: true,
	cvmfsRepo: 'software.eessi.io',
	stacks: ['2025.06'],
	tools: {
		gromacs: {
			package: 'GROMACS',
			categories: ['molecular dynamics'],
			description: 'Molecular dynamics package',
			homepage: 'https://www.gromacs.org/',
			apps: {
				'GROMACS 2026.2 (EESSI/2025.06)': {
					backend: 'eessi',
					stack: '2025.06',
					module: 'GROMACS/2026.2-foss-2025b',
					software_version: '2026.2',
					toolchain: 'foss/2025b',
					arch: ['aarch64', 'x86_64'],
					gpu: false,
					license: ['LGPL-2.1'],
					exec: ['gmx'],
					gui: false,
					show_in_applist: true,
				},
				'GROMACS 2026.2 GPU (EESSI/2025.06)': {
					backend: 'eessi',
					stack: '2025.06',
					module: 'GROMACS/2026.2-foss-2025b-CUDA-12.9.1',
					software_version: '2026.2',
					toolchain: 'foss/2025b',
					arch: ['x86_64'],
					gpu: true,
					gpu_targets: ['nvidia/cc80'],
					license: ['LGPL-2.1'],
					exec: ['gmx'],
					gui: false,
					show_in_applist: true,
				},
			},
		},
		paraview: {
			package: 'ParaView',
			categories: ['visualization'],
			description: '3D visualization',
			homepage: 'javascript:alert(1)',
			apps: {
				'ParaView 6.0.1 (EESSI/2025.06)': {
					backend: 'eessi',
					stack: '2025.06',
					module: 'ParaView/6.0.1-foss-2025b',
					software_version: '6.0.1',
					arch: ['aarch64', 'x86_64'],
					gpu: false,
					exec: ['paraview'],
					gui: true,
					show_in_applist: true,
				},
			},
		},
	},
});

test('parseEessiFeed validates envelope, drops unsafe homepage URLs, and rejects malformed feeds', () => {
	const entries = parseEessiFeed(eessiFeed(), 'https://apps-catalog.scigetorg.workers.dev/neuroimaging/eessi.json');
	assert.equal(entries.length, 3);
	const paraview = entries.find((e) => e.id === 'paraview');
	assert.equal(paraview?.homepage, undefined);
	const gromacsCpu = entries.find((e) => e.id === 'gromacs' && !e.gpu);
	assert.equal(gromacsCpu?.homepage, 'https://www.gromacs.org/');
	assert.equal(isEessiArm64Build(gromacsCpu!), true);
	const gromacsGpu = entries.find((e) => e.id === 'gromacs' && e.gpu);
	assert.equal(isEessiArm64Build(gromacsGpu!), false);

	assert.throws(() => parseEessiFeed({ ...eessiFeed(), explicitSelectionRequired: false }), /invalid envelope/);
	assert.throws(() =>
		parseEessiFeed({
			...eessiFeed(),
			tools: {
				evil: {
					package: 'Evil',
					categories: ['programming'],
					apps: {
						Evil: {
							backend: 'eessi',
							stack: '2025.06',
							module: 'Evil/1.0',
							software_version: '1.0',
							arch: ['x86_64'],
							gpu: false,
							exec: ['sh', '-c;id'],
							gui: false,
						},
					},
				},
			},
		}),
	/malformed/);
});

test('groupEessiApps merges shared domains, orders CPU before GPU, and formats Lmod/launch commands', () => {
	const neuro = { id: 'neuroimaging', label: 'Neuroimaging' };
	const preclin = { id: 'preclinical', label: 'Preclinical' };
	const parsed = parseEessiFeed(eessiFeed());
	const grouped = groupEessiApps(
		[
			...parsed.map((entry) => ({ entry, domain: neuro })),
			...parsed.filter((e) => e.id === 'gromacs').map((entry) => ({ entry, domain: preclin })),
		],
		false,
	);
	assert.equal(grouped.length, 2);
	const gromacs = grouped.find((g) => g.id === 'gromacs')!;
	assert.equal(gromacs.hasGpu, true);
	assert.equal(gromacs.builds.length, 2);
	assert.equal(gromacs.builds[0].gpu, false);
	assert.equal(gromacs.builds[1].gpu, true);
	assert.deepEqual(
		gromacs.domains.map((d) => d.id),
		['neuroimaging', 'preclinical'],
	);
	assert.equal(
		eessiLoadCommand(gromacs.builds[0]),
		'module load EESSI/2025.06 && module load GROMACS/2026.2-foss-2025b',
	);
	assert.equal(
		eessiLaunchCommand(gromacs.builds[0]),
		'eessi-launch --stack 2025.06 -- GROMACS/2026.2-foss-2025b gmx',
	);

	// arm64 filter keeps only aarch64 builds.
	const armOnly = groupEessiApps(
		parsed.map((entry) => ({ entry, domain: neuro })),
		true,
	);
	assert.equal(armOnly.find((g) => g.id === 'gromacs')?.builds.length, 1);
});

test('fetchCatalog loads hybrid and EESSI-only domains while failing soft on EESSI outages', async () => {
	const domainsDoc = {
		schemaVersion: 1,
		domains: {
			neuroimaging: {
				title: 'neurodesk',
				appJsonUrl: 'https://apps-catalog.scigetorg.workers.dev/neuroimaging/apps.json',
				eessiCatalogUrl: 'https://apps-catalog.scigetorg.workers.dev/neuroimaging/eessi.json',
				eessi_stacks: ['2025.06'],
			},
			preclinical: {
				eessiCatalogUrl: 'https://apps-catalog.scigetorg.workers.dev/preclinical/eessi.json',
				eessi_stacks: ['2025.06'],
			},
			microscopy: {
				appJsonUrl: 'https://apps-catalog.scigetorg.workers.dev/microscopy/apps.json',
				eessiCatalogUrl: 'https://apps-catalog.scigetorg.workers.dev/microscopy/eessi.json',
				eessi_stacks: ['2025.06'],
			},
		},
	};
	const errors: string[] = [];
	const catalog = await fetchCatalog({
		retries: 0,
		onDomainError: (id, _url, err) => errors.push(`${id}:${err.message}`),
		fetchImpl: async (input) => {
			const url = String(input);
			if (url.endsWith('/domains.json')) return new Response(JSON.stringify(domainsDoc));
			if (url.endsWith('/apps.json')) return new Response(JSON.stringify(feed()));
			if (url.endsWith('/microscopy/eessi.json')) return new Response('down', { status: 503 });
			if (url.endsWith('/eessi.json')) return new Response(JSON.stringify(eessiFeed()));
			return new Response('not found', { status: 404 });
		},
	});
	assert.equal(catalog.domains.length, 3);
	const neuro = catalog.domains.find((d) => d.id === 'neuroimaging')!;
	assert.ok(neuro.list.length > 0);
	assert.equal(neuro.eessi?.length, 3);
	const preclin = catalog.domains.find((d) => d.id === 'preclinical')!;
	assert.equal(preclin.list.length, 0);
	assert.equal(preclin.unavailable, undefined);
	assert.equal(preclin.eessi?.length, 3);
	const micro = catalog.domains.find((d) => d.id === 'microscopy')!;
	assert.ok(micro.list.length > 0);
	assert.equal(micro.unavailable, undefined);
	assert.equal(micro.eessiUnavailable, true);
	assert.equal(errors.length, 1);
});

test('fetchCatalog succeeds when a hybrid domain container feed fails but its EESSI feed succeeds', async () => {
	const domainsDoc = {
		schemaVersion: 1,
		domains: {
			neuroimaging: {
				title: 'neurodesk',
				appJsonUrl: 'https://apps-catalog.scigetorg.workers.dev/neuroimaging/apps.json',
				eessiCatalogUrl: 'https://apps-catalog.scigetorg.workers.dev/neuroimaging/eessi.json',
				eessi_stacks: ['2025.06'],
			},
		},
	};
	const errors: string[] = [];
	const catalog = await fetchCatalog({
		retries: 0,
		onDomainError: (id, _url, err) => errors.push(`${id}:${err.message}`),
		fetchImpl: async (input) => {
			const url = String(input);
			if (url.endsWith('/domains.json')) return new Response(JSON.stringify(domainsDoc));
			if (url.endsWith('/apps.json')) return new Response('down', { status: 503 });
			if (url.endsWith('/eessi.json')) return new Response(JSON.stringify(eessiFeed()));
			return new Response('not found', { status: 404 });
		},
	});
	assert.equal(catalog.domains.length, 1);
	assert.equal(catalog.domains[0].unavailable, true);
	assert.equal(catalog.domains[0].list.length, 0);
	assert.equal(catalog.domains[0].eessiUnavailable, undefined);
	assert.equal(catalog.domains[0].eessi?.length, 3);
	assert.equal(errors.length, 1);
});

test('fetchCatalog isolates invalid optional EESSI domain config without suppressing healthy containers', async () => {
	const domainsDoc = {
		schemaVersion: 1,
		domains: {
			neuroimaging: {
				title: 'neurodesk',
				appJsonUrl: 'https://apps-catalog.scigetorg.workers.dev/neuroimaging/apps.json',
				eessiCatalogUrl: 'https://untrusted.example/neuroimaging/eessi.json',
				eessi_stacks: ['2025.06'],
			},
			microscopy: {
				title: 'microdesktop',
				appJsonUrl: 'https://apps-catalog.scigetorg.workers.dev/microscopy/apps.json',
				eessiCatalogUrl: 'https://apps-catalog.scigetorg.workers.dev/microscopy/eessi.json',
				eessi_stacks: ['not-a-stack'],
			},
		},
	};
	const fetched: string[] = [];
	const errors: string[] = [];
	const catalog = await fetchCatalog({
		retries: 0,
		onDomainError: (id, _url, err) => errors.push(`${id}:${err.message}`),
		fetchImpl: async (input) => {
			const url = String(input);
			fetched.push(url);
			if (url.endsWith('/domains.json')) return new Response(JSON.stringify(domainsDoc));
			if (url.endsWith('/apps.json')) return new Response(JSON.stringify(feed()));
			return new Response('not found', { status: 404 });
		},
	});
	assert.equal(catalog.domains.length, 2);
	for (const domain of catalog.domains) {
		assert.ok(domain.list.length > 0);
		assert.equal(domain.unavailable, undefined);
		assert.equal(domain.eessiUnavailable, true);
		assert.equal(domain.eessi, undefined);
	}
	assert.ok(!fetched.some((u) => u.includes('eessi.json')));
	assert.equal(errors.length, 2);
});

test('parseEessiFeed rejects builds on undeclared feed stacks or outside domain eessi_stacks', () => {
	const wrongStackFeed = {
		...eessiFeed(),
		stacks: ['2025.06'],
		tools: {
			paraview: {
				package: 'ParaView',
				categories: ['visualization'],
				apps: {
					'ParaView 5.12 (EESSI/2023.06)': {
						backend: 'eessi',
						stack: '2023.06',
						module: 'ParaView/5.12.0-foss-2023b',
						software_version: '5.12.0',
						arch: ['x86_64'],
						gpu: false,
						exec: ['paraview'],
						gui: true,
					},
				},
			},
		},
	};
	assert.throws(() => parseEessiFeed(wrongStackFeed), /malformed/);
	assert.throws(
		() => parseEessiFeed(eessiFeed(), undefined, ['2023.06']),
		/malformed/,
	);
});

test('fetchCatalog isolates invalid container URL on a hybrid domain, keeps EESSI-only outage flags separate, and fetches hybrid feeds in parallel', async () => {
	const domainsDoc = {
		schemaVersion: 1,
		domains: {
			hybridBadApp: {
				title: 'hybrid',
				appJsonUrl: 'https://untrusted.example/hybrid/apps.json',
				eessiCatalogUrl: 'https://apps-catalog.scigetorg.workers.dev/hybrid/eessi.json',
				eessi_stacks: ['2025.06'],
			},
			eessiOnlyDown: {
				eessiCatalogUrl: 'https://apps-catalog.scigetorg.workers.dev/down/eessi.json',
				eessi_stacks: ['2025.06'],
			},
			parallelDomain: {
				appJsonUrl: 'https://apps-catalog.scigetorg.workers.dev/parallel/apps.json',
				eessiCatalogUrl: 'https://apps-catalog.scigetorg.workers.dev/parallel/eessi.json',
				eessi_stacks: ['2025.06'],
			},
		},
	};
	let releaseApps!: () => void;
	const appsGate = new Promise<void>((resolve) => {
		releaseApps = resolve;
	});
	let eessiRequestedWhileAppsPending = false;
	const errors: string[] = [];
	const catalog = await fetchCatalog({
		retries: 0,
		onDomainError: (id, _url, err) => errors.push(`${id}:${err.message}`),
		fetchImpl: async (input) => {
			const url = String(input);
			if (url.endsWith('/domains.json')) return new Response(JSON.stringify(domainsDoc));
			if (url.endsWith('/parallel/apps.json')) {
				await appsGate;
				return new Response(JSON.stringify(feed()));
			}
			if (url.endsWith('/parallel/eessi.json')) {
				eessiRequestedWhileAppsPending = true;
				releaseApps();
				return new Response(JSON.stringify(eessiFeed()));
			}
			if (url.endsWith('/hybrid/eessi.json')) {
				return new Response(JSON.stringify(eessiFeed()));
			}
			if (url.endsWith('/down/eessi.json')) {
				return new Response('down', { status: 503 });
			}
			return new Response('not found', { status: 404 });
		},
	});
	assert.equal(eessiRequestedWhileAppsPending, true);
	const hybrid = catalog.domains.find((d) => d.id === 'hybridBadApp')!;
	assert.equal(hybrid.unavailable, true);
	assert.equal(hybrid.list.length, 0);
	assert.equal(hybrid.eessiUnavailable, undefined);
	assert.equal(hybrid.eessi?.length, 3);
	const down = catalog.domains.find((d) => d.id === 'eessiOnlyDown')!;
	assert.equal(down.unavailable, undefined);
	assert.equal(down.eessiUnavailable, true);
	assert.equal(errors.length, 2);
});
