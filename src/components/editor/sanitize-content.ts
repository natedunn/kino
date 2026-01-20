/**
 * Sanitizes HTML content from the editor before saving.
 * - Collapses consecutive empty paragraphs to max 2
 * - Removes trailing empty paragraphs
 */
export function sanitizeEditorContent(html: string): string {
  if (!html) return html;

  // Collapse 3+ consecutive empty paragraphs to 2
  // Empty paragraphs in Tiptap are typically <p></p> or <p><br></p>
  let sanitized = html.replace(
    /(<p>(<br\/?>)?<\/p>\s*){3,}/gi,
    '<p></p><p></p>'
  );

  // Remove trailing empty paragraphs (keep content clean)
  sanitized = sanitized.replace(/(<p>(<br\/?>)?<\/p>\s*)+$/gi, '');

  // If content is just empty paragraphs, return empty
  if (/^(<p>(<br\/?>)?<\/p>\s*)+$/.test(sanitized)) {
    return '';
  }

  return sanitized;
}
