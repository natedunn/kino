import type { IconName } from '@/icons';

import { Icon, iconRegistry } from '@/icons';

type BoardIconProps = {
	className?: string;
	fallback?: IconName;
	icon?: string | null;
	name?: string | null;
	size?: string;
};

export function resolveBoardIconName({
	icon,
	name,
}: {
	icon?: string | null;
	name?: string | null;
}): IconName {
	if (icon === 'chartUp' && name === 'Improvements') return 'improvements';
	if (icon && Object.prototype.hasOwnProperty.call(iconRegistry, icon)) return icon as IconName;
	return 'box';
}

export function BoardIcon({ className, fallback = 'box', icon, name, size }: BoardIconProps) {
	return (
		<Icon
			className={className}
			fallback={fallback}
			name={resolveBoardIconName({ icon, name })}
			size={size}
		/>
	);
}
