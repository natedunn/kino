//  @ts-check

import convexPlugin from '@convex-dev/eslint-plugin';
import { tanstackConfig } from '@tanstack/eslint-config';

export default [
	{
		ignores: ['convex/functions/_generated/**/*.{ts,tsx,js}', '**/routeTree.gen.ts'],
	},
	// Kitcn / TanStack baseline (kept intact).
	...tanstackConfig,
	// Convex-specific lint rules.
	...convexPlugin.configs.recommended,
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
