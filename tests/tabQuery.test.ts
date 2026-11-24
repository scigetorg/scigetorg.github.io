import assert from 'node:assert/strict';
import test from 'node:test';
import { findTabIndexForValue, slugifyTabLabel, tabValueForLabel } from '../src/lib/tabQuery.ts';

test('slugifyTabLabel normalizes whitespace, casing, and punctuation', () => {
	assert.equal(slugifyTabLabel('macOS'), 'macos');
	assert.equal(slugifyTabLabel('  Docker (recommended)  '), 'docker-recommended');
	assert.equal(slugifyTabLabel('TinyRange (no admin access)'), 'tinyrange-no-admin-access');
	assert.equal(slugifyTabLabel(''), '');
	assert.equal(slugifyTabLabel(null), '');
});

test('tabValueForLabel uses explicit value mappings before auto-slugifying', () => {
	const values = {
		'Docker (recommended)': 'docker',
		Podman: 'podman',
		'TinyRange (no admin access)': 'tinyrange',
	};

	assert.equal(tabValueForLabel('Docker (recommended)', values), 'docker');
	assert.equal(tabValueForLabel('  TinyRange (no admin access) ', values), 'tinyrange');
	assert.equal(tabValueForLabel('Linux', values), 'linux');
});

test('findTabIndexForValue matches mapped values and backwards-compatible raw slugs', () => {
	const labels = ['Docker (recommended)', 'Podman', 'TinyRange (no admin access)'];
	const values = {
		'Docker (recommended)': 'docker',
		Podman: 'podman',
		'TinyRange (no admin access)': 'tinyrange',
	};

	assert.equal(findTabIndexForValue(labels, 'docker', values), 0);
	assert.equal(findTabIndexForValue(labels, 'DOCKER', values), 0);
	assert.equal(findTabIndexForValue(labels, 'tinyrange', values), 2);
	assert.equal(findTabIndexForValue(labels, 'tinyrange-no-admin-access', values), 2);
	assert.equal(findTabIndexForValue(labels, 'unknown', values), -1);
	assert.equal(findTabIndexForValue(labels, '', values), -1);
});
