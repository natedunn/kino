//  @ts-check

import convexPlugin from '@convex-dev/eslint-plugin';
import { tanstackConfig } from '@tanstack/eslint-config';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default [
	{
		ignores: [
			'.tmp/**',
			'experiments/**',
			'integrations/**',
			'src/paraglide/**',
			'convex/native/_generated/**/*.{ts,tsx,js}',
			'**/routeTree.gen.ts',
		],
	},
	// TanStack baseline.
	...tanstackConfig,
	// Convex-specific lint rules.
	...convexPlugin.configs.recommended,
	// Import ordering is owned by Prettier (@ianvs/prettier-plugin-sort-imports);
	// disable the conflicting ESLint rules so the two formatters don't fight.
	{
		rules: {
			'import/order': 'off',
			'sort-imports': 'off',
		},
	},
	// React Hooks linting (classic rules) for app source.
	{
		files: ['src/**/*.{ts,tsx}'],
		plugins: { 'react-hooks': reactHooks },
		rules: {
			'react-hooks/rules-of-hooks': 'error',
			'react-hooks/exhaustive-deps': 'warn',
		},
	},
	// Test and config files live outside the type-checked tsconfig projects, so
	// disable type-aware parsing/rules for them (avoids "file not found in
	// project" parser errors from `parserOptions.project`).
	{
		...tseslint.configs.disableTypeChecked,
		files: [
			'**/*.test.{ts,tsx}',
			'**/*.spec.{ts,tsx}',
			'**/setup.testing.ts',
			'**/*.config.{ts,mts,cts,js}',
			'eslint.config.js',
		],
	},
	{
		files: ['convex/{emails,native,shared}/**/*.{ts,tsx}'],
		ignores: ['**/*.test.{ts,tsx}'],
		languageOptions: { parserOptions: { project: './convex/native/tsconfig.json' } },
	},
	{
		files: ['**/*.{ts,tsx}'],
		rules: {
			// Base rule can report incorrect errors on TS; defer to the TS rule.
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{
					args: 'all',
					argsIgnorePattern: '^_',
					caughtErrors: 'all',
					caughtErrorsIgnorePattern: '^_',
					destructuredArrayIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					ignoreRestSiblings: true,
				},
			],
		},
	},
];
