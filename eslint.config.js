//  @ts-check

import convexPlugin from '@convex-dev/eslint-plugin';
import { tanstackConfig } from '@tanstack/eslint-config';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default [
	{
		ignores: [
			'convex/functions/_generated/**/*.{ts,tsx,js}',
			'convex/functions/generated/**/*.{ts,tsx,js}',
			'convex/shared/api.ts',
			'**/routeTree.gen.ts',
		],
	},
	// Kitcn / TanStack baseline (kept intact).
	...tanstackConfig,
	// Convex-specific lint rules.
	...convexPlugin.configs.recommended,
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
			'**/*.test.ts',
			'**/*.spec.ts',
			'**/setup.testing.ts',
			'**/*.config.{ts,mts,cts,js}',
			'eslint.config.js',
		],
	},
	// Restored opinionated rules from the pre-Kitcn config.
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
