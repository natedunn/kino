type CreateURLOptions = {
	domain: string;
	subdomain: string | null;
	path?: string | null;
	protocol?: string;
};

export function createURL({
	domain,
	subdomain = null,
	path = null,
	protocol = 'https',
}: CreateURLOptions): string | null {
	try {
		let urlString = `${protocol}://${domain}${path ?? ''}`;

		if (subdomain) {
			const url = new URL(urlString);
			const hostnameParts: string[] = url.hostname.split('.');
			hostnameParts.unshift(subdomain);
			url.hostname = hostnameParts.join('.');
			urlString = url.toString();
		} else {
			urlString = `${protocol}://${domain}${path}`;
		}

		return urlString;
	} catch (error) {
		console.error('Invalid URL parameters:', error);
		return null;
	}
}
