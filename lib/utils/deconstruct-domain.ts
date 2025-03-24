import { env } from '../env/shared';

export const deconstructDomain = (
	teamParam: Awaited<{
		team: string;
	}>['team']
) => {
	let subdomain: string | null = null;
	let domain: string | null = null;

	// If a domain is provided...
	if (teamParam.includes('.')) {
		domain = decodeURIComponent(teamParam);
		subdomain = domain.includes(`.${env.NEXT_PUBLIC_ROOT_DOMAIN}`) ? domain.split('.')[0] : '';
	} else {
		subdomain = null;
	}

	return { subdomain, domain };
};
