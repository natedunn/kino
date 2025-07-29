import { ConvexHttpClient } from 'convex/browser';

const convexClient = new ConvexHttpClient(process.env.VITE_CONVEX_URL!);

export const serverApi = {
	query: convexClient.query,
	mutation: convexClient.mutation,
};
