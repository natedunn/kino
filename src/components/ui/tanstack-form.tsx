import * as React from 'react';
import {
	AppFieldExtendedReactFormApi,
	createFormHook,
	createFormHookContexts,
	useStore,
} from '@tanstack/react-form';
import { ConvexError } from 'convex/values';

import { Label as LabelComponent } from '@/components/ui/label';
import { Slot } from '@/components/ui/slot';
import { cn } from '@/lib/utils';

import { InlineAlert } from '../inline-alert';

export const Form = (
	props: React.ComponentProps<'form'> & {
		onSubmit?: (e: React.FormEvent) => void;
		form: AppFieldExtendedReactFormApi<
			any,
			any,
			any,
			any,
			any,
			any,
			any,
			any,
			any,
			any,
			any,
			any,
			any,
			any
		>;
	}
) => {
	const { children, onSubmit, form, ...rest } = props;

	const handleSubmit = React.useCallback(
		(e: React.FormEvent) => {
			e.preventDefault();
			e.stopPropagation();
			onSubmit?.(e);
			form.handleSubmit();
		},
		[form]
	);

	return (
		<form {...rest} onSubmit={handleSubmit}>
			{children}
		</form>
	);
};

const {
	fieldContext,
	formContext,
	useFieldContext: useFormFieldContext,
	useFormContext,
} = createFormHookContexts();

const { useAppForm, withForm } = createFormHook({
	fieldContext,
	formContext: formContext,
	fieldComponents: {
		Label,
		Control,
		Description,
		Message,
		Provider,
	},
	formComponents: {
		Form,
	},
});

type FormItemContextValue = {
	id: string;
};

const FormItemContext = React.createContext<FormItemContextValue>({} as FormItemContextValue);

function Provider({ className, ...props }: React.ComponentProps<'div'>) {
	const id = React.useId();

	return (
		<FormItemContext.Provider value={{ id }}>
			<div data-slot='form-item' className={cn('grid gap-2', className)} {...props} />
		</FormItemContext.Provider>
	);
}

const useFieldContext = () => {
	const { id } = React.useContext(FormItemContext);
	const { name, store, ...fieldContext } = useFormFieldContext();

	const errors = useStore(store, (state) => state.meta.errors);
	if (!fieldContext) {
		throw new Error('useFieldContext should be used within <FormItem>');
	}

	return {
		id,
		name,
		formItemId: `${id}-form-item`,
		formDescriptionId: `${id}-form-item-description`,
		formMessageId: `${id}-form-item-message`,
		errors,
		store,
		...fieldContext,
	};
};

function Label({ className, ...props }: React.ComponentProps<typeof LabelComponent>) {
	const { formItemId, errors } = useFieldContext();

	return (
		<LabelComponent
			data-slot='form-label'
			data-error={!!errors.length}
			className={cn('data-[error=true]:text-destructive', className)}
			htmlFor={formItemId}
			{...props}
		/>
	);
}

function Control({ ...props }: React.ComponentProps<typeof Slot>) {
	const { errors, formItemId, formDescriptionId, formMessageId } = useFieldContext();

	return (
		<Slot
			data-slot='form-control'
			id={formItemId}
			aria-describedby={
				!errors.length ? `${formDescriptionId}` : `${formDescriptionId} ${formMessageId}`
			}
			aria-invalid={!!errors.length}
			{...props}
		/>
	);
}

function Description({ className, ...props }: React.ComponentProps<'p'>) {
	const { formDescriptionId } = useFieldContext();

	return (
		<p
			data-slot='form-description'
			id={formDescriptionId}
			className={cn('text-sm text-muted-foreground', className)}
			{...props}
		/>
	);
}

function Message({ className, ...props }: React.ComponentProps<'p'>) {
	const { errors, formMessageId } = useFieldContext();
	const body = errors.length ? String(errors.at(0)?.message ?? '') : props.children;
	if (!body) return null;

	return (
		<p
			data-slot='form-message'
			id={formMessageId}
			className={cn('text-sm text-destructive', className)}
			{...props}
		>
			{body}
		</p>
	);
}

export const useFormError = () => {
	const [error, setError] = React.useState<Error | ConvexError<any> | null>(null);
	const [errorMessage, setErrorMessage] = React.useState<string>('');

	React.useEffect(() => {
		if (error instanceof ConvexError) {
			setErrorMessage(error.data.message);
		} else {
			setErrorMessage('');
		}
	}, [error]);

	const reset = () => {
		setError(null);
		setErrorMessage('');
	};

	const Message = ({ prefix }: { prefix?: React.ReactNode }) => {
		if (!errorMessage) return null;
		return (
			<InlineAlert variant='danger'>
				{prefix ? (
					<span className='mr-1 inline-block'>
						<span className='underline'>{prefix}:</span>
					</span>
				) : null}
				{errorMessage}
			</InlineAlert>
		);
	};

	return {
		error,
		errorMessage,
		setError,
		errorReset: reset,
		Message,
	};
};

export { useAppForm, useFormContext, useFieldContext, withForm };
