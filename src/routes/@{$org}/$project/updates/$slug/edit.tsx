import { useEffect, useState } from 'react';
import { revalidateLogic, useForm } from '@tanstack/react-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { FileText, X } from 'lucide-react';

import { MarkdownEditor, sanitizeEditorContent } from '@/components/editor';
import { InlineAlert } from '@/components/inline-alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input-shadcn';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectPositioner,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { authClient } from '@/lib/convex/auth-client';
import { useCRPC } from '@/lib/convex/crpc';
import { cn } from '@/lib/utils';

import { CategoryBadge, type UpdateCategory } from '../-components/category-badge';
import { CoverImageUpload } from '../-components/cover-image-upload';
import { FeedbackSelector } from '../-components/feedback-selector';

const UPDATE_CATEGORIES = ['changelog', 'article', 'announcement'] as const;

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

  const form = useForm({
    defaultValues: {
      category: 'changelog' as UpdateCategory,
      content: '',
      coverImageId: null as string | null,
      relatedFeedbackIds: [] as string[],
      tags: [] as string[],
      title: '',
    },
    onSubmit: async ({ value }) => {
      if (!update) return;
      setFormError('');
      await saveMutation.mutateAsync({
        category: value.category,
        content: sanitizeEditorContent(value.content),
        coverImageId: value.coverImageId,
        id: update.id,
        relatedFeedbackIds: value.relatedFeedbackIds.length > 0 ? value.relatedFeedbackIds : undefined,
        tags: value.tags,
        title: value.title,
      });
    },
    validationLogic: revalidateLogic({
      mode: 'submit',
      modeAfterSubmission: 'change',
    }),
  });

  useEffect(() => {
    if (!update) return;
    form.reset({
      category: update.category,
      content: update.content,
      coverImageId: update.coverImageId ?? null,
      relatedFeedbackIds: (update.relatedFeedbackIds ?? []).map(String),
      tags: update.tags ?? [],
      title: update.title,
    });
  }, [form, update?.id]);

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
    <div className="container py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="mt-1">
              <FileText aria-hidden="true" className="size-8 text-primary dark:text-blue-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Edit Update</h1>
              <p className="text-muted-foreground">
                {isPublished ? 'This update is published.' : 'This update is a draft.'}
              </p>
            </div>
          </div>
          <Link
            className={cn(buttonVariants({ variant: 'outline' }))}
            params={params}
            to="/@{$org}/$project/updates/$slug"
          >
            Back to update
          </Link>
        </div>

        <form
          className="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <form.Field name="title">
            {(field) => (
              <div className="grid gap-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Update title..."
                  value={field.state.value}
                />
              </div>
            )}
          </form.Field>

          <form.Field name="category">
            {(field) => (
              <div className="grid gap-2">
                <label className="text-sm font-medium">Category</label>
                <Select
                  onValueChange={(value) => field.handleChange(value as UpdateCategory)}
                  value={field.state.value}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
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

          <form.Field name="content">
            {(field) => (
              <div className="grid gap-2">
                <label className="text-sm font-medium">Content</label>
                <MarkdownEditor
                  maxHeight="600px"
                  minHeight="200px"
                  onChange={(html) => field.handleChange(html)}
                  placeholder="Write your update content..."
                  value={field.state.value}
                />
              </div>
            )}
          </form.Field>

          <form.Field name="tags">
            {(field) => (
              <div className="grid gap-2">
                <label className="text-sm font-medium">Tags</label>
                <div className="flex flex-wrap items-center gap-2">
                  {(field.state.value || []).map((tag) => (
                    <Badge className="gap-1" key={tag} variant="secondary">
                      {tag}
                      <button
                        className="ml-1 hover:text-destructive"
                        onClick={() =>
                          field.handleChange((field.state.value || []).filter((value) => value !== tag))
                        }
                        type="button"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  <div className="flex items-center gap-2">
                    <Input
                      className="w-32"
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
              </div>
            )}
          </form.Field>

          <form.Field name="relatedFeedbackIds">
            {(field) => (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Related Feedback</label>
                <FeedbackSelector
                  onChange={(ids) => field.handleChange(ids)}
                  projectId={project.id}
                  selectedIds={field.state.value}
                />
                <p className="text-xs text-muted-foreground">
                  Link feedback items that are addressed by this update.
                </p>
              </div>
            )}
          </form.Field>

          {formError ? <InlineAlert variant="danger">Unable to update: {formError}</InlineAlert> : null}

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
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
                      disabled={saveMutation.isPending}
                      type="submit"
                    >
                      {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                  );
                }}
              </form.Subscribe>
              {isPublished ? (
                <Button
                  disabled={unpublishMutation.isPending}
                  onClick={() => unpublishMutation.mutate({ id: update.id })}
                  type="button"
                  variant="outline"
                >
                  {unpublishMutation.isPending ? 'Unpublishing...' : 'Unpublish'}
                </Button>
              ) : (
                <Button
                  disabled={publishMutation.isPending}
                  onClick={() => publishMutation.mutate({ id: update.id })}
                  type="button"
                  variant="outline"
                >
                  {publishMutation.isPending ? 'Publishing...' : 'Publish'}
                </Button>
              )}
            </div>
            <Button
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (window.confirm('Are you sure you want to delete this update? This cannot be undone.')) {
                  deleteMutation.mutate({ id: update.id });
                }
              }}
              type="button"
              variant="destructive"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
