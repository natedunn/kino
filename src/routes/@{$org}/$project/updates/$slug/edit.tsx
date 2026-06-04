import { useMemo, useState } from 'react';
import { revalidateLogic, useForm } from '@tanstack/react-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Image, LinkIcon, Settings2, Tag, Trash2, X } from 'lucide-react';

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
import { CoverImageUpload } from '../-components/cover-image-upload';
import { FeedbackSelector } from '../-components/feedback-selector';

const UPDATE_CATEGORIES = ['changelog', 'article', 'announcement'] as const;
type UpdateFormValues = {
  category: UpdateCategory;
  content: string;
  coverImageId: string | null;
  relatedFeedbackIds: string[];
  tags: string[];
  title: string;
};

const SIDEBAR_STORAGE_KEY = 'update-editor-sidebar-state';

const DEFAULT_SIDEBAR_STATE = {
  coverImage: true,
  relatedFeedback: false,
  settings: true,
  tags: true,
};

export const Route = createFileRoute('/@{$org}/$project/updates/$slug/edit')({
  component: EditUpdateRoute,
});

function EditUpdateRoute() {
  const params = Route.useParams();
  const navigate = useNavigate();
  const crpc = useCRPC();
  const session = authClient.useSession();
  const [tagInput, setTagInput] = useState('');
  const [formError, setFormError] = useState('');
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
  const updateQuery = useQuery(
    crpc.update.getBySlug.queryOptions(
      {
        projectId: projectQuery.data?.project?.id ?? '',
        slug: params.slug,
      },
      { enabled: !!projectQuery.data?.project }
    )
  );

  const saveMutation = useMutation(
    crpc.update.update.mutationOptions({
      onError: (error) => setFormError(error.message),
      onSuccess: () => {
        navigate({
          params,
          to: '/@{$org}/$project/updates/$slug',
        });
      },
    })
  );
  const publishMutation = useMutation(
    crpc.update.publish.mutationOptions({
      onError: (error) => setFormError(error.message),
      onSuccess: () => {
        navigate({
          params,
          to: '/@{$org}/$project/updates/$slug',
        });
      },
    })
  );
  const unpublishMutation = useMutation(
    crpc.update.unpublish.mutationOptions({
      onError: (error) => setFormError(error.message),
    })
  );
  const deleteMutation = useMutation(
    crpc.update.remove.mutationOptions({
      onError: (error) => setFormError(error.message),
      onSuccess: () => {
        navigate({
          params: { org: params.org, project: params.project },
          to: '/@{$org}/$project/updates',
        });
      },
    })
  );

  const updateData = updateQuery.data;
  const update = updateData?.update;
  const relatedFeedbackIdsKey = useMemo(
    () => JSON.stringify((update?.relatedFeedbackIds ?? []).map(String)),
    [update?.relatedFeedbackIds]
  );
  const tagsKey = useMemo(
    () => JSON.stringify((update?.tags ?? []).map(String)),
    [update?.tags]
  );
  const formDefaultValues = useMemo<UpdateFormValues>(
    () => ({
      category: (update?.category ?? 'changelog') as UpdateCategory,
      content: update?.content ?? '',
      coverImageId: update?.coverImageId ?? null,
      relatedFeedbackIds: (update?.relatedFeedbackIds ?? []).map(String),
      tags: (update?.tags ?? []).map(String),
      title: update?.title ?? '',
    }),
    [
      relatedFeedbackIdsKey,
      tagsKey,
      update?.category,
      update?.content,
      update?.coverImageId,
      update?.id,
      update?.title,
    ]
  );

  const form = useForm({
    defaultValues: formDefaultValues,
    onSubmit: async ({ value }) => {
      if (!update) return;
      setFormError('');
      await saveMutation.mutateAsync({
        category: value.category,
        content: sanitizeEditorContent(value.content),
        coverImageId: value.coverImageId,
        id: update.id,
        relatedFeedbackIds: value.relatedFeedbackIds,
        tags: value.tags,
        title: value.title,
      });
    },
    validationLogic: revalidateLogic({
      mode: 'submit',
      modeAfterSubmission: 'change',
    }),
  });

  if (!session.data?.user) {
    return <InlineAlert variant="warning">Sign in to edit updates.</InlineAlert>;
  }

  if ((projectQuery.isLoading || updateQuery.isLoading) && !update) {
    return <div className="h-52 animate-pulse rounded-lg bg-muted/40" />;
  }

  if (!projectQuery.data?.project || !projectQuery.data.permissions.canEdit || !update || !updateData?.canEdit) {
    return <InlineAlert variant="warning">Update editing unavailable.</InlineAlert>;
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

  const isPublished = update.status === 'published';

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
              aria-label="Back to Update"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              params={params}
              to="/@{$org}/$project/updates/$slug"
            >
              <ArrowLeft className="size-3.5" />
              <span aria-hidden="true" className="hidden sm:inline">
                Back
              </span>
            </Link>
            <Separator className="h-4" orientation="vertical" />
            <span className="text-sm font-medium text-muted-foreground">Edit Update</span>
            {isPublished ? (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" variant="outline">
                Published
              </Badge>
            ) : (
              <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" variant="outline">
                Draft
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isPublished ? (
              <Button
                disabled={unpublishMutation.isPending}
                onClick={() => unpublishMutation.mutate({ id: update.id })}
                size="sm"
                type="button"
                variant="ghost"
              >
                {unpublishMutation.isPending ? 'Unpublishing...' : 'Unpublish'}
              </Button>
            ) : (
              <Button
                disabled={publishMutation.isPending}
                onClick={() => publishMutation.mutate({ id: update.id })}
                size="sm"
                type="button"
                variant="outline"
              >
                {publishMutation.isPending ? 'Publishing...' : 'Publish'}
              </Button>
            )}
            <form.Subscribe
              selector={(state) => ({
                content: state.values.content,
                isSubmitting: state.isSubmitting,
                title: state.values.title,
              })}
            >
              {({ content, isSubmitting, title }) => {
                const visuallyDisabled =
                  !title.trim() ||
                  !sanitizeEditorContent(content) ||
                  isSubmitting ||
                  saveMutation.isPending;

                return (
                  <Button
                    className={cn({
                      'select-none opacity-50 grayscale': visuallyDisabled,
                    })}
                    disabled={visuallyDisabled}
                    size="sm"
                    type="submit"
                  >
                    {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                );
              }}
            </form.Subscribe>
          </div>
        </div>
      </div>

      {formError ? (
        <div className="container pt-4">
          <InlineAlert variant="danger">Unable to update: {formError}</InlineAlert>
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
              icon={<Image className="size-3.5" />}
              onOpenChange={(open) => setSidebarSection('coverImage', open)}
              open={sidebarState.coverImage}
              title="Cover Image"
            >
              <form.Field name="coverImageId">
                {(field) => (
                  <CoverImageUpload
                    currentCoverImageUrl={updateData.coverImageUrl}
                    onChange={(value) => field.handleChange(value)}
                    onError={(message) => setFormError(message)}
                    updateId={update.id}
                  />
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

            <Separator />

            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Danger Zone
              </p>
              <Button
                className="w-full"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this update? This cannot be undone.')) {
                    deleteMutation.mutate({ id: update.id });
                  }
                }}
                size="sm"
                type="button"
                variant="destructive"
              >
                <Trash2 className="size-3.5" />
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Update'}
              </Button>
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex flex-col gap-6 py-8 md:col-span-8">
          <form.Field name="title">
            {(field) => (
              <div className="flex flex-col gap-2 pt-6">
                <label className="text-sm font-medium" htmlFor="update-title">Title</label>
                <Input
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
