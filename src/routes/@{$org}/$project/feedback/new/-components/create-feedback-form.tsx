import { useForm } from '@tanstack/react-form';
import { Id } from 'convex/_generated/dataModel';
import { FeedbackCreateSchema, feedbackCreateSchema } from 'convex/schema/feedback.schema';

import { useAppForm } from '@/components/ui/tanstack-form';

const formSchema = feedbackCreateSchema;
type FormSchema = FeedbackCreateSchema;

export const CreateFeedbackForm = () => {
	const defaultValues: FormSchema = {
		board: '' as Id<'feedbackBoard'>,
		content: '',
	};

	const form = useAppForm({
		defaultValues,
		validators: {
			onChange: formSchema,
		},
	});

	return (
		<div>
			{/* <form.AppForm>
				<form></form>
			</form.AppForm> */}
		</div>
	);
};
