import { useCallback, useState } from 'react';

export function useDialog() {
	const [open, onOpenChange] = useState(false);

	const trigger = useCallback(() => {
		onOpenChange((prev) => !prev);
	}, [onOpenChange]);

	return { props: { open, onOpenChange }, trigger };
}
