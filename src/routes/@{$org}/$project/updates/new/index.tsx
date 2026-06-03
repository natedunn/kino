import { useRef, useState } from 'react';
import { revalidateLogic, useForm } from '@tanstack/react-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, Navigate, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, LinkIcon, Settings2, Tag, X } from 'lucide-react';

import { MarkdownEditor, sanitizeEditorContent } from '@/components/editor';
import { InlineAlert } from '@/components/inline-alert';
import { SidebarSection } from '@/components/sidebar-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input-shadcn';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectPositioner,
  SelectTrigger,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { authClient } from '@/lib/convex/auth-client';
import { useCRPC } from '@/lib/convex/crpc';
import { useSidebarState } from '@/lib/hooks/use-sidebar-state';
import { cn } from '@/lib/utils';

import { CategoryBadge, type UpdateCategory } from '../-components/category-badge';
import { FeedbackSelector } from '../-components/feedback-selector';

const UPDATE_CATEGORIES = ['changelog', 'article', 'announcement'] as const;

const SIDEBAR_STORAGE_KEY = 'update-new-sidebar-state';

const DEFAULT_SIDEBAR_STATE = {
  relatedFeedback: false,
  settings: true,
  tags: true,
};

export const Route = createFileRoute('/@{$org}/$project/updates/new/')({
  component: NewUpdateRoute,
});

function NewUpdateRoute() {
  const params = Route.useParams();
  const navigate = useNavigate();
  const crpc = useCRPC();
  const session = authClient.useSession();
  const [tagInput, setTagInput] = useState('');
  const [formError, setFormError] = useState('');
  const pendingPublishRef = useRef<null | { id: string; slug: string }>(null);
  const { state: sidebarState, setSection: setSidebarSection } = useSidebarState(
    SIDEBAR_STORAGE_KEY,
    DEFAULT_SIDEBAR_STATE
  );

  const projectQuery = useQuery(
    crpc.project.getDetails.queryOptions({
      orgSlug: params.org,
      slug: params.project,
    })
  );
  const createMutation = useMutation(
    crpc.update.create.mutationOptions({
      onError: (error) => setFormError(error.message),
    })
  );
  const publishMutation = useMutation(
    crpc.update.publish.mutationOptions({
      onSuccess: () => {
        const created = pendingPublishRef.current;
        pendingPublishRef.current = null;
        form.reset();
        navigate({
          params: { ...params, slug: created?.slug ?? '' },
          to: '/@{$org}/$project/updates/$slug',
        });
      },
      onError: (error) => setFormError(error.message),
    })
  );

  const form = useForm({
    defaultValues: {
      category: 'changelog' as UpdateCategory,
      content: '',
      relatedFeedbackIds: [] as string[],
      tags: [] as string[],
      title: '',
    },
    onSubmit: async ({ value }) => {
      setFormError('');
      const project = projectQuery.data?.project;
      if (!project) return;

      const data = await createMutation.mutateAsync({
        category: value.category,
        content: sanitizeEditorContent(value.content),
        projectId: project.id,
        relatedFeedbackIds: value.relatedFeedbackIds.length > 0 ? value.relatedFeedbackIds : undefined,
        tags: value.tags,
        title: value.title,
      });
      form.reset();
      navigate({
        params: { ...params, slug: data.slug },
        to: '/@{$org}/$project/updates/$slug',
      });
    },
    validationLogic: revalidateLogic({
      mode: 'submit',
      modeAfterSubmission: 'change',
    }),
  });

  if (!session.data?.user) {
    return (
      <InlineAlert variant="warning">
        Sign in to write updates.
      </InlineAlert>
    );
  }

  if (projectQuery.isLoading) {
    return <div className="h-48 animate-pulse rounded-lg bg-muted/40" />;
  }

  if (!projectQuery.data?.permissions?.canEdit) {
    return (
      <Navigate
        params={{ org: params.org, project: params.project }}
        to="/@{$org}/$project/updates"
      />
    );
  }

  const project = projectQuery.data.project;

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    const currentTags = form.getFieldValue('tags') || [];
    if (!currentTags.includes(trimmed)) {
      form.setFieldValue('tags', [...currentTags, trimmed]);
    }
    setTagInput('');
  };

  const publishFromDraft = async () => {
    setFormError('');
    const value = {
      category: form.getFieldValue('category'),
      content: form.getFieldValue('content'),
      relatedFeedbackIds: form.getFieldValue('relatedFeedbackIds'),
      tags: form.getFieldValue('tags'),
      title: form.getFieldValue('title'),
    };
    if (!value.title.trim() || !sanitizeEditorContent(value.content)) return;

    try {
      const created = await createMutation.mutateAsync({
        category: value.category,
        content: sanitizeEditorContent(value.content),
        projectId: project.id,
        relatedFeedbackIds: value.relatedFeedbackIds.length > 0 ? value.relatedFeedbackIds : undefined,
        tags: value.tags,
        title: value.title,
      });
      pendingPublishRef.current = { id: created.updateId, slug: created.slug };
      await publishMutation.mutateAsync({ id: created.updateId });
    } catch {}
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      {/* Sticky header bar */}
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80">
        <div className="container flex items-center justify-between gap-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              params={{ org: params.org, project: params.project }}
              to="/@{$org}/$project/updates"
            >
              <ArrowLeft className="size-3.5" />
              <span className="sr-only sm:not-sr-only">Updates</span>
            </Link>
            <Separator className="h-4" orientation="vertical" />
            <span className="text-sm font-medium text-muted-foreground">New Update</span>
            <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" variant="outline">
              Draft
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <form.Subscribe
              selector={(state) => ({
                content: state.values.content,
                isSubmitting: state.isSubmitting,
                title: state.values.title,
              })}
            >
              {({ content, isSubmitting, title }) => {
                const missingRequired = !title.trim() || !sanitizeEditorContent(content);
                const savingDisabled = missingRequired || isSubmitting || createMutation.isPending;
                const publishingDisabled =
                  missingRequired ||
                  isSubmitting ||
                  createMutation.isPending ||
                  publishMutation.isPending;

                return (
                  <>
                    <Button
                      className={cn({
                        'select-none opacity-50 grayscale': savingDisabled,
                      })}
                      disabled={savingDisabled}
                      size="sm"
                      type="submit"
                      variant="outline"
                    >
                      {createMutation.isPending ? 'Saving...' : 'Save as Draft'}
                    </Button>
                    <Button
                      className={cn({
                        'select-none opacity-50 grayscale': publishingDisabled,
                      })}
                      disabled={publishingDisabled}
                      onClick={() => void publishFromDraft()}
                      size="sm"
                      type="button"
                    >
                      {publishMutation.isPending ? 'Publishing...' : 'Publish'}
                    </Button>
                  </>
                );
              }}
            </form.Subscribe>
          </div>
        </div>
      </div>

      {formError ? (
        <div className="container pt-4">
          <InlineAlert variant="danger">Unable to create update: {formError}</InlineAlert>
        </div>
      ) : null}

      {/* Two-column layout */}
      <div className="container flex-1 grid-cols-12 gap-8 md:grid">
        {/* Sidebar */}
        <div className="order-first border-l border-border/75 py-6 md:order-last md:col-span-4">
          <div className="sticky top-16 flex flex-col gap-6 pl-8">
            <SidebarSection
              icon={<Settings2 className="size-3.5" />}
              onOpenChange={(open) => setSidebarSection('settings', open)}
              open={sidebarState.settings}
              title="Settings"
            >
              <form.Field name="category">
                {(field) => (
                  <div className="flex flex-col gap-2">
                    <label className="text-sm text-muted-foreground">Category</label>
                    <Select
                      onValueChange={(value) => field.handleChange(value as UpdateCategory)}
                      value={field.state.value}
                    >
                      <SelectTrigger className="w-full">
                        <CategoryBadge category={field.state.value} />
                      </SelectTrigger>
                      <SelectPositioner>
                        <SelectContent>
                          {UPDATE_CATEGORIES.map((category) => (
                            <SelectItem key={category} value={category}>
                              <CategoryBadge category={category} />
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </SelectPositioner>
                    </Select>
                  </div>
                )}
              </form.Field>
            </SidebarSection>

            <SidebarSection
              icon={<Tag className="size-3.5" />}
              onOpenChange={(open) => setSidebarSection('tags', open)}
              open={sidebarState.tags}
              title="Tags"
            >
              <form.Field name="tags">
                {(field) => (
                  <div className="flex flex-col gap-3">
                    {(field.state.value || []).length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {(field.state.value || []).map((tag) => (
                          <Badge className="gap-1 pr-1" key={tag} variant="secondary">
                            {tag}
                            <button
                              aria-label={`Remove tag ${tag}`}
                              className="ml-0.5 rounded-sm p-0.5 hover:bg-muted hover:text-destructive"
                              onClick={() =>
                                field.handleChange((field.state.value || []).filter((value) => value !== tag))
                              }
                              type="button"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    <div className="flex items-center gap-2">
                      <Input
                        className="flex-1"
                        onChange={(event) => setTagInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            addTag();
                          }
                        }}
                        placeholder="Add tag..."
                        value={tagInput}
                      />
                      <Button onClick={addTag} size="sm" type="button" variant="outline">
                        Add
                      </Button>
                    </div>
                  </div>
                )}
              </form.Field>
            </SidebarSection>

            <SidebarSection
              icon={<LinkIcon className="size-3.5" />}
              onOpenChange={(open) => setSidebarSection('relatedFeedback', open)}
              open={sidebarState.relatedFeedback}
              title="Related Feedback"
            >
              <form.Field name="relatedFeedbackIds">
                {(field) => (
                  <div className="flex flex-col gap-2">
                    <FeedbackSelector
                      onChange={(ids) => field.handleChange(ids)}
                      projectId={project.id}
                      selectedIds={field.state.value}
                    />
                    <p className="text-xs text-muted-foreground">
                      Link feedback items addressed by this update.
                    </p>
                  </div>
                )}
              </form.Field>
            </SidebarSection>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex flex-col gap-6 py-8 md:col-span-8">
          <form.Field name="title">
            {(field) => (
              <div className="flex flex-col gap-2 pt-6">
                <label className="text-sm font-medium" htmlFor="update-title">Title</label>
                <Input
                  autoFocus
                  className="h-auto px-4 py-3 text-xl font-semibold tracking-tight md:text-2xl"
                  id="update-title"
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Update title..."
                  value={field.state.value}
                />
              </div>
            )}
          </form.Field>

          <form.Field name="content">
            {(field) => (
              <div className="flex flex-col gap-2">
                <MarkdownEditor
                  maxHeight="calc(100vh - 280px)"
                  minHeight="400px"
                  onChange={(html) => field.handleChange(html)}
                  placeholder="Write your update content..."
                  value={field.state.value}
                />
              </div>
            )}
          </form.Field>
        </div>
      </div>
    </form>
  );
}
