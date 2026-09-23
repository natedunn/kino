import { StrictMode } from 'react';
import { ConvexReactClient } from 'convex/react';
import { createRoot } from 'react-dom/client';

import { ConvexAuthProvider } from '../../.upstream/packages/core/src/react/index.tsx';
import { api } from '../convex/_generated/api';
import App from './App';

import './index.css';

const convexUrl = import.meta.env.VITE_CONVEX_URL;
if (!convexUrl) throw new Error('The proof requires VITE_CONVEX_URL');
const convex = new ConvexReactClient(convexUrl);

const rootElement = document.getElementById('root');
if (rootElement === null) {
	throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
	<StrictMode>
		<ConvexAuthProvider client={convex} api={api.auth}>
			<App />
		</ConvexAuthProvider>
	</StrictMode>
);
