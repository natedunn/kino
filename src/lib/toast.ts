import type { ReactNode } from 'react';

type SonnerModule = typeof import('sonner');
type ExternalToast = SonnerModule['toast'] extends {
	success(message: ReactNode, data?: infer T): unknown;
}
	? T
	: never;

let sonnerModulePromise: Promise<SonnerModule> | null = null;

function getSonnerModule() {
	sonnerModulePromise ??= import('sonner');
	return sonnerModulePromise;
}

export const toast = {
	async message(message: ReactNode, data?: ExternalToast) {
		const { toast } = await getSonnerModule();
		return toast(message, data);
	},
	async success(message: ReactNode, data?: ExternalToast) {
		const { toast } = await getSonnerModule();
		return toast.success(message, data);
	},
	async error(message: ReactNode, data?: ExternalToast) {
		const { toast } = await getSonnerModule();
		return toast.error(message, data);
	},
	async info(message: ReactNode, data?: ExternalToast) {
		const { toast } = await getSonnerModule();
		return toast.info(message, data);
	},
	async warning(message: ReactNode, data?: ExternalToast) {
		const { toast } = await getSonnerModule();
		return toast.warning(message, data);
	},
};
