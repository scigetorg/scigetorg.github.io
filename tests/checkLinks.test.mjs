import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { checkDist } from '../.github/scripts/check-links.mjs';

function makeFixture(files) {
	const dir = mkdtempSync(join(tmpdir(), 'sciget-check-links-'));
	for (const [rel, content] of Object.entries(files)) {
		const full = join(dir, rel);
		mkdirSync(join(full, '..'), { recursive: true });
		writeFileSync(full, content, 'utf8');
	}
	return dir;
}

test('checkDist validates internal links, query params, fragments, poster, and social meta images', () => {
	const dir = makeFixture({
		'index.html': `<!doctype html>
			<meta property="og:image" content="https://sciget.org/og-default.png">
			<meta name="twitter:image" content="https://sciget.org/og-default.png">
			<a href="/guide/?os=macos#install">Install</a>
			<a href="https://sciget.org/guide/#install">Absolute same-origin</a>
			<a href="https://example.com/missing">External ignored</a>
			<img src="/img/shot.png" alt="ok">
			<video poster="/img/poster.jpg"><source src="/img/demo.mp4"></video>
			<div data-href="/not-a-link" data-src="/not-an-asset"></div>
			<!-- <a href="/commented-out">ignored</a> -->
			<code>&lt;a href="/escaped-example"&gt;docs example&lt;/a&gt;</code>
			<script>const s = '<a href="/fake-inside-script">x</a>';</script>`,
		'guide/index.html': `<!doctype html><h2 id="install">Install</h2>`,
		'og-default.png': 'png',
		'img/shot.png': 'png',
		'img/poster.jpg': 'jpg',
		'img/demo.mp4': 'mp4',
	});

	try {
		const report = checkDist(dir);
		assert.equal(report.problems.length, 0);
		assert.equal(report.links, 2);
		assert.equal(report.assets, 5);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('checkDist flags missing pages, fragments, assets, poster, meta images, and redirect chains', () => {
	const dir = makeFixture({
		'index.html': `<!doctype html>
			<meta property="og:image" content="https://sciget.org/missing-og.png">
			<a href="/missing-page/">Missing</a>
			<a href="/guide/#no-such-anchor">Bad anchor</a>
			<a href="/guide/#fake-data-id">Data-id must not satisfy fragment</a>
			<img src="/img/missing.png" alt="missing">
			<video poster="/img/missing-poster.jpg"></video>`,
		'guide/index.html': `<!doctype html><div data-id="fake-data-id"></div><h2 id="real-anchor">Real</h2>`,
		'old/index.html': `<!doctype html><meta http-equiv="refresh" content="0;url=/mid/">`,
		'mid/index.html': `<!doctype html><meta http-equiv="refresh" content="0;url=/guide/">`,
	});

	try {
		const report = checkDist(dir);
		const reasons = report.problems.map((p) => `${p.link}: ${p.reason}`);
		assert.deepEqual(reasons.sort(), [
			'/guide/#fake-data-id: fragment does not exist',
			'/guide/#no-such-anchor: fragment does not exist',
			'/img/missing-poster.jpg: target does not exist',
			'/img/missing.png: target does not exist',
			'/mid/: redirect target is another redirect',
			'/missing-page/: target does not exist',
			'https://sciget.org/missing-og.png: target does not exist',
		]);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('checkDist allows external redirects and non-HTML local redirect targets', () => {
	const dir = makeFixture({
		'external/index.html': `<!doctype html><meta http-equiv="refresh" content="0;url=https://example.com/docs">`,
		'download/index.html': `<!doctype html><meta http-equiv="refresh" content="0;url=/files/guide.pdf">`,
		'files/guide.pdf': '%PDF-1.4',
	});

	try {
		const report = checkDist(dir);
		assert.equal(report.problems.length, 0);
		assert.equal(report.redirects, 2);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('checkDist handles comment/script interactions and numeric/unknown entities', () => {
	const dir = makeFixture({
		'index.html': `<!doctype html>
			<style>/* <!-- not an HTML comment */</style>
			<a href="/missing-after-style/">Still checked</a>
			<!-- <script> not a real script -->
			<a href="/missing-after-comment/">Also checked</a>
			<script>const ok = 1;</script>
			<a href="/guide/#get-ready">Valid decoded fragment</a>
			<a href="/guide/#a&amp;constructor;b">Unknown prototype-named entity preserved</a>`,
		'guide/index.html': `<!doctype html>
			<h2 id="get&#45;ready">Get ready</h2>
			<h2 id="a&constructor;b">Literal entity</h2>`,
	});

	try {
		const report = checkDist(dir);
		const reasons = report.problems.map((p) => `${p.link}: ${p.reason}`);
		assert.deepEqual(reasons.sort(), [
			'/missing-after-comment/: target does not exist',
			'/missing-after-style/: target does not exist',
		]);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
