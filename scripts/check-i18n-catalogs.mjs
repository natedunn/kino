import { readFile } from 'node:fs/promises';

const locales = ['en-US', 'es-419', 'zh-Hans'];
const catalogs = await Promise.all(
	locales.map(async (locale) => {
		const contents = await readFile(
			new URL(`../messages/${locale}.json`, import.meta.url),
			'utf8'
		);
		return [locale, JSON.parse(contents)];
	})
);

const baseKeys = Object.keys(catalogs[0][1])
	.filter((key) => key !== '$schema')
	.sort();
const failures = [];

for (const [locale, catalog] of catalogs) {
	const keys = Object.keys(catalog)
		.filter((key) => key !== '$schema')
		.sort();
	const missing = baseKeys.filter((key) => !keys.includes(key));
	const extra = keys.filter((key) => !baseKeys.includes(key));
	const empty = keys.filter((key) => catalog[key] === '');

	if (missing.length) failures.push(`${locale} missing: ${missing.join(', ')}`);
	if (extra.length) failures.push(`${locale} extra: ${extra.join(', ')}`);
	if (empty.length) failures.push(`${locale} empty: ${empty.join(', ')}`);
}

if (failures.length) {
	throw new Error(`Translation catalogs are incomplete:\n${failures.join('\n')}`);
}

console.log(
	`Translation catalogs complete: ${baseKeys.length} messages × ${locales.length} locales.`
);
