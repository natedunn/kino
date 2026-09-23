import type { AppEnvironment } from '@/lib/app-env';
import type { ConvexQueryClient } from '@convex-dev/react-query';
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
		<AppConvexProvider convexQueryClient={convexQueryClient} initialToken={initialToken}>
			<PostHogProvider appEnvironment={appEnvironment}>
				<CommandProvider>
					<ShortcutsProvider>{children}</ShortcutsProvider>
				</CommandProvider>
			</PostHogProvider>
		</AppConvexProvider>
	);
}
