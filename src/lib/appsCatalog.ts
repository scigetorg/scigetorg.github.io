// Build-time view of the Sciget multi-domain application catalogs.
// domains.json (published by scigetorg/apps-catalog) lists every active domain
// catalog and its apps.json feed URL. Feeds are restricted to approved HTTPS
// origins, fetched with bounded timeouts, and validated at build time.

export const DOMAINS_JSON_URL =
	'https://apps-catalog.scigetorg.workers.dev/domains.json';

export const ALLOWED_CATALOG_ORIGINS: readonly string[] = [
	new URL(DOMAINS_JSON_URL).origin,
];

export const FETCH_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;
const RETRY_DELAY_MS = 500;
const DOI_PATH_PATTERN = /^10\.\d{4,9}\/[^\s<>"]+$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EESSI_STACK_PATTERN = /^\d{4}\.\d{2}$/;
const EESSI_MODULE_PATTERN =
	/^[A-Za-z0-9][A-Za-z0-9._+-]*\/[A-Za-z0-9][A-Za-z0-9._+-]*$/;
const EESSI_EXEC_ARG_PATTERN = /^[A-Za-z0-9._/@:+=-]{1,128}$/;

export interface AppListEntry {
	/** `<image>_<build_date>`, kept compatible with Neurodesk's applist.json schema. */
	application: string;
	/** The apps.json tool key. */
	name: string;
	version: string;
	/** YYYYMMDD */
	build_date: string;
	categories: string[];
	doi_url?: string;
	license?: string[];
	description?: string;
	citation?: string;
	openrecon?: boolean;
}

export interface EessiAppEntry {
	/** Tool key in eessi.json (e.g. `paraview`). */
	id: string;
	/** Upstream EasyBuild package name (e.g. `ParaView`). */
	package: string;
	/** Display label from eessi.json (e.g. `ParaView 6.0.1 (EESSI/2025.06)`). */
	label: string;
	stack: string;
	module: string;
	version: string;
	toolchain?: string;
	arch: string[];
	gpu: boolean;
	gpuTargets?: string[];
	license?: string[];
	description?: string;
	homepage?: string;
	categories: string[];
	exec: string[];
	gui: boolean;
	terminal?: boolean;
}

export interface DomainDefinition {
	id: string;
	label: string;
	title?: string;
	description?: string;
	defaultVersion?: string;
	appJsonUrl?: string;
	eessiCatalogUrl?: string;
	eessiStacks?: string[];
}

export interface DomainCatalog {
	id: string;
	label: string;
	title?: string;
	description?: string;
	defaultVersion?: string;
	list: AppListEntry[];
	eessi?: EessiAppEntry[];
	/** Set when this domain's container feed failed during build while other catalogs succeeded. */
	unavailable?: boolean;
	/** Set when this domain's EESSI feed failed during build. */
	eessiUnavailable?: boolean;
}

export interface AppsCatalogPayload {
	domains: DomainCatalog[];
}

export interface EessiDomainEntry {
	entry: EessiAppEntry;
	domain: DomainBadgeInfo;
}

export interface EessiBuild {
	label: string;
	stack: string;
	module: string;
	version: string;
	toolchain?: string;
	arch: string[];
	gpu: boolean;
	gpuTargets?: string[];
	license?: string[];
	exec: string[];
	gui: boolean;
	terminal?: boolean;
	domains: DomainBadgeInfo[];
}

export interface GroupedEessiApp {
	id: string;
	name: string;
	description?: string;
	homepage?: string;
	categories: string[];
	domains: DomainBadgeInfo[];
	builds: EessiBuild[];
	hasGpu: boolean;
	arm64: boolean;
}

export interface AppVersion {
	version: string;
	buildDate: string;
	doiUrl?: string;
	license?: string[];
	domains: DomainBadgeInfo[];
}

export interface DomainBadgeInfo {
	id: string;
	label: string;
	defaultVersion?: string;
}

export interface DomainEntry {
	entry: AppListEntry;
	domain: DomainBadgeInfo;
}

export interface GroupedApp {
	name: string;
	description?: string;
	citation?: string;
	categories: string[];
	domains: DomainBadgeInfo[];
	versions: AppVersion[];
	openrecon: boolean;
	arm64: boolean;
}

export const NEURODESK_REFERENCE =
	'Renton, A.I., Dao, T.T., Johnstone, T., Civier, O., Sullivan, R. P., White, D. J., ... Narayanan, A. & Bollmann, S. Neurodesk: an accessible, flexible and portable data analysis environment for reproducible neuroimaging. Nat Methods (2024). https://doi.org/10.1038/s41592-023-02145-x';

// arm64 builds are published either as separate `<tool>_arm64` tools or as
// `<version>_arm64` builds of an unsuffixed tool, so classify each build.
const ARM64_SUFFIX = '_arm64';

export function isArm64Build(entry: AppListEntry): boolean {
	return (
		entry.name.endsWith(ARM64_SUFFIX) || entry.version.endsWith(ARM64_SUFFIX)
	);
}

/** Card name for a build: `amico_arm64` and `amico` share the `amico` card. */
export function displayName(name: string): string {
	return name.endsWith(ARM64_SUFFIX)
		? name.slice(0, -ARM64_SUFFIX.length)
		: name;
}

export function formatBuildDate(raw: string): string {
	if (raw.length === 8) {
		return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
	}
	return raw;
}

/**
 * Groups catalog entries into one card per tool, preserving domain provenance
 * per build and deduplicating builds shared across multiple domain catalogs.
 */
export function groupApps(items: DomainEntry[], arm64: boolean): GroupedApp[] {
	const map = new Map<string, GroupedApp>();
	const versionMaps = new Map<string, Map<string, AppVersion>>();

	for (const { entry, domain } of items) {
		const { version } = entry;
		const name = displayName(entry.name);
		const buildDate = formatBuildDate(entry.build_date);
		const versionKey = `${version}\0${buildDate}`;

		let existing = map.get(name);
		let versionsByKey = versionMaps.get(name);

		if (!existing || !versionsByKey) {
			versionsByKey = new Map<string, AppVersion>();
			versionMaps.set(name, versionsByKey);
			existing = {
				name,
				description: entry.description,
				citation: entry.citation,
				categories: [...entry.categories],
				domains: [domain],
				versions: [],
				openrecon: !!entry.openrecon,
				arm64,
			};
			map.set(name, existing);
		} else {
			if (entry.openrecon) existing.openrecon = true;
			if (!existing.description) existing.description = entry.description;
			if (!existing.citation) existing.citation = entry.citation;
			if (!existing.domains.some((d) => d.id === domain.id)) {
				existing.domains.push(domain);
			}
			for (const cat of entry.categories) {
				if (!existing.categories.includes(cat)) {
					existing.categories.push(cat);
				}
			}
		}

		const existingVersion = versionsByKey.get(versionKey);
		if (existingVersion) {
			if (!existingVersion.doiUrl && entry.doi_url) {
				existingVersion.doiUrl = entry.doi_url;
			}
			if (!existingVersion.license?.length && entry.license?.length) {
				existingVersion.license = entry.license;
			}
			if (!existingVersion.domains.some((d) => d.id === domain.id)) {
				existingVersion.domains.push(domain);
			}
		} else {
			const versionEntry: AppVersion = {
				version,
				buildDate,
				doiUrl: entry.doi_url,
				license: entry.license,
				domains: [domain],
			};
			versionsByKey.set(versionKey, versionEntry);
			existing.versions.push(versionEntry);
		}
	}

	for (const app of map.values()) {
		app.versions.sort((a, b) => b.buildDate.localeCompare(a.buildDate));
	}

	return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Generates a reproducible methods sentence for the newest build of an app.
 * A domain platform release is included only when that specific build belongs
 * unambiguously to a domain with a dated release at or after the build date.
 */
export function methodsText(
	app: GroupedApp,
	activeDomainId: string | null,
): string {
	const latest = app.versions[0];
	const { version, buildDate } = latest;
	const owningDomain =
		activeDomainId !== null
			? latest.domains.find((d) => d.id === activeDomainId)
			: latest.domains.length === 1
				? latest.domains[0]
				: undefined;
	const release = owningDomain?.defaultVersion;
	const platformVersion =
		release &&
		ISO_DATE_PATTERN.test(release) &&
		ISO_DATE_PATTERN.test(buildDate) &&
		buildDate <= release
			? `v${release}, `
			: '';
	const references = [app.citation, NEURODESK_REFERENCE].filter(Boolean);
	return `${app.name} (v${version}, built ${buildDate}) was run in Sciget / Neurodesk (${platformVersion}Renton et al., 2024).\n\nReferences:\n${references.join('\n\n')}`;
}

export function isEessiArm64Build(entry: EessiAppEntry): boolean {
	return entry.arch.includes('aarch64');
}

export function eessiLoadCommand(build: Pick<EessiBuild, 'stack' | 'module'>): string {
	return `module load EESSI/${build.stack} && module load ${build.module}`;
}

export function eessiLaunchCommand(
	build: Pick<EessiBuild, 'stack' | 'module' | 'exec'>,
): string | null {
	if (!build.exec.length) return null;
	return `eessi-launch --stack ${build.stack} -- ${build.module} ${build.exec.join(' ')}`;
}

/**
 * Groups curated EESSI entries into one card per tool, preserving domain
 * provenance and deduplicating builds shared across multiple domains.
 */
export function groupEessiApps(
	items: EessiDomainEntry[],
	arm64Only: boolean,
): GroupedEessiApp[] {
	const map = new Map<string, GroupedEessiApp>();
	const buildMaps = new Map<string, Map<string, EessiBuild>>();

	for (const { entry, domain } of items) {
		if (arm64Only && !isEessiArm64Build(entry)) continue;
		const buildKey = `${entry.stack}\0${entry.module}\0${entry.exec.join(' ')}`;
		let existing = map.get(entry.id);
		let buildsByKey = buildMaps.get(entry.id);

		if (!existing || !buildsByKey) {
			buildsByKey = new Map<string, EessiBuild>();
			buildMaps.set(entry.id, buildsByKey);
			existing = {
				id: entry.id,
				name: entry.package,
				description: entry.description,
				homepage: entry.homepage,
				categories: [...entry.categories],
				domains: [domain],
				builds: [],
				hasGpu: entry.gpu,
				arm64: isEessiArm64Build(entry),
			};
			map.set(entry.id, existing);
		} else {
			if (!existing.description && entry.description) {
				existing.description = entry.description;
			}
			if (!existing.homepage && entry.homepage) {
				existing.homepage = entry.homepage;
			}
			if (entry.gpu) existing.hasGpu = true;
			if (isEessiArm64Build(entry)) existing.arm64 = true;
			if (!existing.domains.some((d) => d.id === domain.id)) {
				existing.domains.push(domain);
			}
			for (const cat of entry.categories) {
				if (!existing.categories.includes(cat)) {
					existing.categories.push(cat);
				}
			}
		}

		const existingBuild = buildsByKey.get(buildKey);
		if (existingBuild) {
			if (!existingBuild.domains.some((d) => d.id === domain.id)) {
				existingBuild.domains.push(domain);
			}
			if (!existingBuild.license?.length && entry.license?.length) {
				existingBuild.license = entry.license;
			}
		} else {
			const buildEntry: EessiBuild = {
				label: entry.label,
				stack: entry.stack,
				module: entry.module,
				version: entry.version,
				toolchain: entry.toolchain,
				arch: [...entry.arch],
				gpu: entry.gpu,
				gpuTargets: entry.gpuTargets ? [...entry.gpuTargets] : undefined,
				license: entry.license ? [...entry.license] : undefined,
				exec: [...entry.exec],
				gui: entry.gui,
				terminal: entry.terminal,
				domains: [domain],
			};
			buildsByKey.set(buildKey, buildEntry);
			existing.builds.push(buildEntry);
		}
	}

	for (const app of map.values()) {
		app.builds.sort((a, b) => {
			const stackDiff = b.stack.localeCompare(a.stack);
			if (stackDiff !== 0) return stackDiff;
			if (a.gpu !== b.gpu) return a.gpu ? 1 : -1;
			return a.module.localeCompare(b.module);
		});
	}

	return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

interface FeedApp {
	image: string;
	version: string;
	doi?: string;
	license?: string[];
	show_in_applist?: boolean;
}

interface FeedTool {
	description?: string;
	citation?: string;
	openrecon?: boolean;
	apps: Record<string, FeedApp>;
	categories: string[];
}

export type AppsFeed = Record<string, FeedTool>;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
	return (
		Array.isArray(value) &&
		value.every((item) => typeof item === 'string' && item !== '')
	);
}

function optional<T>(
	value: unknown,
	guard: (value: unknown) => value is T,
): value is T | undefined {
	return value === undefined || guard(value);
}

const isString = (value: unknown): value is string => typeof value === 'string';
const isBoolean = (value: unknown): value is boolean =>
	typeof value === 'boolean';

export function assertAllowedCatalogUrl(
	raw: unknown,
	allowedOrigins: readonly string[] = ALLOWED_CATALOG_ORIGINS,
	context = 'catalog URL',
): URL {
	if (typeof raw !== 'string' || !raw) {
		throw new Error(`${context} must be an HTTPS URL`);
	}
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		throw new Error(`${context} is not a valid URL: ${raw}`);
	}
	if (url.protocol !== 'https:') {
		throw new Error(`${context} must use https: ${raw}`);
	}
	if (!allowedOrigins.includes(url.origin)) {
		throw new Error(
			`${context} origin ${url.origin} is not in allowed catalog origins`,
		);
	}
	return url;
}

/** Validates and normalizes container DOI values to canonical `https://doi.org/...` URLs. */
export function normalizeDoiUrl(raw: string): string | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;
	if (DOI_PATH_PATTERN.test(trimmed)) {
		return `https://doi.org/${trimmed}`;
	}
	let url: URL;
	try {
		url = new URL(trimmed);
	} catch {
		return null;
	}
	if (url.protocol !== 'https:') return null;
	if (url.hostname !== 'doi.org' && url.hostname !== 'dx.doi.org') return null;
	const doiPath = url.pathname.replace(/^\/+/, '');
	if (!DOI_PATH_PATTERN.test(doiPath)) return null;
	return `https://doi.org/${doiPath}`;
}

/** Formats a domain slug like `neuroimaging` or `cellular-biology` for display. */
export function formatDomainLabel(id: string): string {
	return id
		.split(/[-_]+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

function normalizeExternalUrl(raw: string): string | undefined {
	const trimmed = raw.trim();
	if (!trimmed) return undefined;
	try {
		const parsed = new URL(trimmed);
		if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
			return parsed.href;
		}
	} catch {
		return undefined;
	}
	return undefined;
}

function parseDomainEntry(
	id: string,
	entry: unknown,
	allowedOrigins: readonly string[],
	sourceUrl?: string,
): DomainDefinition {
	const source = sourceUrl ? ` (${sourceUrl})` : '';
	if (!id.trim() || !isRecord(entry)) {
		throw new Error(`domains.json${source} domain "${id}" is malformed`);
	}
	const appJsonUrl =
		entry.appJsonUrl !== undefined
			? assertAllowedCatalogUrl(
					entry.appJsonUrl,
					allowedOrigins,
					`domains.json${source} domain "${id}" appJsonUrl`,
				).href
			: undefined;
	const eessiCatalogUrl =
		entry.eessiCatalogUrl !== undefined
			? assertAllowedCatalogUrl(
					entry.eessiCatalogUrl,
					allowedOrigins,
					`domains.json${source} domain "${id}" eessiCatalogUrl`,
				).href
			: undefined;
	if (!appJsonUrl && !eessiCatalogUrl) {
		throw new Error(
			`domains.json${source} domain "${id}" must define appJsonUrl or eessiCatalogUrl`,
		);
	}
	const { title, description, defaultVersion, eessi_stacks } = entry;
	if (
		!optional(title, isString) ||
		!optional(description, isString) ||
		!optional(defaultVersion, isString)
	) {
		throw new Error(
			`domains.json${source} domain "${id}" has an invalid title, description or defaultVersion`,
		);
	}
	let eessiStacks: string[] | undefined;
	if (eessi_stacks !== undefined) {
		if (
			!isStringArray(eessi_stacks) ||
			!eessi_stacks.length ||
			eessi_stacks.some((stack) => !EESSI_STACK_PATTERN.test(stack))
		) {
			throw new Error(
				`domains.json${source} domain "${id}" has invalid eessi_stacks`,
			);
		}
		eessiStacks = [...eessi_stacks];
	}
	return {
		id,
		label: formatDomainLabel(id),
		...(title ? { title } : {}),
		...(description ? { description } : {}),
		...(defaultVersion ? { defaultVersion } : {}),
		...(appJsonUrl ? { appJsonUrl } : {}),
		...(eessiCatalogUrl ? { eessiCatalogUrl } : {}),
		...(eessiStacks ? { eessiStacks } : {}),
	};
}

export function parseDomainsFeed(
	data: unknown,
	allowedOrigins: readonly string[] = ALLOWED_CATALOG_ORIGINS,
	sourceUrl?: string,
): DomainDefinition[] {
	const source = sourceUrl ? ` (${sourceUrl})` : '';
	if (!isRecord(data) || !isRecord(data.domains)) {
		throw new Error(`domains.json${source} must contain a domains object`);
	}
	const definitions = Object.entries(data.domains).map(([id, entry]) =>
		parseDomainEntry(id, entry, allowedOrigins, sourceUrl),
	);
	if (!definitions.length) {
		throw new Error(`domains.json${source} lists no domains`);
	}
	return definitions;
}

export function parseAppsFeed(data: unknown, sourceUrl?: string): AppsFeed {
	const source = sourceUrl ? ` (${sourceUrl})` : '';
	if (!isRecord(data)) {
		throw new Error(`apps.json${source} must be an object of tools`);
	}
	const parsed: AppsFeed = {};
	for (const [tool, entry] of Object.entries(data)) {
		if (
			!isRecord(entry) ||
			!isRecord(entry.apps) ||
			!isStringArray(entry.categories)
		) {
			throw new Error(
				`apps.json${source} tool "${tool}" needs an apps object and a categories list`,
			);
		}
		const { description, citation, openrecon } = entry;
		if (
			!optional(description, isString) ||
			!optional(citation, isString) ||
			!optional(openrecon, isBoolean)
		) {
			throw new Error(
				`apps.json${source} tool "${tool}" has an invalid description, citation or openrecon flag`,
			);
		}
		const parsedApps: Record<string, FeedApp> = {};
		for (const [name, app] of Object.entries(entry.apps)) {
			if (!isRecord(app)) {
				throw new Error(`apps.json${source} app "${tool}/${name}" is malformed`);
			}
			const { image, version, doi, license, show_in_applist } = app;
			if (
				typeof image !== 'string' ||
				!image.startsWith(`${tool}_`) ||
				image.length === tool.length + 1 ||
				typeof version !== 'string' ||
				!/^\d{8}$/.test(version) ||
				!optional(doi, isString) ||
				!optional(license, isStringArray) ||
				!optional(show_in_applist, isBoolean)
			) {
				throw new Error(`apps.json${source} app "${tool}/${name}" is malformed`);
			}
			let normalizedDoi: string | undefined;
			if (doi !== undefined && doi.trim() !== '') {
				const validDoi = normalizeDoiUrl(doi);
				if (!validDoi) {
					throw new Error(
						`apps.json${source} app "${tool}/${name}" has an invalid DOI: ${doi}`,
					);
				}
				normalizedDoi = validDoi;
			}
			parsedApps[name] = {
				image,
				version,
				...(normalizedDoi ? { doi: normalizedDoi } : {}),
				...(license ? { license } : {}),
				...(show_in_applist !== undefined ? { show_in_applist } : {}),
			};
		}
		parsed[tool] = {
			apps: parsedApps,
			categories: entry.categories,
			...(description !== undefined ? { description } : {}),
			...(citation !== undefined ? { citation } : {}),
			...(openrecon !== undefined ? { openrecon } : {}),
		};
	}
	return parsed;
}

export function parseEessiFeed(
	data: unknown,
	sourceUrl?: string,
): EessiAppEntry[] {
	const source = sourceUrl ? ` (${sourceUrl})` : '';
	if (!isRecord(data)) {
		throw new Error(`eessi.json${source} must be an object`);
	}
	if (
		data.schemaVersion !== 1 ||
		data.backend !== 'eessi' ||
		data.explicitSelectionRequired !== true ||
		typeof data.cvmfsRepo !== 'string' ||
		!isStringArray(data.stacks) ||
		!data.stacks.length ||
		data.stacks.some((s) => !EESSI_STACK_PATTERN.test(s)) ||
		!isRecord(data.tools)
	) {
		throw new Error(`eessi.json${source} has an invalid envelope`);
	}
	const entries: EessiAppEntry[] = [];
	for (const [id, rawTool] of Object.entries(data.tools)) {
		if (
			!isRecord(rawTool) ||
			typeof rawTool.package !== 'string' ||
			!rawTool.package.trim() ||
			!isStringArray(rawTool.categories) ||
			!isRecord(rawTool.apps)
		) {
			throw new Error(`eessi.json${source} tool "${id}" is malformed`);
		}
		if (
			!optional(rawTool.description, isString) ||
			!optional(rawTool.homepage, isString)
		) {
			throw new Error(
				`eessi.json${source} tool "${id}" has an invalid description or homepage`,
			);
		}
		const description = rawTool.description?.trim() || undefined;
		const homepage = rawTool.homepage
			? normalizeExternalUrl(rawTool.homepage)
			: undefined;

		for (const [label, rawApp] of Object.entries(rawTool.apps)) {
			if (!isRecord(rawApp)) {
				throw new Error(
					`eessi.json${source} app "${id}/${label}" is malformed`,
				);
			}
			const {
				backend,
				stack,
				module,
				software_version,
				toolchain,
				arch,
				gpu,
				gpu_targets,
				license,
				exec,
				gui,
				terminal,
				show_in_applist,
			} = rawApp;
			if (
				backend !== 'eessi' ||
				typeof stack !== 'string' ||
				!EESSI_STACK_PATTERN.test(stack) ||
				typeof module !== 'string' ||
				!EESSI_MODULE_PATTERN.test(module) ||
				typeof software_version !== 'string' ||
				!software_version.trim() ||
				!optional(toolchain, isString) ||
				!isStringArray(arch) ||
				typeof gpu !== 'boolean' ||
				!optional(gpu_targets, isStringArray) ||
				!optional(license, isStringArray) ||
				!Array.isArray(exec) ||
				!exec.every(
					(arg) => typeof arg === 'string' && EESSI_EXEC_ARG_PATTERN.test(arg),
				) ||
				typeof gui !== 'boolean' ||
				!optional(terminal, isBoolean) ||
				!optional(show_in_applist, isBoolean)
			) {
				throw new Error(
					`eessi.json${source} app "${id}/${label}" is malformed`,
				);
			}
			if (show_in_applist === false) continue;
			entries.push({
				id,
				package: rawTool.package.trim(),
				label,
				stack,
				module,
				version: software_version.trim(),
				...(toolchain ? { toolchain } : {}),
				arch: [...arch],
				gpu,
				...(gpu_targets?.length ? { gpuTargets: [...gpu_targets] } : {}),
				...(license?.length ? { license: [...license] } : {}),
				...(description ? { description } : {}),
				...(homepage ? { homepage } : {}),
				categories: [...rawTool.categories],
				exec: [...exec],
				gui,
				...(terminal !== undefined ? { terminal } : {}),
			});
		}
	}
	return entries.sort((a, b) =>
		`${a.id}\0${b.stack}\0${a.module}`.localeCompare(
			`${b.id}\0${a.stack}\0${b.module}`,
		),
	);
}

export interface ToAppListOptions {
	allowEmpty?: boolean;
	sourceUrl?: string;
}

/**
 * One entry per published image build. Launchers that share an image (for
 * example afni and sumaGUI-afni) collapse to one entry; hidden launchers are
 * dropped. Throws when nothing is left to list unless `allowEmpty` is set.
 */
export function toAppList(
	feed: AppsFeed,
	options: ToAppListOptions = {},
): AppListEntry[] {
	const entries = new Map<string, AppListEntry>();
	for (const [tool, { apps, categories, ...feedMetadata }] of Object.entries(
		feed,
	)) {
		const description = feedMetadata.description?.trim();
		const openrecon = feedMetadata.openrecon;
		const citation = feedMetadata.citation?.trim();
		for (const app of Object.values(apps)) {
			if (app.show_in_applist === false) continue;
			const application = `${app.image}_${app.version}`;
			if (entries.has(application)) continue;
			// Images are `<tool>_<version>`, and the version may itself contain
			// underscores (amico_2.1.0_arm64, kul-vbg_0.61.0_23112021_beta).
			const version = app.image.slice(tool.length + 1);
			entries.set(application, {
				application,
				name: tool,
				version,
				build_date: app.version,
				categories: [...categories],
				...(app.doi ? { doi_url: app.doi } : {}),
				...(app.license?.length ? { license: [...app.license] } : {}),
				...(description ? { description } : {}),
				...(citation ? { citation } : {}),
				...(openrecon ? { openrecon } : {}),
			});
		}
	}
	if (!entries.size && !options.allowEmpty) {
		const source = options.sourceUrl ? ` (${options.sourceUrl})` : '';
		throw new Error(`apps.json${source} lists no visible applications`);
	}
	return [...entries.values()].sort((a, b) =>
		a.application.localeCompare(b.application),
	);
}

/** Newest build per application, as shown first on its browser card. */
export function latestReleases(
	entries: AppListEntry[],
): Map<string, AppListEntry> {
	const latest = new Map<string, AppListEntry>();
	for (const entry of entries) {
		const current = latest.get(entry.name);
		if (!current || entry.build_date > current.build_date) {
			latest.set(entry.name, entry);
		}
	}
	return latest;
}

export interface FetchCatalogOptions {
	fetchImpl?: typeof fetch;
	domainsUrl?: string;
	allowedOrigins?: readonly string[];
	timeoutMs?: number;
	retries?: number;
	onDomainError?: (domainId: string, url: string, error: Error) => void;
}

function isRedirectStatus(status: number): boolean {
	return (
		status === 301 ||
		status === 302 ||
		status === 303 ||
		status === 307 ||
		status === 308
	);
}

function isRetryableStatus(status: number): boolean {
	return status === 408 || status === 429 || status >= 500;
}

async function fetchAllowedJson(
	rawUrl: string,
	{
		fetchImpl,
		allowedOrigins,
		timeoutMs,
		retries,
	}: {
		fetchImpl: typeof fetch;
		allowedOrigins: readonly string[];
		timeoutMs: number;
		retries: number;
	},
): Promise<unknown> {
	let lastError: Error | undefined;
	for (let attempt = 0; attempt <= retries; attempt++) {
		try {
			let currentUrl = assertAllowedCatalogUrl(
				rawUrl,
				allowedOrigins,
				'catalog feed URL',
			).href;
			for (let redirects = 0; ; redirects++) {
				const response = await fetchImpl(currentUrl, {
					redirect: 'manual',
					signal: AbortSignal.timeout(timeoutMs),
				});
				if (isRedirectStatus(response.status)) {
					if (redirects >= MAX_REDIRECTS) {
						throw new Error(`Too many redirects while fetching ${rawUrl}`);
					}
					const location = response.headers.get('location');
					if (!location) {
						throw new Error(
							`Redirect (${response.status}) from ${currentUrl} missing Location header`,
						);
					}
					currentUrl = assertAllowedCatalogUrl(
						new URL(location, currentUrl).href,
						allowedOrigins,
						`redirect target from ${currentUrl}`,
					).href;
					continue;
				}
				if (!response.ok) {
					const err = new Error(
						`Failed to fetch ${currentUrl}: HTTP ${response.status}`,
					);
					if (isRetryableStatus(response.status) && attempt < retries) {
						lastError = err;
						break;
					}
					throw err;
				}
				try {
					return await response.json();
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					throw new Error(
						`Invalid JSON from ${currentUrl}: ${message}`,
					);
				}
			}
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			// Do not retry policy violations or client-side HTTP 4xx errors.
			if (
				attempt >= retries ||
				err.message.includes('not in allowed catalog origins') ||
				err.message.includes('must use https') ||
				err.message.includes('Too many redirects') ||
				/HTTP 4(?!08|29)\d\d/.test(err.message)
			) {
				throw err;
			}
			lastError = err;
		}
		await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
	}
	throw lastError ?? new Error(`Failed to fetch ${rawUrl}`);
}

export async function fetchCatalog(
	options: FetchCatalogOptions = {},
): Promise<AppsCatalogPayload> {
	const fetchImpl = options.fetchImpl ?? fetch;
	const domainsUrl = options.domainsUrl ?? DOMAINS_JSON_URL;
	const allowedOrigins = options.allowedOrigins ?? [
		new URL(domainsUrl).origin,
	];
	const timeoutMs = options.timeoutMs ?? FETCH_TIMEOUT_MS;
	const retries = options.retries ?? 1;
	const onDomainError =
		options.onDomainError ??
		((domainId, url, error) => {
			console.warn(
				`[appsCatalog] Skipping unavailable domain "${domainId}" (${url}): ${error.message}`,
			);
		});

	const domainsData = await fetchAllowedJson(domainsUrl, {
		fetchImpl,
		allowedOrigins,
		timeoutMs,
		retries,
	});
	if (!isRecord(domainsData) || !isRecord(domainsData.domains)) {
		throw new Error(`domains.json (${domainsUrl}) must contain a domains object`);
	}
	const rawDomains = Object.entries(domainsData.domains);
	if (!rawDomains.length) {
		throw new Error(`domains.json (${domainsUrl}) lists no domains`);
	}

	const failures: string[] = [];
	const domains = await Promise.all(
		rawDomains.map(async ([id, rawEntry]): Promise<DomainCatalog> => {
			let definition: DomainDefinition;
			try {
				definition = parseDomainEntry(id, rawEntry, allowedOrigins, domainsUrl);
			} catch (error) {
				const err = error instanceof Error ? error : new Error(String(error));
				const attemptedUrl =
					isRecord(rawEntry) && typeof rawEntry.appJsonUrl === 'string'
						? rawEntry.appJsonUrl
						: domainsUrl;
				onDomainError(id, attemptedUrl, err);
				failures.push(`${id || '<empty>'}: ${err.message}`);
				return {
					id,
					label: formatDomainLabel(id) || id,
					list: [],
					unavailable: true,
				};
			}

			const { appJsonUrl, eessiCatalogUrl, eessiStacks: _stacks, ...meta } =
				definition;
			let list: AppListEntry[] = [];
			let unavailable = false;
			if (appJsonUrl) {
				try {
					const feedData = await fetchAllowedJson(appJsonUrl, {
						fetchImpl,
						allowedOrigins,
						timeoutMs,
						retries,
					});
					list = toAppList(parseAppsFeed(feedData, appJsonUrl), {
						allowEmpty: true,
						sourceUrl: appJsonUrl,
					});
				} catch (error) {
					const err = error instanceof Error ? error : new Error(String(error));
					onDomainError(meta.id, appJsonUrl, err);
					failures.push(`${meta.id}: ${err.message}`);
					unavailable = true;
				}
			}

			let eessi: EessiAppEntry[] | undefined;
			let eessiUnavailable = false;
			if (eessiCatalogUrl) {
				try {
					const eessiData = await fetchAllowedJson(eessiCatalogUrl, {
						fetchImpl,
						allowedOrigins,
						timeoutMs,
						retries,
					});
					eessi = parseEessiFeed(eessiData, eessiCatalogUrl);
				} catch (error) {
					const err = error instanceof Error ? error : new Error(String(error));
					onDomainError(meta.id, eessiCatalogUrl, err);
					failures.push(`${meta.id} (eessi): ${err.message}`);
					eessiUnavailable = true;
				}
			}

			if (!appJsonUrl && eessiUnavailable) {
				unavailable = true;
			}

			return {
				...meta,
				list,
				...(eessi ? { eessi } : {}),
				...(unavailable ? { unavailable: true } : {}),
				...(eessiUnavailable ? { eessiUnavailable: true } : {}),
			};
		}),
	);

	// Drop malformed entries with blank IDs after recording their failures.
	const validDomains = domains.filter((d) => d.id.trim() !== '');
	const healthyDomains = validDomains.filter((d) => !d.unavailable);
	const totalEntries = healthyDomains.reduce(
		(sum, domain) => sum + domain.list.length + (domain.eessi?.length ?? 0),
		0,
	);
	if (!healthyDomains.length || totalEntries === 0) {
		const details = failures.length ? `: ${failures.join('; ')}` : '';
		throw new Error(
			`No domain catalogs produced visible applications${details}`,
		);
	}

	return { domains: validDomains };
}

let cached: Promise<AppsCatalogPayload> | undefined;

/** Fetches all configured domain catalogs once per build and shares the result across pages. */
export function loadCatalog(): Promise<AppsCatalogPayload> {
	cached ??= fetchCatalog();
	return cached;
}
