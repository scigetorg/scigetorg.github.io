/**
 * Pure helpers for mapping Starlight tab labels to stable URL query values.
 */

export function slugifyTabLabel(label: string | null | undefined): string {
	return (label ?? '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');
}

/**
 * Resolve the query value for a tab label. Explicit entries in `values`
 * (matched by exact trimmed label or slugified label) take precedence over
 * auto-slugifying the display label so query params stay stable across copy edits.
 */
export function tabValueForLabel(
	label: string | null | undefined,
	values: Record<string, string> = {}
): string {
	const trimmed = (label ?? '').trim();
	if (Object.prototype.hasOwnProperty.call(values, trimmed)) {
		return values[trimmed]!;
	}
	const slug = slugifyTabLabel(trimmed);
	if (Object.prototype.hasOwnProperty.call(values, slug)) {
		return values[slug]!;
	}
	return slug;
}

/**
 * Find the index of the tab matching a requested query parameter value.
 * Returns -1 when no tab matches.
 */
export function findTabIndexForValue(
	labels: readonly (string | null | undefined)[],
	wanted: string | null | undefined,
	values: Record<string, string> = {}
): number {
	const normalizedWanted = slugifyTabLabel(wanted);
	if (!normalizedWanted) return -1;
	return labels.findIndex((label) => {
		const mapped = slugifyTabLabel(tabValueForLabel(label, values));
		if (mapped === normalizedWanted) return true;
		// Also accept the raw slugified label for backwards-compatible links.
		return slugifyTabLabel(label) === normalizedWanted;
	});
}
