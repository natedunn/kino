// Convex wraps a thrown server error into a single string like:
//   "[CONVEX M(project:update)] [Request ID: ...] Server Error\n
//    Uncaught CRPCError: <the real message> at <anonymous> (../../convex/...) at async ..."
// Surfacing that verbatim to users leaks the stack trace and request framing.
// `extractErrorMessage` pulls out just the human-readable message.
export function extractErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
	if (!error) return fallback;

	const anyError = error as { data?: { message?: string }; message?: string };

	// kitcn/CRPC surfaces a structured message on `.data` when available — prefer it.
	if (anyError.data?.message) return anyError.data.message;

	const raw = anyError.message ?? '';
	if (!raw) return fallback;

	// Strip the Convex framing: grab the text after "Uncaught <Name>Error:" and
	// before the first stack frame (" at <anonymous>" / " at async ...").
	const match = raw.match(/Uncaught \w*Error:\s*([\s\S]*?)\s+at\s+(?:<anonymous>|async\b)/);
	if (match?.[1]) return match[1].trim();

	return raw;
}
