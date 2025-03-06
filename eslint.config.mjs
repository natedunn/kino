import { dirname } from 'path';
import { fileURLToPath } from 'url';

import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
	baseDirectory: __dirname,
});

const eslintConfig = [
	...compat.extends(
		'next/core-web-vitals',
		'next/typescript',
		'plugin:@typescript-eslint/recommended'
	),
	{
		rules: {
			'react-hooks/rules-of-hooks': 'error',
			'react-hooks/exhaustive-deps': 'warn',
			'@typescript-eslint/no-unused-vars': 'warn',
			'@typescript-eslint/consistent-type-imports': [
				'error',
				{
					fixStyle: 'separate-type-imports',
					prefer: 'type-imports',
				},
			],
			'@typescript-eslint/no-empty-object-type': 'off',
			'import/no-cycle': 'off',
		},
	},
];

export default eslintConfig;
