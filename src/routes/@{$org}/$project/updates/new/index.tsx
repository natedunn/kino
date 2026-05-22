import { useRef, useState } from 'react';
import { revalidateLogic, useForm } from '@tanstack/react-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute, Navigate, useNavigate } from '@tanstack/react-router';
import { FileText, X } from 'lucide-react';

import { MarkdownEditor, sanitizeEditorContent } from '@/components/editor';
import { InlineAlert } from '@/components/inline-alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { FeedbackSelector } from '../-components/feedback-selector';

const UPDATE_CATEGORIES = ['changelog', 'article', 'announcement'] as const;

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
    <div className="container py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-start gap-4">
          <div className="mt-1">
            <FileText aria-hidden="true" className="size-8 text-primary dark:text-blue-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Create Update</h1>
            <p className="text-muted-foreground">Write a new update for your project.</p>
          </div>
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

          {formError ? <InlineAlert variant="danger">Unable to create update: {formError}</InlineAlert> : null}

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
                      disabled={createMutation.isPending}
                      type="submit"
                      variant="outline"
                    >
                      {createMutation.isPending ? 'Saving...' : 'Save as Draft'}
                    </Button>
                    <Button
                      className={cn({
                        'select-none opacity-50 grayscale': publishingDisabled,
                      })}
                      disabled={createMutation.isPending || publishMutation.isPending}
                      onClick={() => void publishFromDraft()}
                      type="button"
                    >
                      {publishMutation.isPending ? 'Publishing...' : 'Publish'}
                    </Button>
                  </>
                );
              }}
            </form.Subscribe>
          </div>
        </form>
      </div>
    </div>
  );
}
