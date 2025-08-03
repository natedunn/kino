import { useForm } from '@tanstack/react-form';
import { createFileRoute } from '@tanstack/react-router';
import z from 'zod';

import { authClient } from '@/lib/auth/auth-client';

const formSchema = z.object({
	name: z.string(),
	slug: z.string(),
	logo: z.string().nullable().optional(),
});

type FormSchema = z.infer<typeof formSchema>;

export const Route = createFileRoute('/_default/create/team')({
	component: RouteComponent,
});

function RouteComponent() {
	const defaultValues: FormSchema = {
		name: '',
		slug: '',
		logo: null,
	};

	const form = useForm({
		defaultValues,
		validators: {
			onChange: formSchema,
		},
		onSubmit: async (data) => {
			console.log(data);
		},
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		></form>
	);
}
