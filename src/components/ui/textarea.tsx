'use client';

import { forwardRef, useEffect, useRef, useState } from 'react';
import { mergeRefs } from 'react-merge-refs';

import { cn } from '@/lib/utils';

type ChildrenState = {
  isDirty: boolean;
  maxLength: number;
  value: React.TextareaHTMLAttributes<HTMLTextAreaElement>['value'];
};

type OnChangeData = {
  isDirty: boolean;
};

export type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  adaptive?: boolean | number;
  children?: ((state: ChildrenState) => React.ReactNode) | React.ReactNode;
  error?: string;
  onChange?: (
    event: React.ChangeEvent<HTMLTextAreaElement>,
    data: OnChangeData
  ) => void;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      adaptive = true,
      children,
      className,
      maxLength = 1000,
      onChange,
      rows = 2,
      ...props
    },
    ref
  ) => {
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [value, setValue] = useState(props.defaultValue ?? '');
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
      if (inputRef.current && adaptive) {
        inputRef.current.style.height = 'auto';
        const scrollHeight = inputRef.current.scrollHeight;
        const heightBumper = typeof adaptive === 'number' ? adaptive : 0;
        inputRef.current.style.height = value ? `${scrollHeight + heightBumper}px` : 'auto';
      }
    }, [adaptive, value]);

    useEffect(() => {
      if ((props.defaultValue && props.defaultValue !== value) || (!props.defaultValue && value)) {
        setIsDirty(true);
      } else {
        setIsDirty(false);
      }
    }, [props.defaultValue, value]);

    const renderChildren = () => {
      if (typeof children === 'function') {
        return children({ isDirty, maxLength, value });
      }
      return children;
    };

    return (
      <>
        <textarea
          {...props}
          className={cn(
            'flex min-h-16 w-full rounded-md border border-input bg-white px-3 py-2 text-base transition-[color] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:ring-destructive/40',
            adaptive && 'resize-none',
            className
          )}
          maxLength={maxLength}
          onChange={(event) => {
            setValue(event.target.value);
            onChange?.(event, { isDirty });
          }}
          ref={mergeRefs([inputRef, ref])}
          rows={rows}
        />
        {renderChildren()}
      </>
    );
  }
);

Textarea.displayName = 'Textarea';
