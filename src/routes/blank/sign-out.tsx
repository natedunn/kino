import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth/auth-client';

export const Route = createFileRoute('/blank/sign-out')({
	component: RouteComponent,
});

function RouteComponent() {
	const navigate = useNavigate();
	const handleClick = () => {
		authClient.signOut();
		navigate({
			to: '/sign-in',
		})
	}

	return (
		<div>
			<Button onClick={() => handleClick()}>Sign Out</Button>
		</div>
	)
}
