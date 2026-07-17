/**
 * Normalizes a key for matching: single characters are lowercased so letter
 * shortcuts are case-insensitive, while named keys (Escape, ArrowDown, …) and
 * symbols/digits are kept verbatim.
 */
export function normalizeKey(key: string): string {
	return key.length === 1 ? key.toLowerCase() : key;
}

// Widget roles that consume their own keystrokes (typeahead, arrow nav, etc.).
// While focus is inside one of these we must not hijack single-letter keys.
const KEY_CONSUMING_ROLES = [
	'textbox',
	'searchbox',
	'combobox',
	'listbox',
	'option',
	'menu',
	'menubar',
	'menuitem',
	'menuitemcheckbox',
	'menuitemradio',
	'slider',
	'spinbutton',
	'tree',
	'treeitem',
	'grid',
	'gridcell',
];

const KEY_CONSUMING_SELECTOR = [
	'[contenteditable="true"]',
	...KEY_CONSUMING_ROLES.map((role) => `[role="${role}"]`),
].join(', ');

/**
 * True when the event target is a field/widget that handles its own typing or
 * key navigation, so we never hijack single-letter keystrokes from inputs,
 * textareas, native selects, the command palette, the markdown editor, or
 * combobox/listbox/menu-style controls (e.g. our Select while focused/open).
 */
export function isEditableTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;

	const tag = target.tagName;
	if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
	if (target.isContentEditable) return true;
	if (target.closest(KEY_CONSUMING_SELECTOR)) return true;

	return false;
}

/**
 * True when a modifier that we want to leave to the browser/OS is held. We
 * intentionally allow Shift so symbols like "?" still resolve, while bailing on
 * ⌘/Ctrl/Alt to avoid stepping on system and browser shortcuts.
 */
export function hasReservedModifier(event: KeyboardEvent): boolean {
	return event.metaKey || event.ctrlKey || event.altKey;
}

// Open dialogs/menus render with one of these markers. We suppress page-level
// single-key shortcuts while any such overlay is open so a stray keystroke on a
// non-editable control inside it can't trigger navigation underneath the layer.
const OPEN_OVERLAY_SELECTOR = [
	'[data-slot="dialog-content"]',
	'[role="dialog"]',
	'[role="alertdialog"]',
	'[role="menu"][data-open]',
	'[data-slot="popover-content"]',
].join(', ');

/**
 * True when an overlay (dialog, command palette, popover, open menu) is present
 * in the DOM. Used to keep single-key shortcuts inert while a layer is open.
 */
export function isOverlayOpen(): boolean {
	return document.querySelector(OPEN_OVERLAY_SELECTOR) !== null;
}
