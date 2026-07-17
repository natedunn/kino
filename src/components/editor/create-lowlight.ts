import bash from 'highlight.js/lib/languages/bash';
import go from 'highlight.js/lib/languages/go';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import plaintext from 'highlight.js/lib/languages/plaintext';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import shell from 'highlight.js/lib/languages/shell';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import { createLowlight } from 'lowlight';

import css from 'highlight.js/lib/languages/css';

export function createEditorLowlight() {
	const lowlight = createLowlight({
		bash,
		css,
		go,
		javascript,
		json,
		markdown,
		plaintext,
		python,
		rust,
		shell,
		sql,
		typescript,
		xml,
		yaml,
	});

	lowlight.registerAlias({
		javascript: ['js', 'jsx'],
		typescript: ['ts', 'tsx'],
		xml: ['html'],
	});

	return lowlight;
}
