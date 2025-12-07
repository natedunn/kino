import type { RandomReader } from '@oslojs/crypto/random';

import { generateRandomString } from '@oslojs/crypto/random';
import { adjectives, nouns, uniqueUsernameGenerator } from 'unique-username-generator';

const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const lower = 'abcdefghijklmnopqrstuvwxyz';
const numbers = '0123456789';

export const alphabet = upper + lower + numbers;

export const random: RandomReader = {
	read(bytes) {
		crypto.getRandomValues(bytes);
	},
};

export const generateRandomSlug = () => {
	return generateRandomString(random, alphabet, 15);
};

export const generateRandomUsername = () => {
	return uniqueUsernameGenerator({
		length: 30,
		separator: '',
		style: 'snakeCase',
		dictionaries: [adjectives, nouns],
		randomDigits: 3,
	});
};
