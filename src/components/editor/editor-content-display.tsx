import { useMemo } from 'react';

import { cn } from '@/lib/utils';

import { sanitizeEditorContent } from './sanitize-content';

type EditorContentDisplayProps = {
  className?: string;
  content: string;
};

export function EditorContentDisplay({ className, content }: EditorContentDisplayProps) {
  const isHTML = content.startsWith('<') && content.includes('</');
  const processedContent = useMemo(() => (isHTML ? sanitizeEditorContent(content) : content), [content, isHTML]);

  if (!isHTML) {
    return <div className={cn('whitespace-pre-wrap', className)}>{content}</div>;
  }

  return (
    <div
      className={cn(
        'prose max-w-none pb-1 text-foreground dark:prose-invert',
        'prose-headings:font-semibold',
        'prose-h4:text-[1.1rem] prose-h5:text-[1rem] prose-h6:text-[0.95rem]',
        'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
        'prose-code:before:content-none prose-code:after:content-none',
        'prose-blockquote:border-l-2 prose-blockquote:border-border prose-blockquote:pl-4 prose-blockquote:text-muted-foreground prose-blockquote:not-italic prose-blockquote:before:content-none prose-blockquote:after:content-none',
        '[&>blockquote:first-child>*:first-child]:mt-0',
        'prose-ol:my-1.5 prose-ul:my-1.5 prose-li:my-0 prose-li:leading-snug',
        className
      )}
      dangerouslySetInnerHTML={{ __html: processedContent }}
    />
  );
}
