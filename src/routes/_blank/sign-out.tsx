import { createFileRoute } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth/auth-client';

export const Route = createFileRoute('/_blank/sign-out')({
	component: RouteComponent,
});

function RouteComponent() {
	const handleClick = () => {
		authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					location.reload();
				},
			},
		});
	};

	return (
		<div>
			<Button onClick={() => handleClick()}>Sign Out</Button>
		</div>
	);
}
