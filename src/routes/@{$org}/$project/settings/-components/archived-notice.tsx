import { InlineAlert } from '@/components/inline-alert';

// Static read-only banner for settings pages when the project is archived. The
// freeze is enforced server-side; this just tells the user why a save will fail
// and where to un-archive. Un-archiving lives on the General settings page.
export function ArchivedSettingsNotice({ className }: { className?: string }) {
	return (
		<InlineAlert className={className} variant='warning'>
			This project is archived and read-only. Un-archive it from General settings before making
			changes.
		</InlineAlert>
	);
}
