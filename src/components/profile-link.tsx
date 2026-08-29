import { Link } from '@tanstack/react-router';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import * as m from '@/paraglide/messages.js';

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
	const displayText = display === 'name' ? (profile.name ?? profile.username) : profile.username;

	return (
		<Link
			to='/u/$username'
			params={{ username: profile.username }}
			className={cn('flex items-center gap-2 text-sm hover:underline', className)}
		>
			<Avatar className='size-5' fallbackName={profile.username}>
				<AvatarImage src={profile.imageUrl ?? undefined} alt={profile.username} />
				<AvatarFallback />
			</Avatar>
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
		return <span className='text-sm text-muted-foreground'>{m.common_unknown()}</span>;
	}
	return <ProfileLink profile={profile} {...props} />;
}
