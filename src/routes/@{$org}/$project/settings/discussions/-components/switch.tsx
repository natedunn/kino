import { Switch as SwitchPrimitive } from '@base-ui/react/switch';

import { cn } from '@/lib/utils';

// An on/off toggle for settings that save immediately. Styled to match the
// checkbox (primary when on, muted track when off).
export function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
	return (
		<SwitchPrimitive.Root
			className={cn(
				'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-muted-foreground/30 shadow-xs transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[checked]:bg-primary data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
				className
			)}
			{...props}
		>
			<SwitchPrimitive.Thumb className='pointer-events-none block size-4 rounded-full bg-background shadow-sm transition-transform data-[checked]:translate-x-4' />
		</SwitchPrimitive.Root>
	);
}
