import { useForm } from '@tanstack/react-form';

import { Id } from '@/convex/_generated/dataModel';
import { FeedbackCreateSchema, feedbackCreateSchema } from '@/convex/schema/feedback.schema';

const formSchema = feedbackCreateSchema;
type FormSchema = FeedbackCreateSchema;

export const CreateFeedbackForm = () => {
	const defaultValues: FormSchema = {
		board: '' as Id<'feedbackBoard'>,
		content: '',
	};

	const form = useForm({
		defaultValues,
		validators: {
			onChange: formSchema,
		},
	});

	return (
		<div>
			<form>{/* <form.Field name='content'></form.Field> */}</form>
		</div>
	);
};
