import { cn } from '@/lib/utils';

type EditorContentDisplayProps = {
  content: string;
  className?: string;
};

export function EditorContentDisplay({ content, className }: EditorContentDisplayProps) {
  // Check if content looks like HTML (from new editor) or plain text (legacy)
  const isHTML = content.startsWith('<') && content.includes('</');

  if (!isHTML) {
    // Legacy plain text content - preserve whitespace
    return <div className={cn('whitespace-pre-wrap', className)}>{content}</div>;
  }

  return (
    <div
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none',
        // Headings
        'prose-headings:font-semibold',
        'prose-h4:text-[1.1rem] prose-h5:text-[1rem] prose-h6:text-[0.95rem]',
        // Links - distinct from underline
        'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
        // Code
        'prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none',
        'prose-pre:bg-muted prose-pre:border prose-pre:p-4',
        // Blockquotes
        'prose-blockquote:border-l-2 prose-blockquote:border-border prose-blockquote:pl-4 prose-blockquote:text-muted-foreground prose-blockquote:not-italic',
        // Lists
        'prose-ul:my-2 prose-ol:my-2 prose-li:my-0',
        className
      )}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
