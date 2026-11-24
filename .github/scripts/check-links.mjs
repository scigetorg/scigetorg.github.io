import { appendFileSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_SITE_ORIGIN = 'https://sciget.org';

const NAMED_ENTITIES = new Map([
	['quot', '"'],
	['apos', "'"],
	['lt', '<'],
	['gt', '>'],
	['amp', '&'],
]);

const decodeAttribute = (value) =>
	value.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (match, dec, hex, named) => {
		if (dec !== undefined) {
			const cp = Number.parseInt(dec, 10);
			return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : match;
		}
		if (hex !== undefined) {
			const cp = Number.parseInt(hex, 16);
			return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : match;
		}
		return NAMED_ENTITIES.get(named.toLowerCase()) ?? match;
	});

// Single left-to-right pass so HTML comments and <script>/<style> bodies are
// stripped in document order without either construct swallowing the other.
const sanitizeHtml = (content) =>
	content.replace(
		/<!--[\s\S]*?-->|(<script\b[^>]*>)[\s\S]*?(<\/script>)|(<style\b[^>]*>)[\s\S]*?(<\/style>)/gi,
		(_match, scriptOpen, scriptClose, styleOpen, styleClose) =>
			scriptOpen ? `${scriptOpen}${scriptClose}` : styleOpen ? `${styleOpen}${styleClose}` : ''
	);

const TAG_RE = /<([a-z][a-z0-9-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;
const ATTR_RE = /(?:^|\s)([a-zA-Z_:][a-zA-Z0-9_.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

function parseOpeningTags(content) {
	const cleaned = sanitizeHtml(content);
	const tags = [];
	for (const match of cleaned.matchAll(TAG_RE)) {
		const name = match[1].toLowerCase();
		const attrText = match[2];
		const attrs = new Map();
		if (attrText) {
			for (const attrMatch of attrText.matchAll(ATTR_RE)) {
				const attrName = attrMatch[1].toLowerCase();
				const rawVal = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';
				if (!attrs.has(attrName)) {
					attrs.set(attrName, decodeAttribute(rawVal));
				}
			}
		}
		tags.push({ name, attrs });
	}
	return tags;
}

export function checkDist(rootDir, { siteOrigin = DEFAULT_SITE_ORIGIN } = {}) {
	const root = resolve(rootDir);
	const origin = new URL(siteOrigin).origin;

	if (!existsSync(root)) {
		throw new Error(`Build output not found: ${root}\nRun pnpm build first.`);
	}

	const htmlFiles = [];
	const visit = (directory) => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const file = join(directory, entry.name);
			if (entry.isDirectory()) visit(file);
			else if (entry.name.endsWith('.html')) htmlFiles.push(file);
		}
	};
	visit(root);

	const tagsCache = new Map();
	const idCache = new Map();

	const tagsFor = (file) => {
		if (!tagsCache.has(file)) {
			tagsCache.set(file, parseOpeningTags(readFileSync(file, 'utf8')));
		}
		return tagsCache.get(file);
	};

	const pageUrl = (file) => {
		const path = relative(root, file).split(sep).join('/');
		if (path === 'index.html') return '/';
		return `/${path.replace(/index\.html$/, '')}`;
	};

	const resolveLink = (raw, source) => {
		const value = raw.trim();
		if (!value || /^(mailto|tel|javascript|data|blob):/i.test(value)) return null;

		let url;
		try {
			url = new URL(value, `${origin}${pageUrl(source)}`);
		} catch {
			return { error: 'invalid URL' };
		}
		if (url.origin !== origin) return null;

		let pathname;
		try {
			pathname = decodeURIComponent(url.pathname).replace(/^\/+/, '');
		} catch {
			return { error: 'malformed URL encoding' };
		}

		const base = resolve(root, pathname);
		if (base !== root && !base.startsWith(`${root}${sep}`)) return { error: 'escapes dist' };

		const candidates = [base, `${base}.html`, join(base, 'index.html')];
		const target = candidates.find((file) => existsSync(file) && statSync(file).isFile());
		if (!target) return { error: 'target does not exist' };

		let fragment = url.hash.slice(1);
		if (fragment) {
			try {
				fragment = decodeURIComponent(fragment);
			} catch {
				return { error: 'malformed fragment encoding' };
			}
		}

		return { target, fragment };
	};

	const redirectUrl = (file) => {
		if (!file.endsWith('.html')) return null;
		for (const { name, attrs } of tagsFor(file)) {
			if (name !== 'meta') continue;
			if (attrs.get('http-equiv')?.toLowerCase() !== 'refresh') continue;
			const target = attrs.get('content')?.match(/^\s*\d+\s*;\s*url=(.+)$/i)?.[1];
			if (target) return target.trim();
		}
		return null;
	};

	const ids = (file) => {
		if (!idCache.has(file)) {
			const set = new Set();
			for (const { attrs } of tagsFor(file)) {
				const id = attrs.get('id');
				if (id) set.add(id);
			}
			idCache.set(file, set);
		}
		return idCache.get(file);
	};

	// The Edit page link names the source file behind each built page.
	const sourceFile = (file) => {
		for (const { name, attrs } of tagsFor(file)) {
			if (name !== 'a') continue;
			const href = attrs.get('href');
			const match = href?.match(/^https:\/\/github\.com\/[^/]+\/[^/]+\/edit\/[^/]+\/([^"#?]+)/);
			if (match) return match[1];
		}
		return pageUrl(file);
	};

	const problems = [];
	let pages = 0;
	let links = 0;
	let assets = 0;
	let redirects = 0;

	for (const source of htmlFiles) {
		const redirect = redirectUrl(source);
		if (redirect) {
			redirects += 1;
			const where = `redirect ${pageUrl(source)} (astro.config.mjs)`;
			const result = resolveLink(redirect, source);
			if (!result) {
				// External redirect target — nothing local to check.
				continue;
			}
			if (result.error) {
				const reason =
					result.error === 'target does not exist'
						? 'redirect target does not exist'
						: `redirect ${result.error}`;
				problems.push({ where, link: redirect, reason });
			} else if (result.target.endsWith('.html') && redirectUrl(result.target)) {
				problems.push({ where, link: redirect, reason: 'redirect target is another redirect' });
			} else if (result.fragment && result.target.endsWith('.html') && !ids(result.target).has(result.fragment)) {
				problems.push({ where, link: redirect, reason: 'redirect fragment does not exist' });
			}
			continue;
		}

		pages += 1;
		const where = sourceFile(source);

		for (const { name, attrs } of tagsFor(source)) {
			const checks = [];

			const href = attrs.get('href');
			if (href !== undefined) checks.push({ kind: 'link', raw: href });

			const src = attrs.get('src');
			if (src !== undefined) checks.push({ kind: 'asset', raw: src });

			if (name === 'video') {
				const poster = attrs.get('poster');
				if (poster !== undefined) checks.push({ kind: 'asset', raw: poster });
			}

			if (name === 'meta') {
				const metaKey = (attrs.get('property') ?? attrs.get('name') ?? '').toLowerCase();
				if (metaKey === 'og:image' || metaKey === 'twitter:image') {
					const content = attrs.get('content');
					if (content !== undefined) checks.push({ kind: 'asset', raw: content });
				}
			}

			for (const { kind, raw } of checks) {
				const result = resolveLink(raw, source);
				if (!result) continue;

				if (kind === 'asset') assets += 1;
				else links += 1;

				if (result.error) {
					problems.push({ where, link: raw, reason: result.error });
				} else if (
					kind === 'link' &&
					result.fragment &&
					result.target.endsWith('.html') &&
					!ids(result.target).has(result.fragment)
				) {
					problems.push({ where, link: raw, reason: 'fragment does not exist' });
				}
			}
		}
	}

	return {
		htmlFiles: htmlFiles.length,
		pages,
		links,
		assets,
		redirects,
		problems,
	};
}

function runCli() {
	const rootDir = process.argv[2] ?? 'dist';
	let report;
	try {
		report = checkDist(rootDir);
	} catch (err) {
		console.error(err instanceof Error ? err.message : String(err));
		process.exit(1);
	}

	console.log(
		`Checked ${report.htmlFiles} HTML files, ${report.links} internal links, ${report.assets} local assets and ${report.redirects} redirects.`
	);

	if (report.problems.length === 0) return;

	// A link broken on every page comes from the site config or layout, not page content.
	const key = (p) => `${p.link}\0${p.reason}`;
	const pagesWith = new Map();
	const problemByKey = new Map();
	for (const p of report.problems) {
		const k = key(p);
		problemByKey.set(k, { link: p.link, reason: p.reason });
		if (!pagesWith.has(k)) pagesWith.set(k, new Set());
		pagesWith.get(k).add(p.where);
	}
	const siteWideKeys = new Set(
		[...pagesWith].filter(([, w]) => report.pages > 1 && w.size >= report.pages).map(([k]) => k)
	);

	const byFile = new Map();
	for (const p of report.problems) {
		const k = key(p);
		if (siteWideKeys.has(k)) continue;
		if (!byFile.has(p.where)) byFile.set(p.where, new Map());
		byFile.get(p.where).set(k, { link: p.link, reason: p.reason });
	}

	const formatProblem = ({ link, reason }) => `${link} (${reason})`;
	const lines = ['', 'Broken links to fix:'];
	for (const [file, items] of [...byFile].sort(([a], [b]) => a.localeCompare(b))) {
		lines.push('', file, ...[...items.values()].map((item) => `  ${formatProblem(item)}`));
	}
	if (siteWideKeys.size) {
		lines.push(
			'',
			'On every page (site config or layout, not page content):',
			...[...siteWideKeys].map((k) => `  ${formatProblem(problemByKey.get(k))}`)
		);
	}
	console.error(lines.join('\n'));

	// In GitHub Actions, also write a table to the job summary, linking each file at this commit.
	const { GITHUB_STEP_SUMMARY, GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_SHA } = process.env;
	if (GITHUB_STEP_SUMMARY) {
		const cell = (text) => `\`${text.replaceAll('|', '\\|').replaceAll('\n', ' ')}\``;
		const fileCell = (file) =>
			file.startsWith('src/') && GITHUB_SHA
				? `[${cell(file)}](${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/blob/${GITHUB_SHA}/${file})`
				: cell(file);
		const row = (file, { link, reason }) => `| ${file} | ${cell(link)} | ${reason} |`;
		const md = ['### Broken links', '', '| File | Broken link | Problem |', '| --- | --- | --- |'];
		for (const [file, items] of [...byFile].sort(([a], [b]) => a.localeCompare(b))) {
			for (const item of items.values()) md.push(row(fileCell(file), item));
		}
		for (const k of siteWideKeys) md.push(row('Every page (site config or layout)', problemByKey.get(k)));
		appendFileSync(GITHUB_STEP_SUMMARY, `${md.join('\n')}\n`);
	}

	process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	runCli();
}
