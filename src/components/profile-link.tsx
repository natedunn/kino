import { Link } from '@tanstack/react-router';

import { cn } from '@/lib/utils';

type ProfileLinkProps = {
	profile: {
		imageUrl?: string | null;
		username: string;
		name?: string | null;
	};
	/** Show @ prefix before username (default: false) */
	showAt?: boolean;
	/** Which name to display: 'username' shows username, 'name' shows name with username fallback (default: 'username') */
	display?: 'username' | 'name';
	/** Additional className for the link */
	className?: string;
};

/**
 * A reusable profile link component with avatar and name/username.
 * Used in sidebar detail sections across feedback and update pages.
 */
export function ProfileLink({
	profile,
	showAt = false,
	display = 'username',
	className,
}: ProfileLinkProps) {
	const displayText =
		display === 'name' ? (profile.name ?? profile.username) : profile.username;
	const fallbackInitial = profile.name?.charAt(0) ?? profile.username.charAt(0) ?? '?';

	return (
		<Link
			to='/@{$org}'
			params={{ org: profile.username }}
			className={cn('flex items-center gap-2 text-sm hover:underline', className)}
		>
			<div className='size-5 overflow-hidden rounded-full'>
				{profile.imageUrl ? (
					<img src={profile.imageUrl} alt={profile.username} className='size-5' />
				) : (
					<div className='flex size-5 items-center justify-center bg-primary text-[10px] font-bold text-primary-foreground'>
						{fallbackInitial}
					</div>
				)}
			</div>
			<span>
				{showAt && '@'}
				{displayText}
			</span>
		</Link>
	);
}

type ProfileLinkOrUnknownProps = Omit<ProfileLinkProps, 'profile'> & {
	profile: ProfileLinkProps['profile'] | null | undefined;
};

/**
 * ProfileLink that handles null/undefined profile by showing "Unknown".
 */
export function ProfileLinkOrUnknown({ profile, ...props }: ProfileLinkOrUnknownProps) {
	if (!profile) {
		return <span className='text-sm text-muted-foreground'>Unknown</span>;
	}
	return <ProfileLink profile={profile} {...props} />;
}
