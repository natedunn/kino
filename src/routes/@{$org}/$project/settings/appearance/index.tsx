import type {
	ProjectThemeInput,
	ProjectThemeMode,
	ProjectThemePresetId,
} from '@convex/project-theme';
import type { CSSProperties } from 'react';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
	createProjectThemeFromAccent,
	derivePrimaryButtonPalette,
	normalizeThemeColor,
	PROJECT_THEME_ACCENTS,
	PROJECT_THEME_PRESET_IDS,
	PROJECT_THEME_PRESETS,
	validateProjectTheme,
} from '@convex/project-theme';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { useCRPC } from '@/lib/convex/crpc';
import { crpcServer } from '@/lib/convex/crpc-server';
import { capturePostHogEvent } from '@/lib/posthog';
import { useProjectThemePreview } from '@/lib/project-theme';
import { titleMeta } from '@/lib/seo';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import * as m from '@/paraglide/messages.js';

export const Route = createFileRoute('/@{$org}/$project/settings/appearance/')({
	head: () => ({ meta: [titleMeta([m.meta_appearance(), m.meta_project_settings()])] }),
	loader: async ({ context, params }) => {
		const details = await context.queryClient.ensureQueryData(
			crpcServer.project.getDetails.queryOptions({ orgSlug: params.org, slug: params.project })
		);
		if (details?.project) {
			await context.queryClient.ensureQueryData(
				crpcServer.projectTheme.getEditorState.queryOptions({ projectId: details.project.id })
			);
		}
	},
	component: ProjectAppearanceRoute,
});

const THEME_LABELS: Record<ProjectThemePresetId, () => string> = {
	custom: m.theme_custom,
	forest: m.theme_green,
	golden: m.theme_yellow,
	kino: () => 'Kino',
	monochrome: m.theme_gray,
	orange: m.theme_orange,
	purple: m.theme_purple,
	red: m.theme_red,
	sunset: m.theme_pink,
	teal: m.theme_teal,
};

function ThemeSwatch({
	accent,
	active,
	compact = false,
	presetId,
}: {
	accent: string;
	active: boolean;
	compact?: boolean;
	presetId: ProjectThemePresetId;
}) {
	const theme = createProjectThemeFromAccent(accent, presetId) ?? PROJECT_THEME_PRESETS.kino;
	const getStyle = (mode: ProjectThemeMode) => {
		const palette = theme[mode];
		const button = derivePrimaryButtonPalette(palette.primary, mode, palette.primaryForeground);
		return {
			'--primary-button-border': button.border,
			'--primary-button-from': button.from,
			'--primary-button-to': button.to,
			color: palette.primaryForeground,
		} as CSSProperties;
	};
	const swatchClass =
		'absolute inset-0 items-center justify-center rounded-full border border-[var(--primary-button-border)] bg-gradient-to-tl from-[var(--primary-button-from)] to-[var(--primary-button-to)] shadow-sm ring-1 ring-white/25 ring-inset';

	return (
		<span
			aria-hidden='true'
			className={cn('relative block shrink-0', compact ? 'size-4' : 'mb-3 size-8')}
		>
			<span className={cn(swatchClass, 'flex dark:hidden')} style={getStyle('light')}>
				{active ? <Check className='size-4' strokeWidth={3} /> : null}
			</span>
			<span className={cn(swatchClass, 'hidden dark:flex')} style={getStyle('dark')}>
				{active ? <Check className='size-4' strokeWidth={3} /> : null}
			</span>
		</span>
	);
}

function ProjectAppearanceRoute() {
	const params = Route.useParams();
	const crpc = useCRPC();
	const details = useQuery(
		crpc.project.getDetails.queryOptions({ orgSlug: params.org, slug: params.project })
	);
	const projectId = details.data?.project?.id ?? '';
	const editor = useQuery(
		crpc.projectTheme.getEditorState.queryOptions({ projectId }, { enabled: !!projectId })
	);
	const publishMutation = useMutation(crpc.projectTheme.publish.mutationOptions());
	const setProjectThemePreview = useProjectThemePreview();

	const [theme, setTheme] = useState<ProjectThemeInput | null>(null);
	const [accentInput, setAccentInput] = useState('');
	const [publishedRevision, setPublishedRevision] = useState(0);
	const initializedProjectRef = useRef<string | null>(null);

	useEffect(() => {
		if (!projectId || !editor.data || initializedProjectRef.current === projectId) return;
		const initial = editor.data.publishedTheme ?? PROJECT_THEME_PRESETS.kino;
		setTheme(initial);
		setAccentInput(initial.light.primary);
		setPublishedRevision(editor.data.publishedRevision);
		initializedProjectRef.current = projectId;
	}, [editor.data, projectId]);

	const normalizedTheme = theme;
	const canUseCustomAccent = editor.data?.canUseCustomAccent ?? false;
	const issues = useMemo(
		() => (normalizedTheme ? validateProjectTheme(normalizedTheme) : []),
		[normalizedTheme]
	);
	const normalizedAccent = normalizeThemeColor(accentInput);
	const hasInvalidInput = canUseCustomAccent && !normalizedAccent;
	const customAccentLocked = !canUseCustomAccent && theme?.presetId === 'custom';

	if (!theme || editor.isPending) {
		return <div className='h-96 animate-pulse rounded-xl bg-muted/40' />;
	}
	const themeIds = PROJECT_THEME_PRESET_IDS.filter((presetId) => presetId !== 'custom');
	const mobileThemeIds =
		theme.presetId === 'custom' ? (['custom', ...themeIds] as const) : themeIds;
	const mobileThemeItems = mobileThemeIds.map((presetId) => {
		const accent = presetId === 'custom' ? theme.light.primary : PROJECT_THEME_ACCENTS[presetId];
		return {
			label: (
				<>
					<ThemeSwatch accent={accent} active={false} compact presetId={presetId} />
					{THEME_LABELS[presetId]()}
				</>
			),
			value: presetId,
		};
	});

	const updateAccent = (value: string) => {
		setAccentInput(value);
		const next = createProjectThemeFromAccent(value, 'custom');
		if (next) {
			setTheme(next);
			setProjectThemePreview?.(next);
		}
	};

	const selectPreset = (presetId: ProjectThemePresetId) => {
		const accent = PROJECT_THEME_ACCENTS[presetId];
		const next = createProjectThemeFromAccent(accent, presetId);
		if (!next) return;
		setAccentInput(accent);
		setTheme(next);
		setProjectThemePreview?.(next);
	};

	const handlePublish = async () => {
		if (!normalizedTheme || issues.length) return;
		try {
			const result = await publishMutation.mutateAsync({
				dark: normalizedTheme.dark,
				expectedPublishedRevision: publishedRevision,
				light: normalizedTheme.light,
				presetId: normalizedTheme.presetId,
				projectId,
			});
			setPublishedRevision(result.publishedRevision);
			capturePostHogEvent('project_theme_published', {
				is_default: normalizedTheme.presetId === 'kino',
				preset_id: normalizedTheme.presetId,
				project_id: projectId,
				published_revision: result.publishedRevision,
			});
			await toast.success(m.project_appearance_published());
			await editor.refetch();
		} catch {
			// Global mutation error handling reports the detailed failure.
		}
	};

	return (
		<section className='max-w-5xl space-y-8'>
			<header className='border-b pb-4'>
				<h2 className='text-xl font-semibold'>{m.project_appearance_title()}</h2>
				<p className='mt-1 text-sm text-muted-foreground'>{m.project_appearance_description()}</p>
			</header>

			<div>
				<h3 className='text-sm font-semibold'>{m.project_appearance_themes()}</h3>
				<div className='mt-3 sm:hidden'>
					<Select
						items={mobileThemeItems}
						value={theme.presetId}
						onValueChange={(value) => {
							if (value && value !== 'custom') selectPreset(value);
						}}
					>
						<SelectTrigger aria-label={m.project_appearance_theme()} className='w-full'>
							<SelectValue placeholder={m.project_appearance_choose_theme()} />
						</SelectTrigger>
						<SelectContent>
							{mobileThemeItems.map((item) => (
								<SelectItem key={item.value} value={item.value} disabled={item.value === 'custom'}>
									{item.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className='mt-3 hidden gap-3 sm:grid sm:grid-cols-3 lg:grid-cols-5'>
					{themeIds.map((presetId) => {
						const accent = PROJECT_THEME_ACCENTS[presetId];
						const active = theme.presetId === presetId;
						return (
							<button
								key={presetId}
								type='button'
								aria-pressed={active}
								onClick={() => selectPreset(presetId)}
								className={cn(
									'rounded-xl border p-3 text-left transition-colors hocus:border-foreground/40 hocus:bg-muted',
									active && 'border-primary bg-muted ring-1 ring-primary'
								)}
							>
								<ThemeSwatch accent={accent} active={active} presetId={presetId} />
								<span className='text-sm font-medium'>{THEME_LABELS[presetId]()}</span>
							</button>
						);
					})}
				</div>
			</div>

			<div className='max-w-xl'>
				{canUseCustomAccent ? (
					<div className='mb-6 space-y-2'>
						<label className='text-sm font-medium' htmlFor='project-accent'>
							{m.project_appearance_accent()}
						</label>
						<p className='text-xs text-muted-foreground'>
							{m.project_appearance_accent_description()}
						</p>
						<div className='flex max-w-sm gap-2'>
							<input
								aria-label={m.project_appearance_accent_picker()}
								type='color'
								value={normalizedAccent ?? '#000000'}
								onChange={(event) => updateAccent(event.target.value)}
								className='h-8 w-10 cursor-pointer rounded border bg-background p-1'
							/>
							<Input
								id='project-accent'
								value={accentInput}
								onChange={(event) => updateAccent(event.target.value)}
								className='font-mono'
								aria-invalid={hasInvalidInput}
							/>
						</div>
						{hasInvalidInput ? (
							<p className='text-sm text-destructive'>{m.project_appearance_invalid_hex()}</p>
						) : null}
						<div className='space-y-2 pt-3'>
							{issues.length ? (
								issues.map((issue) => (
									<p key={`${issue.mode}-${issue.label}`} className='text-sm text-destructive'>
										{m.theme_contrast_issue({
											actual: issue.actual.toFixed(2),
											label: issue.label,
											minimum: issue.minimum,
											mode: issue.mode,
										})}
									</p>
								))
							) : (
								<p className='flex items-center gap-2 text-sm text-green-700 dark:text-green-400'>
									<Check className='size-4' />
									{m.project_appearance_valid_palettes()}
								</p>
							)}
						</div>
					</div>
				) : customAccentLocked ? (
					<p className='mb-6 text-xs text-muted-foreground'>{m.project_appearance_locked()}</p>
				) : null}
			</div>

			<div className='flex justify-end border-t pt-5'>
				<Button
					onClick={() => void handlePublish()}
					disabled={
						!normalizedTheme || issues.length > 0 || publishMutation.isPending || customAccentLocked
					}
				>
					{publishMutation.isPending ? m.common_saving() : m.profile_save_changes()}
				</Button>
			</div>
		</section>
	);
}
