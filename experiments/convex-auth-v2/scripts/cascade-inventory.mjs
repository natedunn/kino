import { readFileSync, writeFileSync } from 'node:fs';

import ts from 'typescript';

const sourcePath = new URL('../../../convex/functions/schema.ts', import.meta.url);
const source = ts.createSourceFile(
	'schema.ts',
	readFileSync(sourcePath, 'utf8'),
	ts.ScriptTarget.Latest,
	true
);
const tables = new Map();
for (const statement of source.statements)
	if (ts.isVariableStatement(statement))
		for (const declaration of statement.declarationList.declarations) {
			const call = declaration.initializer;
			if (
				call &&
				ts.isCallExpression(call) &&
				call.expression.getText(source) === 'convexTable' &&
				ts.isStringLiteral(call.arguments[0])
			)
				tables.set(declaration.name.getText(source), {
					name: call.arguments[0].text,
					fields: call.arguments[1],
					call,
				});
		}
const rows = [];
for (const table of tables.values()) {
	if (!ts.isObjectLiteralExpression(table.fields)) continue;
	const indexes = [
		...table.call.getText(source).matchAll(/index\('([^']+)'\)\.on\(([\s\S]*?)\)/g),
	].map((match) => ({
		name: match[1],
		fields: [...match[2].matchAll(/table\.(\w+)/g)].map((m) => m[1]),
	}));
	for (const field of table.fields.properties) {
		if (!ts.isPropertyAssignment(field)) continue;
		let reference, implicit;
		function visit(node) {
			if (ts.isCallExpression(node)) {
				if (
					ts.isPropertyAccessExpression(node.expression) &&
					node.expression.name.text === 'references'
				)
					reference = node;
				if (
					ts.isIdentifier(node.expression) &&
					node.expression.text === 'id' &&
					ts.isStringLiteral(node.arguments[0])
				)
					implicit = node.arguments[0].text;
			}
			ts.forEachChild(node, visit);
		}
		visit(field.initializer);
		if (!reference && !implicit) continue;
		const targetVariable = reference?.arguments[0]
			?.getText(source)
			.match(/(?:=>\s*)(\w+)\.id/)?.[1];
		const target = targetVariable ? tables.get(targetVariable)?.name : implicit;
		if (!target) throw new Error('Unresolved reference: ' + field.name.getText(source));
		const explicit = reference?.arguments[1]?.getText(source).match(/onDelete:\s*'([^']+)'/)?.[1];
		const column = field.name.getText(source);
		rows.push({
			table: table.name,
			field: column,
			target,
			action: explicit ?? 'no action (restrict)',
			declaration: reference ? 'explicit reference' : 'implicit id reference',
			indexes: indexes.filter((i) => i.fields[0] === column).map((i) => i.name),
			line: source.getLineAndCharacterOfPosition(field.getStart(source)).line + 1,
		});
	}
}
writeFileSync(
	new URL('../relationships/cascade-inventory.json', import.meta.url),
	JSON.stringify(
		{
			source: 'convex/functions/schema.ts',
			kitcnVersion: '0.31.1',
			defaultEvidence: 'node_modules/kitcn/dist/schema-DbPcDW-N.js:882-894',
			rows,
		},
		null,
		2
	) + '\n'
);
writeFileSync(
	new URL('../relationships/CASCADE-MAP.md', import.meta.url),
	'# Kino declared relationship inventory\n\nGenerated from the TypeScript AST with `node scripts/cascade-inventory.mjs`.\nKitcn 0.31.1 defaults unspecified onDelete to no action and rejects referenced\nparent deletion, just like restrict (installed schema-DbPcDW-N.js:882–894).\nThis inventories declared scalar references, not external objects or application\ntriggers. String-based links such as project.orgSlug require separate lifecycle\nwork. Indexes shown have this field first; missing indexes need review, not an\nassumption that a full scan is safe.\n\n| Child field | Parent | Delete behavior | Leading indexes | Schema line |\n| --- | --- | --- | --- | --- |\n' +
		rows
			.map(
				(r) =>
					`| ${r.table}.${r.field} | ${r.target} | ${r.action} | ${r.indexes.join(', ') || 'None declared'} | ${r.line} |`
			)
			.join('\n') +
		'\n'
);
console.log('Inventoried', rows.length, 'declared relationships across', tables.size, 'tables');
