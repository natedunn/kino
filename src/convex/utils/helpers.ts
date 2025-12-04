type Truthy<T> = T extends false | 0 | '' | null | undefined ? never : T;

export function hasOverlap(arr1: string[], arr2: string[]): boolean {
	const _set = new Set(arr2);
	return arr1.some((value) => _set.has(value));
}

export async function asyncFlatMapFilter<T, R>(
	items: T[],
	asyncFn: (item: T) => Promise<R>
): Promise<Truthy<Awaited<R>>[]> {
	const results = await Promise.all(items.flatMap(asyncFn));
	return results.filter((p) => p !== undefined).filter((p) => !!p) as Truthy<Awaited<R>>[];
}
