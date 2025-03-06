// @ts-check

/** @type {import("@ianvs/prettier-plugin-sort-imports").PrettierConfig} */
const config = {
	plugins: ['@tailwindcss/postcss', '@ianvs/prettier-plugin-sort-imports'],
	trailingComma: 'es5',
	tabWidth: 2,
	useTabs: true,
	semi: true,
	singleQuote: true,
	jsxSingleQuote: true,
	bracketSpacing: true,
	printWidth: 100,
	proseWrap: 'preserve',
	quoteProps: 'as-needed',
	bracketSameLine: false,
	htmlWhitespaceSensitivity: 'ignore',
	// Import sorting
	importOrder: [
		// types
		'<TYPES>',
		'<TYPES>^[.]',
		'', // break
		'', // third party modules
		'^react$',
		'<THIRD_PARTY_MODULES>',
		'', // internal modules
		'~(.*)$',
		'^@/(.*)$',
		'', // break
		'^[.]',
		'^(?!.*[.]css$)[./].*$',
		'.css$',
	],
	importOrderParserPlugins: ['typescript', 'jsx', 'decorators-legacy'],
	importOrderTypeScriptVersion: '5.2.2',
	// Tailwind
	tailwindFunctions: ['clsx', 'cn'],
};

export default config;
