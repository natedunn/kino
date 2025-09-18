import { TanStackDevtools } from '@tanstack/react-devtools';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';

const queryClient = new QueryClient();

export const Devtools = () => {
	return (
		<>
			<QueryClientProvider client={queryClient}>
				<TanStackDevtools
					plugins={[
						{
							name: 'TanStack Query',
							render: <ReactQueryDevtoolsPanel />,
						},
						{
							name: 'TanStack Router',
							render: <TanStackRouterDevtoolsPanel />,
						},
					]}
				/>
			</QueryClientProvider>
		</>
	);
};
