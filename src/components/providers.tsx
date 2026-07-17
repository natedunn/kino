import type { AppEnvironment } from '@/lib/app-env';
import type { ConvexQueryClient } from 'kitcn/react';
import type { ReactNode } from 'react';

import { CommandProvider } from '@/components/command';
import { ShortcutsProvider } from '@/components/shortcuts';
import { AppConvexProvider } from '@/lib/convex/convex-provider';
import { PostHogProvider } from '@/lib/posthog';

export function Providers({
	appEnvironment,
	children,
	convexQueryClient,
	initialToken,
}: {
	appEnvironment: AppEnvironment;
	children: ReactNode;
	convexQueryClient: ConvexQueryClient;
	initialToken?: string | null;
}) {
	return (
		<PostHogProvider appEnvironment={appEnvironment}>
			<AppConvexProvider convexQueryClient={convexQueryClient} initialToken={initialToken}>
				<CommandProvider>
					<ShortcutsProvider>{children}</ShortcutsProvider>
				</CommandProvider>
			</AppConvexProvider>
		</PostHogProvider>
	);
}
