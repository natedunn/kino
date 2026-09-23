/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";
import type { GenericId as Id } from "convex/values";

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: {
  adminOperations: {
    getSystemMetrics: FunctionReference<
      "query",
      "public",
      {},
      {
        counts: {
          feedback: number;
          organizations: number;
          projects: number;
          users: number;
        };
        recentUsers: Array<{
          createdAt: number;
          email: string | null;
          id: Id<"users">;
          name: string | null;
        }>;
      }
    >;
    list: FunctionReference<
      "query",
      "public",
      {},
      Array<
        | {
            attempt: number;
            createdAt: number;
            jobId: Id<"storageCleanupJobs">;
            kind: "storage_cleanup";
            lastError: null | string;
            maxAttempt: number;
            projectId: Id<"projects">;
            staleAfter: number;
            state: "pending" | "running" | "failed";
            targetId: Id<"fileObjects">;
          }
        | {
            attempt: null;
            createdAt: number;
            jobId: Id<"projectDeletionJobs">;
            kind: "project_deletion";
            lastError: null | string;
            maxAttempt: null;
            projectId: Id<"projects">;
            staleAfter: number;
            state: "pending" | "running" | "failed";
            targetId: Id<"projects">;
          }
        | {
            attempt: null;
            createdAt: number;
            jobId: Id<"feedbackDeletionJobs">;
            kind: "feedback_deletion";
            lastError: null | string;
            maxAttempt: null;
            projectId: null | Id<"projects">;
            staleAfter: number;
            state: "pending" | "running" | "failed";
            targetId: Id<"feedback">;
          }
        | {
            attempt: null;
            createdAt: number;
            jobId: Id<"updateDeletionJobs">;
            kind: "update_deletion";
            lastError: null | string;
            maxAttempt: null;
            projectId: null | Id<"projects">;
            staleAfter: number;
            state: "pending" | "running" | "failed";
            targetId: Id<"updates">;
          }
        | {
            attempt: null;
            createdAt: number;
            jobId: Id<"storageProjectPurges">;
            kind: "storage_project_purge";
            lastError: null | string;
            maxAttempt: null;
            projectId: Id<"projects">;
            staleAfter: number;
            state: "pending" | "running" | "failed";
            targetId: Id<"projects">;
          }
        | {
            attempt: null;
            createdAt: number;
            jobId: Id<"feedbackBoards">;
            kind: "board_deletion";
            lastError: null | string;
            maxAttempt: null;
            projectId: Id<"projects">;
            staleAfter: number;
            state: "pending" | "running" | "failed";
            targetId: Id<"feedbackBoards">;
          }
      >
    >;
    listAlerts: FunctionReference<
      "query",
      "public",
      {},
      Array<{
        _creationTime: number;
        _id: Id<"operationalAlerts">;
        attempt: number;
        deliveryStatus: "pending" | "accepted" | "failed" | "disabled";
        firstSeenAt: number;
        jobId: string;
        key: string;
        kind:
          | "storage_cleanup"
          | "project_deletion"
          | "feedback_deletion"
          | "update_deletion"
          | "storage_project_purge"
          | "board_deletion";
        lastAttemptAt?: number;
        lastSeenAt: number;
        lastSentAt?: number;
        resolvedAt?: number;
        scheduledAt?: number;
        state: "failed" | "stalled";
        suppressedUntil?: number;
        targetId: string;
      }>
    >;
    listMaintenance: FunctionReference<
      "query",
      "public",
      {},
      Array<{
        _creationTime: number;
        _id: Id<"maintenanceJobs">;
        changed: number;
        checked: number;
        childCursor?: string;
        completedAt?: number;
        countA: number;
        countB: number;
        createdAt: number;
        dryRun: boolean;
        entityCursor?: string;
        entityId?: string;
        error?: string;
        kind: "feedback_upvotes" | "update_counts";
        phase?: "comments" | "emotes";
        requestedByUserId: Id<"users">;
        status: "pending" | "running" | "completed" | "failed";
        updatedAt: number;
      }>
    >;
    resume: FunctionReference<
      "mutation",
      "public",
      {
        job:
          | { jobId: Id<"storageCleanupJobs">; kind: "storage_cleanup" }
          | { jobId: Id<"projectDeletionJobs">; kind: "project_deletion" }
          | { jobId: Id<"feedbackDeletionJobs">; kind: "feedback_deletion" }
          | { jobId: Id<"updateDeletionJobs">; kind: "update_deletion" }
          | { jobId: Id<"storageProjectPurges">; kind: "storage_project_purge" }
          | { jobId: Id<"feedbackBoards">; kind: "board_deletion" };
      },
      null
    >;
    resumeMaintenance: FunctionReference<
      "mutation",
      "public",
      { jobId: Id<"maintenanceJobs"> },
      null
    >;
    startMaintenance: FunctionReference<
      "mutation",
      "public",
      { dryRun: boolean; kind: "feedback_upvotes" | "update_counts" },
      Id<"maintenanceJobs">
    >;
  };
  auth: {
    isAuthenticated: FunctionReference<"query", "public", {}, boolean>;
    refreshSession: FunctionReference<
      "mutation",
      "public",
      { refreshToken: string },
      | {
          kind: "rotated";
          tokens: {
            accessToken: string;
            accessTokenExpiresAt: number;
            refreshToken: string;
            refreshTokenExpiresAt: number;
            userId: string;
          };
        }
      | {
          accessToken: string;
          accessTokenExpiresAt: number;
          kind: "reused";
          refreshTokenExpiresAt: number;
          userId: string;
        }
      | { kind: "noSession" }
    >;
    signOut: FunctionReference<
      "mutation",
      "public",
      { refreshToken: string },
      null
    >;
  };
  feedback: {
    addRelation: FunctionReference<
      "mutation",
      "public",
      { feedbackId: Id<"feedback">; relatedFeedbackId: Id<"feedback"> },
      null
    >;
    create: FunctionReference<
      "mutation",
      "public",
      {
        boardId: Id<"feedbackBoards">;
        firstComment: string;
        projectId: Id<"projects">;
        title: string;
      },
      {
        feedbackCommentId: Id<"feedbackComments">;
        feedbackId: Id<"feedback">;
        slug: string;
      }
    >;
    getDetail: FunctionReference<
      "query",
      "public",
      { projectId: Id<"projects">; slug: string },
      null | {
        assignedProfile: null | {
          id: Id<"profiles">;
          imageUrl: string | null;
          name: string;
          username: string;
        };
        author: null | {
          id: Id<"profiles">;
          imageUrl: string | null;
          name: string;
          username: string;
        };
        board: null | {
          icon: string | null;
          id: Id<"feedbackBoards">;
          name: string;
          slug: string;
        };
        currentProfile: null | {
          id: Id<"profiles">;
          imageUrl: string | null;
          name: string;
          username: string;
        };
        feedback: {
          answerCommentId: Id<"feedbackComments"> | null;
          assignedProfileId: Id<"profiles"> | null;
          boardId: Id<"feedbackBoards">;
          createdAt: number;
          id: Id<"feedback">;
          priority: "none" | "low" | "medium" | "high" | "urgent";
          slug: string;
          status: "open" | "in-progress" | "closed" | "completed" | "paused";
          tags: Array<string>;
          target: string | null;
          targetGranularity: "day" | "month" | "quarter" | "year" | null;
          title: string;
          upvotes: number;
        };
        firstComment: {
          author: null | {
            id: Id<"profiles">;
            imageUrl: string | null;
            name: string;
            username: string;
          };
          canDelete: boolean;
          canEdit: boolean;
          content: string;
          creationTime: number;
          emotes: Array<{
            authorProfileIds: Array<string>;
            content: string;
            count: number;
          }>;
          id: Id<"feedbackComments">;
          initial: boolean;
          replyFeedbackCommentId: Id<"feedbackComments"> | null;
          updatedTime: number | null;
        } | null;
        following: boolean;
        hasUpvoted: boolean;
        permissions: {
          canDelete: boolean;
          canEditSettings: boolean;
          canManageAccess: boolean;
          canManageContent: boolean;
          canManageIntegrations: boolean;
          canView: boolean;
        };
        related: Array<{
          id: Id<"feedback">;
          slug: string;
          status: "open" | "in-progress" | "closed" | "completed" | "paused";
          title: string;
        }>;
        timeline: Array<
          | {
              creationTime: number;
              data: {
                author: null | {
                  id: Id<"profiles">;
                  imageUrl: string | null;
                  name: string;
                  username: string;
                };
                canDelete: boolean;
                canEdit: boolean;
                content: string;
                creationTime: number;
                emotes: Array<{
                  authorProfileIds: Array<string>;
                  content: string;
                  count: number;
                }>;
                id: Id<"feedbackComments">;
                initial: boolean;
                replyFeedbackCommentId: Id<"feedbackComments"> | null;
                updatedTime: number | null;
              };
              type: "comment";
            }
          | {
              creationTime: number;
              data: {
                actor: null | {
                  id: Id<"profiles">;
                  imageUrl: string | null;
                  name: string;
                  username: string;
                };
                eventType:
                  | "status_changed"
                  | "priority_changed"
                  | "title_changed"
                  | "board_changed"
                  | "answer_marked"
                  | "answer_unmarked"
                  | "assigned"
                  | "unassigned";
                id: Id<"feedbackEvents">;
                metadata: null | {
                  newValue?: string;
                  oldValue?: string;
                  targetProfileId?: Id<"profiles">;
                };
              };
              type: "event";
            }
        >;
        timelineCursor: string | null;
        watchers: Array<null | {
          id: Id<"profiles">;
          imageUrl: string | null;
          name: string;
          username: string;
        }>;
      }
    >;
    list: FunctionReference<
      "query",
      "public",
      {
        boardId?: Id<"feedbackBoards">;
        paginationOpts: {
          cursor: string | null;
          endCursor?: string | null;
          id?: number;
          maximumBytesRead?: number;
          maximumRowsRead?: number;
          numItems: number;
        };
        projectId: Id<"projects">;
        search?: string;
        status?: "open" | "in-progress" | "closed" | "completed" | "paused";
      },
      null | {
        continueCursor: string;
        isDone: boolean;
        page: Array<{
          board: {
            icon: string | null;
            id: Id<"feedbackBoards">;
            name: string;
            slug: string;
          };
          firstComment: null | { content: string };
          hasUpvoted: boolean;
          id: Id<"feedback">;
          priority: "none" | "low" | "medium" | "high" | "urgent";
          slug: string;
          status: "open" | "in-progress" | "closed" | "completed" | "paused";
          title: string;
          upvotes: number;
        }>;
        pageStatus?: "SplitRecommended" | "SplitRequired" | null;
        splitCursor?: string | null;
      }
    >;
    listAssignableProfiles: FunctionReference<
      "query",
      "public",
      { projectId: Id<"projects"> },
      Array<{
        id: Id<"profiles">;
        imageUrl: string | null;
        name: string;
        username: string;
      }>
    >;
    listTimelinePage: FunctionReference<
      "query",
      "public",
      {
        feedbackId: Id<"feedback">;
        paginationOpts: {
          cursor: string | null;
          endCursor?: string | null;
          id?: number;
          maximumBytesRead?: number;
          maximumRowsRead?: number;
          numItems: number;
        };
      },
      null | {
        continueCursor: string;
        isDone: boolean;
        page: Array<
          | {
              creationTime: number;
              data: {
                author: null | {
                  id: Id<"profiles">;
                  imageUrl: string | null;
                  name: string;
                  username: string;
                };
                canDelete: boolean;
                canEdit: boolean;
                content: string;
                creationTime: number;
                emotes: Array<{
                  authorProfileIds: Array<string>;
                  content: string;
                  count: number;
                }>;
                id: Id<"feedbackComments">;
                initial: boolean;
                replyFeedbackCommentId: Id<"feedbackComments"> | null;
                updatedTime: number | null;
              };
              type: "comment";
            }
          | {
              creationTime: number;
              data: {
                actor: null | {
                  id: Id<"profiles">;
                  imageUrl: string | null;
                  name: string;
                  username: string;
                };
                eventType:
                  | "status_changed"
                  | "priority_changed"
                  | "title_changed"
                  | "board_changed"
                  | "answer_marked"
                  | "answer_unmarked"
                  | "assigned"
                  | "unassigned";
                id: Id<"feedbackEvents">;
                metadata: null | {
                  newValue?: string;
                  oldValue?: string;
                  targetProfileId?: Id<"profiles">;
                };
              };
              type: "event";
            }
        >;
        pageStatus?: "SplitRecommended" | "SplitRequired" | null;
        splitCursor?: string | null;
      }
    >;
    remove: FunctionReference<
      "mutation",
      "public",
      { feedbackId: Id<"feedback"> },
      null
    >;
    removeRelation: FunctionReference<
      "mutation",
      "public",
      { feedbackId: Id<"feedback">; relatedFeedbackId: Id<"feedback"> },
      null
    >;
    searchForLinking: FunctionReference<
      "query",
      "public",
      { projectId: Id<"projects">; search: string },
      Array<{
        id: Id<"feedback">;
        slug: string;
        status: "open" | "in-progress" | "closed" | "completed" | "paused";
        title: string;
      }>
    >;
    setAnswerComment: FunctionReference<
      "mutation",
      "public",
      { commentId?: Id<"feedbackComments">; feedbackId: Id<"feedback"> },
      null
    >;
    toggleFollow: FunctionReference<
      "mutation",
      "public",
      { feedbackId: Id<"feedback"> },
      { following: boolean }
    >;
    toggleUpvote: FunctionReference<
      "mutation",
      "public",
      { feedbackId: Id<"feedback"> },
      { count: number; upvoted: boolean }
    >;
    updateAssigned: FunctionReference<
      "mutation",
      "public",
      { assignedProfileId?: Id<"profiles">; feedbackId: Id<"feedback"> },
      null
    >;
    updateBoard: FunctionReference<
      "mutation",
      "public",
      { boardId: Id<"feedbackBoards">; feedbackId: Id<"feedback"> },
      null
    >;
    updatePriority: FunctionReference<
      "mutation",
      "public",
      {
        feedbackId: Id<"feedback">;
        priority: "none" | "low" | "medium" | "high" | "urgent";
      },
      null
    >;
    updateStatus: FunctionReference<
      "mutation",
      "public",
      {
        feedbackId: Id<"feedback">;
        status: "open" | "in-progress" | "closed" | "completed" | "paused";
      },
      null
    >;
    updateTags: FunctionReference<
      "mutation",
      "public",
      { feedbackId: Id<"feedback">; tags: Array<string> },
      null
    >;
    updateTarget: FunctionReference<
      "mutation",
      "public",
      {
        feedbackId: Id<"feedback">;
        target?: string;
        targetGranularity?: "day" | "month" | "quarter" | "year";
      },
      null
    >;
    updateTitle: FunctionReference<
      "mutation",
      "public",
      { feedbackId: Id<"feedback">; title: string },
      null
    >;
  };
  feedbackBoards: {
    create: FunctionReference<
      "mutation",
      "public",
      {
        description?: string;
        icon?: string;
        name: string;
        projectId: Id<"projects">;
        slug: string;
      },
      Id<"feedbackBoards">
    >;
    get: FunctionReference<
      "query",
      "public",
      { id: Id<"feedbackBoards">; orgSlug: string; projectSlug: string },
      {
        description: string | null;
        icon: string | null;
        id: Id<"feedbackBoards">;
        name: string;
        slug: string;
      } | null
    >;
    list: FunctionReference<
      "query",
      "public",
      { projectId: Id<"projects"> },
      Array<{
        description: string | null;
        icon: string | null;
        id: Id<"feedbackBoards">;
        name: string;
        slug: string;
      }> | null
    >;
    remove: FunctionReference<
      "mutation",
      "public",
      { boardId: Id<"feedbackBoards">; projectId: Id<"projects"> },
      { success: boolean }
    >;
    update: FunctionReference<
      "mutation",
      "public",
      {
        description?: string;
        icon?: string;
        id: Id<"feedbackBoards">;
        name: string;
        orgSlug: string;
        projectSlug: string;
        slug: string;
      },
      { success: boolean }
    >;
  };
  feedbackComments: {
    create: FunctionReference<
      "mutation",
      "public",
      {
        content: string;
        feedbackId: Id<"feedback">;
        replyFeedbackCommentId?: Id<"feedbackComments">;
      },
      { id: Id<"feedbackComments"> }
    >;
    remove: FunctionReference<
      "mutation",
      "public",
      { commentId: Id<"feedbackComments"> },
      null
    >;
    toggleEmote: FunctionReference<
      "mutation",
      "public",
      {
        content: string;
        feedbackCommentId: Id<"feedbackComments">;
        feedbackId: Id<"feedback">;
      },
      { action: "added" | "removed" }
    >;
    update: FunctionReference<
      "mutation",
      "public",
      { commentId: Id<"feedbackComments">; content: string },
      null
    >;
  };
  files: {
    detail: FunctionReference<
      "query",
      "public",
      { assetId: Id<"fileAssets"> },
      {
        asset: {
          _creationTime: number;
          _id: Id<"fileAssets">;
          access: "public" | "project_staff" | "private_user";
          category:
            | "image"
            | "video"
            | "document"
            | "text"
            | "data"
            | "package"
            | "design";
          coverUpdateId?: Id<"updates">;
          extension: string;
          extractedText?: string;
          folderId?: Id<"fileFolders">;
          listing: "project_files" | "unlisted";
          name: string;
          normalizedName: string;
          objectId?: Id<"fileObjects">;
          origin: "files" | "update_cover";
          projectId: Id<"projects">;
          publicId: string;
          searchContent: string;
          state: "pending" | "ready" | "deleting" | "deleted";
          updatedAt: number;
          uploaderClass: "staff" | "user";
          uploaderId: Id<"users">;
        };
        bytes: number;
        canManage: boolean;
        mimeType: string;
        thumbnail: boolean;
      }
    >;
    edit: FunctionReference<
      "mutation",
      "public",
      { assetId: Id<"fileAssets">; folderId?: Id<"fileFolders">; name: string },
      null
    >;
    folders: FunctionReference<
      "query",
      "public",
      { projectId: Id<"projects"> },
      Array<{
        _creationTime: number;
        _id: Id<"fileFolders">;
        name: string;
        normalizedName: string;
        parentId?: Id<"fileFolders">;
        projectId: Id<"projects">;
        systemKey?: "uploads" | "updates";
        updatedAt: number;
      }>
    >;
    list: FunctionReference<
      "query",
      "public",
      {
        category?:
          | "image"
          | "video"
          | "document"
          | "text"
          | "data"
          | "package"
          | "design";
        extension?: string;
        folderId?: Id<"fileFolders"> | null;
        paginationOpts: {
          cursor: string | null;
          endCursor?: string | null;
          id?: number;
          maximumBytesRead?: number;
          maximumRowsRead?: number;
          numItems: number;
        };
        projectId: Id<"projects">;
        search?: string;
        sort?: "created_desc" | "edited_desc";
      },
      {
        continueCursor: string;
        isDone: boolean;
        page: Array<{
          _creationTime: number;
          _id: Id<"fileAssets">;
          access: "public" | "project_staff" | "private_user";
          category:
            | "image"
            | "video"
            | "document"
            | "text"
            | "data"
            | "package"
            | "design";
          coverUpdateId?: Id<"updates">;
          extension: string;
          extractedText?: string;
          folderId?: Id<"fileFolders">;
          listing: "project_files" | "unlisted";
          name: string;
          normalizedName: string;
          objectId?: Id<"fileObjects">;
          origin: "files" | "update_cover";
          projectId: Id<"projects">;
          publicId: string;
          searchContent: string;
          state: "pending" | "ready" | "deleting" | "deleted";
          updatedAt: number;
          uploaderClass: "staff" | "user";
          uploaderId: Id<"users">;
        }>;
        pageStatus?: "SplitRecommended" | "SplitRequired" | null;
        splitCursor?: string | null;
      }
    >;
    organizationUsage: FunctionReference<
      "query",
      "public",
      {
        organizationId: Id<"organizations">;
        paginationOpts: {
          cursor: string | null;
          endCursor?: string | null;
          id?: number;
          maximumBytesRead?: number;
          maximumRowsRead?: number;
          numItems: number;
        };
      },
      {
        continueCursor: string;
        isDone: boolean;
        page: Array<{
          _creationTime: number;
          _id: Id<"storageUsage">;
          byCategory: Record<string, { bytes: number; files: number }>;
          byOrigin: Record<string, { bytes: number; files: number }>;
          byUploaderClass: Record<string, { bytes: number; files: number }>;
          fileCount: number;
          organizationId: Id<"organizations">;
          projectId: Id<"projects">;
          reservedBytes: number;
          usedBytes: number;
        }>;
        pageStatus?: "SplitRecommended" | "SplitRequired" | null;
        splitCursor?: string | null;
      }
    >;
    publicMetadata: FunctionReference<
      "query",
      "public",
      { publicId: string },
      null | { name: string; thumbnail: boolean }
    >;
    remove: FunctionReference<
      "mutation",
      "public",
      { assetId: Id<"fileAssets"> },
      null
    >;
    removeCover: FunctionReference<
      "mutation",
      "public",
      { updateId: Id<"updates"> },
      null
    >;
    removeFolder: FunctionReference<
      "mutation",
      "public",
      { folderId: Id<"fileFolders"> },
      null
    >;
    saveFolder: FunctionReference<
      "mutation",
      "public",
      {
        folderId?: Id<"fileFolders">;
        name: string;
        parentId?: Id<"fileFolders">;
        projectId: Id<"projects">;
      },
      Id<"fileFolders">
    >;
    usage: FunctionReference<
      "query",
      "public",
      { projectId: Id<"projects"> },
      {
        limitBytes: number;
        usage: {
          _creationTime: number;
          _id: Id<"storageUsage">;
          byCategory: Record<string, { bytes: number; files: number }>;
          byOrigin: Record<string, { bytes: number; files: number }>;
          byUploaderClass: Record<string, { bytes: number; files: number }>;
          fileCount: number;
          organizationId: Id<"organizations">;
          projectId: Id<"projects">;
          reservedBytes: number;
          usedBytes: number;
        } | null;
      }
    >;
  };
  filesJobs: {
    list: FunctionReference<
      "query",
      "public",
      {
        paginationOpts: {
          cursor: string | null;
          endCursor?: string | null;
          id?: number;
          maximumBytesRead?: number;
          maximumRowsRead?: number;
          numItems: number;
        };
        projectId: Id<"projects">;
        state: "pending" | "running" | "failed" | "done";
      },
      {
        continueCursor: string;
        isDone: boolean;
        page: Array<{
          _creationTime: number;
          _id: Id<"storageCleanupJobs">;
          attempt: number;
          finishedAt?: number;
          lastError?: string;
          leaseUntil: number;
          maxAttempt: number;
          notBefore: number;
          objectId: Id<"fileObjects">;
          projectId: Id<"projects">;
          stagingOnly: boolean;
          state: "pending" | "running" | "failed" | "done";
        }>;
        pageStatus?: "SplitRecommended" | "SplitRequired" | null;
        splitCursor?: string | null;
      }
    >;
    resume: FunctionReference<
      "mutation",
      "public",
      { jobId: Id<"storageCleanupJobs"> },
      null
    >;
  };
  filesTransport: {
    complete: FunctionReference<
      "action",
      "public",
      { assetId: Id<"fileAssets"> },
      null
    >;
    download: FunctionReference<
      "action",
      "public",
      { assetId: Id<"fileAssets">; inline?: boolean; thumbnail?: boolean },
      string
    >;
    start: FunctionReference<
      "action",
      "public",
      {
        files: Array<{ mimeType: string; name: string; sizeBytes: number }>;
        folderId?: Id<"fileFolders"> | null;
        projectId: Id<"projects">;
        updateId?: Id<"updates">;
      },
      Array<{ assetId: Id<"fileAssets">; mimeType: string; url: string }>
    >;
  };
  filesWorkspace: {
    changeAsset: FunctionReference<
      "mutation",
      "public",
      {
        assetId: Id<"fileAssets">;
        folderId?: Id<"fileFolders"> | null;
        name?: string;
      },
      null
    >;
    changeFolder: FunctionReference<
      "mutation",
      "public",
      {
        folderId: Id<"fileFolders">;
        name?: string;
        parentFolderId?: Id<"fileFolders"> | null;
      },
      Id<"fileFolders">
    >;
    detail: FunctionReference<
      "query",
      "public",
      { assetId: Id<"fileAssets">; projectId: Id<"projects"> },
      null | {
        canManage: boolean;
        category:
          | "image"
          | "video"
          | "document"
          | "text"
          | "data"
          | "package"
          | "design";
        createdTime: number;
        deliveryUrl: string;
        extension: string;
        folder: null | { id: string; name: string };
        id: string;
        listing: string;
        mimeType: string;
        name: string;
        previewText: string | null;
        sizeBytes: number;
        sourceAndUsage: {
          access: string;
          creationMethod: string;
          originFeature: string;
          publicId: string;
          readyTime: number | null;
          referenceCount: number;
          references: Array<{
            entityType: string;
            feature: string;
            field: string;
          }>;
          referencesTruncated: boolean;
          sourceProvider: string;
          storageProvider: string;
          uploaderClass: string;
        } | null;
        updatedTime: number;
        uploadedBy: null | { id: string; name: string; username: string };
      }
    >;
    editableOrganizations: FunctionReference<
      "query",
      "public",
      {},
      Array<{
        logo: null | string;
        name: string;
        role: "owner" | "admin";
        slug: string;
      }>
    >;
    folders: FunctionReference<
      "query",
      "public",
      { projectId: Id<"projects"> },
      Array<{
        createdTime: number;
        id: string;
        name: string;
        parentFolderId?: string;
        systemKey?: string;
        updatedTime: number;
      }>
    >;
    list: FunctionReference<
      "query",
      "public",
      {
        category?:
          | "image"
          | "video"
          | "document"
          | "text"
          | "data"
          | "package"
          | "design";
        extension?: string;
        folderId?: Id<"fileFolders"> | null;
        paginationOpts: {
          cursor: string | null;
          endCursor?: string | null;
          id?: number;
          maximumBytesRead?: number;
          maximumRowsRead?: number;
          numItems: number;
        };
        projectId: Id<"projects">;
        search?: string;
        sort?: "created_desc" | "edited_desc";
        sourceProvider?: string;
      },
      {
        continueCursor: string;
        isDone: boolean;
        page: Array<{
          category:
            | "image"
            | "video"
            | "document"
            | "text"
            | "data"
            | "package"
            | "design";
          createdTime: number;
          extension: string;
          folderId?: string;
          hasThumbnail: boolean;
          id: string;
          mimeType: string;
          name: string;
          originFeature: string;
          sizeBytes?: number;
          sourceProvider: "kino";
          thumbnailStatus?: "pending" | "ready" | "failed";
          thumbnailUrl: string | null;
          updatedTime: number;
        }>;
        pageStatus?: "SplitRecommended" | "SplitRequired" | null;
        splitCursor?: string | null;
      }
    >;
    organizationUsage: FunctionReference<
      "query",
      "public",
      { orgSlug: string },
      {
        projects: Array<{
          fileCount: number;
          id: string;
          limitBytes: number;
          name: string;
          reservedBytes: number;
          slug: string;
          usedBytes: number;
        }>;
        totalFiles: number;
        totalReservedBytes: number;
        totalUsedBytes: number;
      }
    >;
    tree: FunctionReference<
      "query",
      "public",
      { projectId: Id<"projects"> },
      {
        files: Array<{
          category:
            | "image"
            | "video"
            | "document"
            | "text"
            | "data"
            | "package"
            | "design";
          folderId?: string;
          id: string;
          name: string;
        }>;
        truncated: boolean;
      }
    >;
    usage: FunctionReference<
      "query",
      "public",
      { projectId: Id<"projects"> },
      {
        byCategory: Record<string, { bytes: number; files: number }>;
        byOrigin: Record<string, { bytes: number; files: number }>;
        byUploaderClass: Record<string, { bytes: number; files: number }>;
        fileCount: number;
        limitBytes: number;
        reservedBytes: number;
        usedBytes: number;
      }
    >;
  };
  github: {
    completeSignInGithub: FunctionReference<
      "mutation",
      "public",
      { code: string; state: string },
      | {
          status: "complete";
          tokens: {
            accessToken: string;
            accessTokenExpiresAt: number;
            refreshToken: string;
            refreshTokenExpiresAt: number;
            userId: string;
          };
        }
      | { status: "error"; userError: { error: "INVALID_CODE" } }
    >;
    startSignInGithub: FunctionReference<
      "mutation",
      "public",
      { redirectTo: string },
      { redirect: string; state: string }
    >;
  };
  invitations: {
    accept: FunctionReference<
      "mutation",
      "public",
      { invitationId: Id<"invitations"> },
      { membershipId: Id<"memberships">; organizationSlug: string }
    >;
    cancel: FunctionReference<
      "mutation",
      "public",
      { invitationId: Id<"invitations"> },
      null
    >;
    create: FunctionReference<
      "mutation",
      "public",
      {
        email: string;
        organizationId: Id<"organizations">;
        projectIds: Array<Id<"projects">>;
        role: "admin" | "moderator";
      },
      Id<"invitations">
    >;
    inspect: FunctionReference<
      "query",
      "public",
      { invitationId: Id<"invitations">; now: number },
      | { state: "unavailable" }
      | { state: "wrong_account" }
      | {
          organizationName: string;
          organizationSlug: string;
          state: "already_accepted";
        }
      | {
          expiresAt: number;
          organizationName: string;
          organizationSlug: string;
          role: "admin" | "moderator";
          state: "pending";
        }
    >;
    listPending: FunctionReference<
      "query",
      "public",
      { organizationId: Id<"organizations"> },
      Array<{
        assignedProjectCount: number;
        deliveryStatus: null | "accepted" | "failed";
        email: string;
        expiresAt: number;
        id: Id<"invitations">;
        role: "admin" | "moderator";
      }>
    >;
    reject: FunctionReference<
      "mutation",
      "public",
      { invitationId: Id<"invitations"> },
      null
    >;
  };
  organizationAppearance: {
    commitLogo: FunctionReference<
      "mutation",
      "public",
      {
        organizationId: Id<"organizations">;
        storageId: Id<"_storage">;
        uploadToken: string;
      },
      { logo: null | string }
    >;
    discardLogoUpload: FunctionReference<
      "mutation",
      "public",
      { organizationId: Id<"organizations">; uploadToken: string },
      boolean
    >;
    generateLogoUploadUrl: FunctionReference<
      "mutation",
      "public",
      { organizationId: Id<"organizations"> },
      { uploadToken: string; uploadUrl: string }
    >;
    registerLogoUpload: FunctionReference<
      "mutation",
      "public",
      {
        organizationId: Id<"organizations">;
        storageId: Id<"_storage">;
        uploadToken: string;
      },
      null
    >;
  };
  organizationMembers: {
    getModeratorProjectAccess: FunctionReference<
      "query",
      "public",
      { memberId: Id<"memberships"> },
      {
        memberId: Id<"memberships">;
        projects: Array<{
          assigned: boolean;
          id: Id<"projects">;
          name: string;
          slug: string;
          visibility: "public" | "private" | "archived";
        }>;
      }
    >;
    setModeratorProjectAccess: FunctionReference<
      "mutation",
      "public",
      { memberId: Id<"memberships">; projectIds: Array<Id<"projects">> },
      null
    >;
  };
  organizationOverview: {
    get: FunctionReference<
      "query",
      "public",
      { organizationId: Id<"organizations"> },
      null | { memberCount: number }
    >;
  };
  organizations: {
    create: FunctionReference<
      "mutation",
      "public",
      { name: string; slug: string },
      Id<"organizations">
    >;
    createForRoute: FunctionReference<
      "mutation",
      "public",
      { name: string; slug?: string; visibility: "public" | "private" },
      { id: Id<"organizations">; slug: string }
    >;
    getBySlug: FunctionReference<
      "query",
      "public",
      { slug: string },
      null | {
        id: Id<"organizations">;
        logo: null | string;
        name: string;
        permissions: {
          canCreateProjects: boolean;
          canDelete: boolean;
          canEdit: boolean;
          canManageMembers: boolean;
          canView: boolean;
        };
        role: null | "owner" | "admin" | "moderator" | "system:admin";
        slug: string;
        visibility: "public" | "private";
      }
    >;
    leave: FunctionReference<
      "mutation",
      "public",
      { organizationId: Id<"organizations"> },
      null
    >;
    listMembers: FunctionReference<
      "query",
      "public",
      { organizationId: Id<"organizations"> },
      {
        canManage: boolean;
        currentUserRole: "owner" | "admin" | "moderator" | "system:admin";
        members: Array<{
          assignedProjectCount: number;
          id: Id<"memberships">;
          role: "owner" | "admin" | "moderator";
          user: {
            email: string;
            id: Id<"users">;
            image: null | string;
            name: string;
            username: string;
          };
        }>;
      }
    >;
    listMine: FunctionReference<
      "query",
      "public",
      {},
      Array<{
        canManage: boolean;
        id: Id<"organizations">;
        logo: null | string;
        name: string;
        role: "owner" | "admin" | "moderator";
        slug: string;
        visibility: "public" | "private";
      }>
    >;
    listMineForRoute: FunctionReference<
      "query",
      "public",
      {},
      {
        teams: Array<{
          canManage: boolean;
          id: Id<"organizations">;
          logo: null | string;
          name: string;
          role: "owner" | "admin" | "moderator";
          slug: string;
          visibility: "public" | "private";
        }>;
        underLimit: boolean;
      }
    >;
    personal: FunctionReference<
      "query",
      "public",
      {},
      null | {
        id: Id<"organizations">;
        name: string;
        role: "owner";
        slug: string;
      }
    >;
    removeMember: FunctionReference<
      "mutation",
      "public",
      { membershipId: Id<"memberships"> },
      null
    >;
    setMemberRole: FunctionReference<
      "mutation",
      "public",
      {
        membershipId: Id<"memberships">;
        projectIds: Array<Id<"projects">>;
        role: "admin" | "moderator";
      },
      null
    >;
  };
  password: {
    requestEmail: FunctionReference<
      "mutation",
      "public",
      { email: string; purpose: "verify" | "reset" },
      { status: "accepted" } | { status: "error"; userError: { error: string } }
    >;
    resetPassword: FunctionReference<
      "mutation",
      "public",
      { code: string; password: string },
      | { status: "passwordUpdated" }
      | { status: "error"; userError: { error: string } }
    >;
    signIn: FunctionReference<
      "mutation",
      "public",
      { email: string; password: string },
      | {
          status: "complete";
          tokens: {
            accessToken: string;
            accessTokenExpiresAt: number;
            refreshToken: string;
            refreshTokenExpiresAt: number;
            userId: string;
          };
        }
      | { status: "error"; userError: { error: string } }
    >;
    signUp: FunctionReference<
      "mutation",
      "public",
      {
        email: string;
        locale?: "en-US" | "es-419" | "zh-Hans";
        name: string;
        password: string;
      },
      { status: "accepted" } | { status: "error"; userError: { error: string } }
    >;
    verifyEmail: FunctionReference<
      "mutation",
      "public",
      { code: string },
      {
        status: "complete";
        tokens: {
          accessToken: string;
          accessTokenExpiresAt: number;
          refreshToken: string;
          refreshTokenExpiresAt: number;
          userId: string;
        };
      }
    >;
  };
  policy: {
    assertContentWrite: FunctionReference<
      "mutation",
      "public",
      { projectId: Id<"projects"> },
      null
    >;
    createProject: FunctionReference<
      "mutation",
      "public",
      { name: string; organizationId: Id<"organizations">; slug: string },
      Id<"projects">
    >;
    createProjectForRoute: FunctionReference<
      "mutation",
      "public",
      {
        name: string;
        orgSlug: string;
        slug: string;
        visibility: "public" | "private";
      },
      { id: Id<"projects">; slug: string }
    >;
    getMyProjectCreationPermission: FunctionReference<
      "query",
      "public",
      { orgSlug: string },
      { canAddProjects: boolean }
    >;
    setDirectProjectMember: FunctionReference<
      "mutation",
      "public",
      { enabled: boolean; projectId: Id<"projects">; userId: Id<"users"> },
      null
    >;
    setOrganizationVisibility: FunctionReference<
      "mutation",
      "public",
      { organizationId: Id<"organizations">; visibility: "public" | "private" },
      null
    >;
    updateProject: FunctionReference<
      "mutation",
      "public",
      {
        name?: string;
        projectId: Id<"projects">;
        visibility?: "public" | "private" | "archived";
      },
      null
    >;
    viewOrganization: FunctionReference<
      "query",
      "public",
      { organizationId: Id<"organizations"> },
      {
        membership: {
          _creationTime: number;
          _id: Id<"memberships">;
          organizationId: Id<"organizations">;
          role: "owner" | "admin" | "moderator";
          userId: Id<"users">;
        } | null;
        organization: {
          _creationTime: number;
          _id: Id<"organizations">;
          logoStorageId?: Id<"_storage">;
          name: string;
          personalOwnerId?: Id<"users">;
          slug: string;
          visibility: "public" | "private";
        } | null;
        permissions: {
          canCreateProjects: boolean;
          canDelete: boolean;
          canEdit: boolean;
          canManageMembers: boolean;
          canView: boolean;
        };
        role: "system:admin" | "owner" | "admin" | "moderator" | null;
      }
    >;
    viewProject: FunctionReference<
      "query",
      "public",
      { projectId: Id<"projects"> },
      {
        isArchived: boolean;
        permissions: {
          canDelete: boolean;
          canEditSettings: boolean;
          canManageAccess: boolean;
          canManageContent: boolean;
          canManageIntegrations: boolean;
          canView: boolean;
        };
        project: {
          _creationTime: number;
          _id: Id<"projects">;
          deletingAt?: number;
          description?: string;
          name: string;
          organizationId: Id<"organizations">;
          slug: string;
          storageDeletingAt?: number;
          updatesFeaturedMode?: "latest" | "manual";
          urls?: Array<{
            source: string;
            text: string;
            url: string;
            verifiedAt: null | number;
          }>;
          visibility: "public" | "private" | "archived";
        } | null;
      }
    >;
  };
  profiles: {
    commitAvatar: FunctionReference<
      "mutation",
      "public",
      { storageId: Id<"_storage">; uploadToken: string },
      { imageUrl: null | string }
    >;
    discardAvatarUpload: FunctionReference<
      "mutation",
      "public",
      { uploadToken: string },
      boolean
    >;
    generateAvatarUploadUrl: FunctionReference<
      "mutation",
      "public",
      {},
      { uploadToken: string; uploadUrl: string }
    >;
    getByUsername: FunctionReference<
      "query",
      "public",
      { username: string },
      null | {
        bio: null | string;
        id: Id<"profiles">;
        imageUrl: null | string;
        isViewerProfile: boolean;
        location: null | string;
        memberOrganizations: Array<{
          id: Id<"organizations">;
          name: string;
          role: "owner" | "admin" | "moderator";
          slug: string;
          visibility: "public" | "private";
        }>;
        name: string;
        ownedOrganizations: Array<{
          id: Id<"organizations">;
          name: string;
          role: "owner" | "admin" | "moderator";
          slug: string;
          visibility: "public" | "private";
        }>;
        urls: Array<{ text: string; url: string }>;
        username: string;
      }
    >;
    me: FunctionReference<
      "query",
      "public",
      {},
      null | {
        bio: null | string;
        email: string;
        id: Id<"users">;
        imageUrl: null | string;
        locale?: "en-US" | "es-419" | "zh-Hans";
        location: null | string;
        name: string;
        profileId: Id<"profiles">;
        role: "user" | "system:admin";
        systemRole: "user" | "system:admin";
        urls: Array<{ text: string; url: string }>;
        username: string;
      }
    >;
    registerAvatarUpload: FunctionReference<
      "mutation",
      "public",
      { storageId: Id<"_storage">; uploadToken: string },
      null
    >;
    update: FunctionReference<
      "mutation",
      "public",
      {
        profile: {
          bio?: null | string;
          imageKey?: null | string;
          location?: null | string;
          urls?: null | Array<{ text: string; url: string }>;
        };
        user: {
          image?: null | string;
          name?: null | string;
          username?: null | string;
        };
      },
      {
        bio: null | string;
        email: string;
        id: Id<"users">;
        imageUrl: null | string;
        locale?: "en-US" | "es-419" | "zh-Hans";
        location: null | string;
        name: string;
        profileId: Id<"profiles">;
        role: "user" | "system:admin";
        systemRole: "user" | "system:admin";
        urls: Array<{ text: string; url: string }>;
        username: string;
      }
    >;
    updateLocale: FunctionReference<
      "mutation",
      "public",
      { locale: "en-US" | "es-419" | "zh-Hans" },
      { locale: "en-US" | "es-419" | "zh-Hans" }
    >;
  };
  projectAppearance: {
    getEditorState: FunctionReference<
      "query",
      "public",
      { projectId: Id<"projects"> },
      {
        canUseCustomAccent: boolean;
        publishedRevision: number;
        publishedTheme: null | {
          dark: {
            background: string;
            foreground: string;
            primary: string;
            primaryForeground: string;
            surface: string;
            surfaceForeground: string;
          };
          light: {
            background: string;
            foreground: string;
            primary: string;
            primaryForeground: string;
            surface: string;
            surfaceForeground: string;
          };
          presetId:
            | "kino"
            | "red"
            | "orange"
            | "golden"
            | "forest"
            | "teal"
            | "purple"
            | "sunset"
            | "monochrome"
            | "custom";
          version: 1;
        };
        publishedTime: null | number;
      }
    >;
    publish: FunctionReference<
      "mutation",
      "public",
      {
        dark: {
          background: string;
          foreground: string;
          primary: string;
          primaryForeground: string;
          surface: string;
          surfaceForeground: string;
        };
        expectedPublishedRevision: number;
        light: {
          background: string;
          foreground: string;
          primary: string;
          primaryForeground: string;
          surface: string;
          surfaceForeground: string;
        };
        presetId:
          | "kino"
          | "red"
          | "orange"
          | "golden"
          | "forest"
          | "teal"
          | "purple"
          | "sunset"
          | "monochrome"
          | "custom";
        projectId: Id<"projects">;
      },
      {
        publishedRevision: number;
        publishedTheme: {
          dark: {
            background: string;
            foreground: string;
            primary: string;
            primaryForeground: string;
            surface: string;
            surfaceForeground: string;
          };
          light: {
            background: string;
            foreground: string;
            primary: string;
            primaryForeground: string;
            surface: string;
            surfaceForeground: string;
          };
          presetId:
            | "kino"
            | "red"
            | "orange"
            | "golden"
            | "forest"
            | "teal"
            | "purple"
            | "sunset"
            | "monochrome"
            | "custom";
          version: 1;
        };
        publishedTime: number;
      }
    >;
  };
  projectDeletion: {
    remove: FunctionReference<
      "mutation",
      "public",
      { id: Id<"projects"> },
      null
    >;
  };
  projectMembers: {
    getManagementState: FunctionReference<
      "query",
      "public",
      { projectId: Id<"projects"> },
      {
        moderators: Array<{
          assigned: boolean;
          memberId: Id<"memberships">;
          profile: {
            id: Id<"profiles">;
            imageUrl: string | null;
            name: string | null;
            username: string;
          };
        }>;
      }
    >;
    inviteProjectMember: FunctionReference<
      "mutation",
      "public",
      { email: string; projectId: Id<"projects"> },
      { success: boolean }
    >;
    listProjectMembers: FunctionReference<
      "query",
      "public",
      { projectId: Id<"projects"> },
      {
        canManage: boolean;
        isPrivate: boolean;
        members: Array<{
          id: Id<"projectMembers">;
          profile: {
            id: Id<"profiles">;
            imageUrl: string | null;
            name: string | null;
            username: string;
          };
          profileId: Id<"profiles">;
        }>;
      }
    >;
    removeProjectMember: FunctionReference<
      "mutation",
      "public",
      { projectMemberId: Id<"projectMembers"> },
      { success: boolean }
    >;
    setModeratorAccess: FunctionReference<
      "mutation",
      "public",
      {
        enabled: boolean;
        memberId: Id<"memberships">;
        projectId: Id<"projects">;
      },
      { success: boolean }
    >;
  };
  projectOverview: {
    get: FunctionReference<
      "query",
      "public",
      { projectId: Id<"projects"> },
      null | {
        activity: Array<{
          actor: string | null;
          at: number;
          id: Id<"feedback"> | Id<"updates">;
          kind: "update_published" | "feedback_created";
          title: string;
        }>;
        members: Array<{
          id: Id<"users">;
          imageUrl: string | null;
          name: string;
          role: "owner" | "admin" | "moderator" | "member";
          username: string;
        }>;
        recentUpdates: Array<{
          author: string | null;
          category: "changelog" | "article" | "announcement";
          commentCount: number;
          id: Id<"updates">;
          publishedAt: number;
          slug: string;
          title: string;
        }>;
        stats: {
          inProgress: number | null;
          members: number | null;
          openFeedback: number | null;
          publishedUpdates: number | null;
          upvotes: number | null;
        };
      }
    >;
  };
  projects: {
    getBySlugs: FunctionReference<
      "query",
      "public",
      { organizationSlug: string; projectSlug: string },
      null | {
        organization: {
          id: Id<"organizations">;
          name: string;
          slug: string;
          visibility: "public" | "private";
        };
        permissions: {
          canDelete: boolean;
          canEditSettings: boolean;
          canManageAccess: boolean;
          canManageContent: boolean;
          canManageIntegrations: boolean;
          canView: boolean;
        };
        project: {
          createdAt: number;
          description: string;
          id: Id<"projects">;
          name: string;
          slug: string;
          updatesFeaturedMode: "latest" | "manual";
          urls: Array<{
            source: string;
            text: string;
            url: string;
            verifiedAt: null | number;
          }>;
          visibility: "public" | "private" | "archived";
        };
        publishedTheme: null | {
          dark: {
            background: string;
            foreground: string;
            primary: string;
            primaryForeground: string;
            surface: string;
            surfaceForeground: string;
          };
          light: {
            background: string;
            foreground: string;
            primary: string;
            primaryForeground: string;
            surface: string;
            surfaceForeground: string;
          };
          presetId:
            | "kino"
            | "red"
            | "orange"
            | "golden"
            | "forest"
            | "teal"
            | "purple"
            | "sunset"
            | "monochrome"
            | "custom";
          version: number;
        };
      }
    >;
    listByOrganization: FunctionReference<
      "query",
      "public",
      { limit?: number; organizationId: Id<"organizations"> },
      Array<{
        createdAt: number;
        description: string;
        id: Id<"projects">;
        name: string;
        slug: string;
        visibility: "public" | "private" | "archived";
      }>
    >;
  };
  relay: {
    disconnectRepository: FunctionReference<
      "mutation",
      "public",
      {
        connectionId: Id<"relayConnections">;
        orgSlug: string;
        projectSlug: string;
      },
      { success: boolean }
    >;
    integration: FunctionReference<
      "query",
      "public",
      { orgSlug: string; projectSlug?: string },
      {
        connections: Array<{
          connectedByProfileId: Id<"profiles">;
          deletedTime?: number;
          enabledSources: Array<"issues" | "discussions">;
          githubInstallationId: Id<"relayInstallations">;
          id: Id<"relayConnections">;
          mode: "read" | "read_write";
          orgId: Id<"organizations">;
          orgSlug: string;
          projectId: Id<"projects">;
          projectSlug: string;
          repoFullName: string;
          repoId: number;
          repoName: string;
          repoNodeId: string;
          repoOwner: string;
          repoPrivate: boolean;
          updatedTime: number;
          verificationStatus: string;
          verificationSummary: {
            discussions: { enabled: boolean; ok: boolean };
            issues: { ok: boolean };
          };
        }>;
        installations: Array<{
          accountId: number;
          accountLogin: string;
          accountType: string;
          connectedByProfileId: Id<"profiles">;
          events: Array<string>;
          id: Id<"relayInstallations">;
          installationId: number;
          orgId: Id<"organizations">;
          orgSlug: string;
          permissions: Record<string, string>;
          repositorySelection: string;
          status: "active" | "stale" | "deleted" | "suspended";
          updatedTime: number;
        }>;
        staleInstallations: Array<{
          accountId: number;
          accountLogin: string;
          accountType: string;
          connectedByProfileId: Id<"profiles">;
          events: Array<string>;
          id: Id<"relayInstallations">;
          installationId: number;
          orgId: Id<"organizations">;
          orgSlug: string;
          permissions: Record<string, string>;
          repositorySelection: string;
          status: "active" | "stale" | "deleted" | "suspended";
          updatedTime: number;
        }>;
      }
    >;
    start: FunctionReference<
      "mutation",
      "public",
      {
        callbackTargetUrl?: string;
        mode?: "read" | "read_write";
        orgSlug: string;
        projectSlug?: string;
        refresh?: boolean;
      },
      { url: string }
    >;
  };
  relayActions: {
    connectRepository: FunctionReference<
      "action",
      "public",
      {
        enabledSources: Array<"issues" | "discussions">;
        installationId: number;
        mode: "read" | "read_write";
        orgSlug: string;
        projectSlug: string;
        repoId: number;
      },
      { connectionId: Id<"relayConnections"> }
    >;
    listInstallationRepositoriesForProject: FunctionReference<
      "action",
      "public",
      { installationId: number; orgSlug: string },
      Array<{
        fullName: string;
        id: number;
        name: string;
        nodeId: string;
        owner: string;
        private: boolean;
      }>
    >;
  };
  relayFeedback: {
    getAvailability: FunctionReference<
      "query",
      "public",
      { feedbackId: Id<"feedback"> },
      {
        connected: boolean;
        enabledSources: Array<"issues" | "discussions">;
        issuesEnabled: boolean;
        mode: null | "read" | "read_write";
        repoFullName: null | string;
        repoPrivate: boolean;
        writable: boolean;
      }
    >;
    listByFeedback: FunctionReference<
      "query",
      "public",
      { feedbackId: Id<"feedback"> },
      Array<{
        connectedByProfileId: Id<"profiles">;
        feedbackId: Id<"feedback">;
        githubDatabaseId: number;
        githubNodeId: string;
        githubNumber: number;
        githubRepositoryConnectionId: Id<"relayConnections">;
        id: Id<"relayIssues">;
        kind: "issue";
        projectId: Id<"projects">;
        state: string;
        title: string;
        updatedTime: number;
        url: string;
      }>
    >;
  };
  relayFeedbackActions: {
    connect: FunctionReference<
      "action",
      "public",
      {
        body?: string;
        feedbackId: Id<"feedback">;
        feedbackUrl: string;
        githubNumber?: number;
        kind: "issue";
        title?: string;
      },
      { connectionId: Id<"relayIssues"> }
    >;
    refreshCounts: FunctionReference<
      "action",
      "public",
      { feedbackId: Id<"feedback"> },
      { updatedCount: number }
    >;
    searchTargets: FunctionReference<
      "action",
      "public",
      { feedbackId: Id<"feedback">; kind: "issue"; query: string },
      Array<{
        databaseId: number;
        kind: "issue";
        nodeId: string;
        number: number;
        state: string;
        title: string;
        url: string;
      }>
    >;
  };
  settings: {
    githubImportInfo: FunctionReference<
      "query",
      "public",
      { id: Id<"projects"> },
      { connected: boolean; repoFullName: null | string }
    >;
    updateOrganization: FunctionReference<
      "mutation",
      "public",
      { currentSlug: string; name: string; updatedSlug?: string },
      { id: Id<"organizations">; name: string; slug: string }
    >;
    updateProject: FunctionReference<
      "mutation",
      "public",
      {
        description: string;
        id: Id<"projects">;
        name: string;
        slug: string;
        updatesFeaturedMode: "latest" | "manual";
        urls: Array<{ source?: string; text: string; url: string }>;
        visibility: "public" | "private" | "archived";
      },
      {
        description: string;
        id: Id<"projects">;
        name: string;
        slug: string;
        updatesFeaturedMode: "latest" | "manual";
        urls: Array<{
          source: string;
          text: string;
          url: string;
          verifiedAt: number | null;
        }>;
        visibility: "public" | "private" | "archived";
      }
    >;
  };
  settingsActions: {
    importGithubUrls: FunctionReference<
      "action",
      "public",
      { id: Id<"projects"> },
      { homepage: null | string; repoUrl: string }
    >;
  };
  updates: {
    changeStatus: FunctionReference<
      "mutation",
      "public",
      {
        ids: Array<Id<"updates">>;
        projectId: Id<"projects">;
        status: "draft" | "published";
      },
      null
    >;
    comments: FunctionReference<
      "query",
      "public",
      {
        paginationOpts: {
          cursor: string | null;
          endCursor?: string | null;
          id?: number;
          maximumBytesRead?: number;
          maximumRowsRead?: number;
          numItems: number;
        };
        updateId: Id<"updates">;
      },
      {
        continueCursor: string;
        isDone: boolean;
        page: Array<{
          author: null | {
            id: Id<"profiles">;
            imageUrl: string | null;
            name: string;
            username: string;
          };
          canDelete: boolean;
          canEdit: boolean;
          comment: {
            _creationTime: number;
            _id: Id<"updateComments">;
            authorProfileId: Id<"profiles">;
            content: string;
            emoteCounts: Record<string, number>;
            replyCommentId?: Id<"updateComments">;
            updateId: Id<"updates">;
            updatedAt?: number;
          };
          ownEmotes: Array<string>;
        }>;
        pageStatus?: "SplitRecommended" | "SplitRequired" | null;
        splitCursor?: string | null;
      }
    >;
    detail: FunctionReference<
      "query",
      "public",
      { projectId: Id<"projects">; slug: string },
      null | {
        author: null | {
          id: Id<"profiles">;
          imageUrl: string | null;
          name: string;
          username: string;
        };
        canEdit: boolean;
        liked: boolean;
        relatedFeedback: Array<{
          id: Id<"feedback">;
          slug: string;
          title: string;
        }>;
        update: {
          _creationTime: number;
          _id: Id<"updates">;
          authorProfileId: Id<"profiles">;
          category: "changelog" | "article" | "announcement";
          commentCount: number;
          content: string;
          coverAssetId?: Id<"fileAssets">;
          deletingAt?: number;
          featuredAt?: number;
          heartCount: number;
          projectId: Id<"projects">;
          publishedAt?: number;
          relatedFeedbackIds: Array<Id<"feedback">>;
          searchContent: string;
          slug: string;
          status: "draft" | "published";
          tags: Array<string>;
          title: string;
          updatedAt: number;
        };
        viewerProfileId: Id<"profiles"> | null;
        writable: boolean;
      }
    >;
    featured: FunctionReference<
      "query",
      "public",
      { projectId: Id<"projects"> },
      Array<{
        author: null | {
          id: Id<"profiles">;
          imageUrl: string | null;
          name: string;
          username: string;
        };
        liked: boolean;
        update: {
          _creationTime: number;
          _id: Id<"updates">;
          authorProfileId: Id<"profiles">;
          category: "changelog" | "article" | "announcement";
          commentCount: number;
          content: string;
          coverAssetId?: Id<"fileAssets">;
          deletingAt?: number;
          featuredAt?: number;
          heartCount: number;
          projectId: Id<"projects">;
          publishedAt?: number;
          relatedFeedbackIds: Array<Id<"feedback">>;
          searchContent: string;
          slug: string;
          status: "draft" | "published";
          tags: Array<string>;
          title: string;
          updatedAt: number;
        };
      }>
    >;
    list: FunctionReference<
      "query",
      "public",
      {
        category?: "changelog" | "article" | "announcement";
        management?: boolean;
        paginationOpts: {
          cursor: string | null;
          endCursor?: string | null;
          id?: number;
          maximumBytesRead?: number;
          maximumRowsRead?: number;
          numItems: number;
        };
        projectId: Id<"projects">;
        search?: string;
      },
      {
        continueCursor: string;
        isDone: boolean;
        page: Array<{
          author: null | {
            id: Id<"profiles">;
            imageUrl: string | null;
            name: string;
            username: string;
          };
          liked: boolean;
          update: {
            _creationTime: number;
            _id: Id<"updates">;
            authorProfileId: Id<"profiles">;
            category: "changelog" | "article" | "announcement";
            commentCount: number;
            content: string;
            coverAssetId?: Id<"fileAssets">;
            deletingAt?: number;
            featuredAt?: number;
            heartCount: number;
            projectId: Id<"projects">;
            publishedAt?: number;
            relatedFeedbackIds: Array<Id<"feedback">>;
            searchContent: string;
            slug: string;
            status: "draft" | "published";
            tags: Array<string>;
            title: string;
            updatedAt: number;
          };
        }>;
        pageStatus?: "SplitRecommended" | "SplitRequired" | null;
        splitCursor?: string | null;
      }
    >;
    remove: FunctionReference<
      "mutation",
      "public",
      { ids: Array<Id<"updates">>; projectId: Id<"projects"> },
      null
    >;
    removeComment: FunctionReference<
      "mutation",
      "public",
      { id: Id<"updateComments"> },
      null
    >;
    save: FunctionReference<
      "mutation",
      "public",
      {
        category: "changelog" | "article" | "announcement";
        content: string;
        featured: boolean;
        id?: Id<"updates">;
        projectId: Id<"projects">;
        publish?: boolean;
        relatedFeedbackIds: Array<Id<"feedback">>;
        tags: Array<string>;
        title: string;
      },
      { id: Id<"updates">; slug: string }
    >;
    saveComment: FunctionReference<
      "mutation",
      "public",
      {
        content: string;
        id?: Id<"updateComments">;
        replyCommentId?: Id<"updateComments">;
        updateId: Id<"updates">;
      },
      Id<"updateComments">
    >;
    setFeaturedMode: FunctionReference<
      "mutation",
      "public",
      { mode: "latest" | "manual"; projectId: Id<"projects"> },
      null
    >;
    toggleReaction: FunctionReference<
      "mutation",
      "public",
      {
        commentId?: Id<"updateComments">;
        content:
          | "heart"
          | "thumbsUp"
          | "thumbsDown"
          | "laugh"
          | "questionMark"
          | "sad"
          | "tada"
          | "eyes"
          | "skull"
          | "explodingHead";
        updateId: Id<"updates">;
      },
      boolean
    >;
  };
  updatesWorkspace: {
    change: FunctionReference<
      "mutation",
      "public",
      {
        category?: "changelog" | "article" | "announcement";
        content?: string;
        featured?: boolean;
        id: Id<"updates">;
        relatedFeedbackIds?: Array<Id<"feedback">>;
        tags?: Array<string>;
        title?: string;
      },
      null
    >;
    changeComment: FunctionReference<
      "mutation",
      "public",
      { content: string; id: Id<"updateComments"> },
      null
    >;
    changeStatus: FunctionReference<
      "mutation",
      "public",
      { id: Id<"updates">; status: "draft" | "published" },
      null
    >;
    detail: FunctionReference<
      "query",
      "public",
      { projectId: Id<"projects">; slug: string },
      null | {
        author: null | {
          id: Id<"profiles">;
          imageUrl: string | null;
          name: string;
          username: string;
        };
        canEdit: boolean;
        commentCount: number;
        commentWindow: {
          head: Array<{
            author: null | {
              id: Id<"profiles">;
              imageUrl: string | null;
              name: string;
              username: string;
            };
            canDelete: boolean;
            canEdit: boolean;
            content: string;
            createdAt: number;
            emoteCounts: Record<
              string,
              { authorProfileIds: Array<string>; count: number }
            >;
            id: Id<"updateComments">;
            isTeamMember: boolean;
            updatedTime?: number;
          }>;
          middleCursor: string | null;
          tail: Array<{
            author: null | {
              id: Id<"profiles">;
              imageUrl: string | null;
              name: string;
              username: string;
            };
            canDelete: boolean;
            canEdit: boolean;
            content: string;
            createdAt: number;
            emoteCounts: Record<
              string,
              { authorProfileIds: Array<string>; count: number }
            >;
            id: Id<"updateComments">;
            isTeamMember: boolean;
            updatedTime?: number;
          }>;
          tailCommentIds: Array<string>;
        };
        coverImageUrl: string | null;
        currentProfile: null | {
          id: Id<"profiles">;
          imageUrl: string | null;
          name: string;
          username: string;
        };
        emoteCounts: Record<
          string,
          { authorProfileIds: Array<string>; count: number }
        >;
        relatedFeedback: Array<{
          board: null | {
            icon?: string;
            id: Id<"feedbackBoards">;
            name: string;
            slug: string;
          };
          id: Id<"feedback">;
          slug: string;
          status: "open" | "in-progress" | "closed" | "completed" | "paused";
          title: string;
        }>;
        update: {
          authorProfileId: Id<"profiles">;
          category: "changelog" | "article" | "announcement";
          content: string;
          coverAssetId?: Id<"fileAssets">;
          coverImageId: string | null;
          createdAt: number;
          featuredAt: number | null;
          id: Id<"updates">;
          projectId: Id<"projects">;
          publishedAt: number | null;
          relatedFeedbackIds: Array<Id<"feedback">>;
          slug: string;
          status: "draft" | "published";
          tags: Array<string>;
          title: string;
          updatedTime?: number;
        };
      }
    >;
    featured: FunctionReference<
      "query",
      "public",
      { projectId: Id<"projects"> },
      {
        items: Array<{
          author: null | {
            id: Id<"profiles">;
            imageUrl: string | null;
            name: string;
            username: string;
          };
          authorProfileId: Id<"profiles">;
          category: "changelog" | "article" | "announcement";
          commentCount: number;
          content: string;
          contentPreview: string;
          contentPreviewIsTruncated: boolean;
          coverAssetId?: Id<"fileAssets">;
          coverImageId: string | null;
          coverImageUrl: string | null;
          createdAt: number;
          emoteCounts: Record<
            string,
            { authorProfileIds: Array<string>; count: number }
          >;
          featuredAt: number | null;
          id: Id<"updates">;
          projectId: Id<"projects">;
          publishedAt: number | null;
          relatedFeedbackIds: Array<Id<"feedback">>;
          slug: string;
          status: "draft" | "published";
          tags: Array<string>;
          title: string;
          updatedTime?: number;
        }>;
      }
    >;
    feedbackByIds: FunctionReference<
      "query",
      "public",
      { ids: Array<Id<"feedback">> },
      Array<{
        board: null | {
          icon?: string;
          id: Id<"feedbackBoards">;
          name: string;
          slug: string;
        };
        id: Id<"feedback">;
        slug: string;
        status: "open" | "in-progress" | "closed" | "completed" | "paused";
        title: string;
      }>
    >;
    interactive: FunctionReference<
      "query",
      "public",
      { projectId: Id<"projects">; updateId: Id<"updates"> },
      null | {
        canEdit: boolean;
        currentProfile: null | {
          id: Id<"profiles">;
          imageUrl: string | null;
          name: string;
          username: string;
        };
        emoteCounts: Record<
          string,
          { authorProfileIds: Array<string>; count: number }
        >;
        relatedFeedback: Array<{
          board: null | {
            icon?: string;
            id: Id<"feedbackBoards">;
            name: string;
            slug: string;
          };
          id: Id<"feedback">;
          slug: string;
          status: "open" | "in-progress" | "closed" | "completed" | "paused";
          title: string;
        }>;
      }
    >;
    list: FunctionReference<
      "query",
      "public",
      {
        category?: "changelog" | "article" | "announcement";
        management?: boolean;
        paginationOpts: {
          cursor: string | null;
          endCursor?: string | null;
          id?: number;
          maximumBytesRead?: number;
          maximumRowsRead?: number;
          numItems: number;
        };
        projectId: Id<"projects">;
        search?: string;
      },
      {
        continueCursor: string;
        isDone: boolean;
        page: Array<{
          author: null | {
            id: Id<"profiles">;
            imageUrl: string | null;
            name: string;
            username: string;
          };
          authorProfileId: Id<"profiles">;
          category: "changelog" | "article" | "announcement";
          commentCount: number;
          content: string;
          contentPreview: string;
          contentPreviewIsTruncated: boolean;
          coverAssetId?: Id<"fileAssets">;
          coverImageId: string | null;
          coverImageUrl: string | null;
          createdAt: number;
          emoteCounts: Record<
            string,
            { authorProfileIds: Array<string>; count: number }
          >;
          featuredAt: number | null;
          id: Id<"updates">;
          projectId: Id<"projects">;
          publishedAt: number | null;
          relatedFeedbackIds: Array<Id<"feedback">>;
          slug: string;
          status: "draft" | "published";
          tags: Array<string>;
          title: string;
          updatedTime?: number;
        }>;
        pageStatus?: "SplitRecommended" | "SplitRequired" | null;
        splitCursor?: string | null;
      }
    >;
    middleComments: FunctionReference<
      "query",
      "public",
      {
        cursor: string;
        limit?: number;
        tailCommentIds?: Array<string>;
        updateId: Id<"updates">;
      },
      {
        comments: Array<{
          author: null | {
            id: Id<"profiles">;
            imageUrl: string | null;
            name: string;
            username: string;
          };
          canDelete: boolean;
          canEdit: boolean;
          content: string;
          createdAt: number;
          emoteCounts: Record<
            string,
            { authorProfileIds: Array<string>; count: number }
          >;
          id: Id<"updateComments">;
          isTeamMember: boolean;
          updatedTime?: number;
        }>;
        nextCursor: string | null;
      }
    >;
    remove: FunctionReference<
      "mutation",
      "public",
      { id: Id<"updates"> },
      null
    >;
    searchFeedback: FunctionReference<
      "query",
      "public",
      { projectId: Id<"projects">; search?: string },
      Array<{
        board: null | {
          icon?: string;
          id: Id<"feedbackBoards">;
          name: string;
          slug: string;
        };
        id: Id<"feedback">;
        slug: string;
        status: "open" | "in-progress" | "closed" | "completed" | "paused";
        title: string;
      }>
    >;
    toggleComment: FunctionReference<
      "mutation",
      "public",
      { content: string; updateCommentId: Id<"updateComments"> },
      boolean
    >;
  };
  userDataExport: {
    exportData: FunctionReference<
      "query",
      "public",
      { generatedAt: number; sections?: Array<"comments"> },
      {
        account: {
          email: string | null;
          profileId: Id<"profiles">;
          userId: Id<"users">;
          username: string;
        };
        format: "kino-user-data-export";
        generatedAt: string;
        sections: {
          comments?: {
            counts: {
              feedbackComments: number;
              total: number;
              updateComments: number;
            };
            feedbackComments: Array<{
              content: string;
              context:
                | { contextAccess: "missing"; feedbackId: Id<"feedback"> }
                | {
                    contextAccess: "inaccessible";
                    feedbackId: Id<"feedback">;
                    projectId: Id<"projects">;
                  }
                | {
                    board: null | {
                      id: Id<"feedbackBoards">;
                      name: string;
                      slug: string;
                    };
                    contextAccess: "visible";
                    feedback: {
                      id: Id<"feedback">;
                      slug: string;
                      status:
                        | "open"
                        | "in-progress"
                        | "closed"
                        | "completed"
                        | "paused";
                      title: string;
                    };
                    organization: null | {
                      id: Id<"organizations">;
                      name: string;
                      slug: string;
                    };
                    project: {
                      id: Id<"projects">;
                      name: string;
                      orgSlug: string;
                      slug: string;
                      visibility: "public" | "private" | "archived";
                    };
                  };
              createdAt: string | null;
              feedbackId: Id<"feedback">;
              id: Id<"feedbackComments">;
              initial: boolean;
              replyFeedbackCommentId: Id<"feedbackComments"> | null;
              source: "feedback";
              updatedAt: string | null;
            }>;
            updateComments: Array<{
              content: string;
              context:
                | { contextAccess: "missing"; updateId: Id<"updates"> }
                | {
                    contextAccess: "inaccessible";
                    projectId: Id<"projects">;
                    updateId: Id<"updates">;
                  }
                | {
                    contextAccess: "visible";
                    organization: null | {
                      id: Id<"organizations">;
                      name: string;
                      slug: string;
                    };
                    project: {
                      id: Id<"projects">;
                      name: string;
                      orgSlug: string;
                      slug: string;
                      visibility: "public" | "private" | "archived";
                    };
                    update: {
                      category: "changelog" | "article" | "announcement";
                      id: Id<"updates">;
                      publishedAt: string | null;
                      slug: string;
                      status: "draft" | "published";
                      title: string;
                    };
                  };
              createdAt: string | null;
              id: Id<"updateComments">;
              source: "update";
              updateId: Id<"updates">;
              updatedAt: string | null;
            }>;
            version: number;
          };
        };
        version: number;
      }
    >;
    getAvailableSections: FunctionReference<
      "query",
      "public",
      {},
      Array<{
        description: string;
        id: "comments";
        includedByDefault: boolean;
        label: string;
      }>
    >;
  };
};

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: {
  feedback: {
    processDeletionJob: FunctionReference<
      "mutation",
      "internal",
      { jobId: Id<"feedbackDeletionJobs"> },
      null
    >;
  };
  feedbackBoards: {
    purge: FunctionReference<
      "mutation",
      "internal",
      { boardId: Id<"feedbackBoards"> },
      null
    >;
  };
  feedbackComments: {
    cleanComment: FunctionReference<
      "mutation",
      "internal",
      { commentId: Id<"feedbackComments"> },
      null
    >;
  };
  files: {
    claimUpload: FunctionReference<
      "mutation",
      "internal",
      { assetId: Id<"fileAssets"> },
      null | {
        asset: {
          _creationTime: number;
          _id: Id<"fileAssets">;
          access: "public" | "project_staff" | "private_user";
          category:
            | "image"
            | "video"
            | "document"
            | "text"
            | "data"
            | "package"
            | "design";
          coverUpdateId?: Id<"updates">;
          extension: string;
          extractedText?: string;
          folderId?: Id<"fileFolders">;
          listing: "project_files" | "unlisted";
          name: string;
          normalizedName: string;
          objectId?: Id<"fileObjects">;
          origin: "files" | "update_cover";
          projectId: Id<"projects">;
          publicId: string;
          searchContent: string;
          state: "pending" | "ready" | "deleting" | "deleted";
          updatedAt: number;
          uploaderClass: "staff" | "user";
          uploaderId: Id<"users">;
        };
        attempt: string;
        object: {
          _creationTime: number;
          _id: Id<"fileObjects">;
          accounting: "reserved" | "used" | "released";
          actualBytes?: number;
          assetId: Id<"fileAssets">;
          declaredBytes: number;
          expiresAt: number;
          key: string;
          maxBytes: number;
          mimeType: string;
          processingAttempt?: string;
          processingUntil?: number;
          projectId: Id<"projects">;
          settleAfter: number;
          stagingKey: string;
          state: "pending" | "ready" | "deleting" | "deleted";
          thumbnailBytes?: number;
          thumbnailKey?: string;
        };
      }
    >;
    deliverySource: FunctionReference<
      "query",
      "internal",
      { assetId: Id<"fileAssets">; thumbnail?: boolean },
      { key: string; mimeType: string; name: string }
    >;
    expire: FunctionReference<
      "mutation",
      "internal",
      { objectId: Id<"fileObjects"> },
      null
    >;
    finishUpload: FunctionReference<
      "mutation",
      "internal",
      {
        attempt: string;
        bytes: number;
        extractedText?: string;
        mimeType: string;
        objectId: Id<"fileObjects">;
        thumbnailBytes?: number;
      },
      boolean
    >;
    rejectUpload: FunctionReference<
      "mutation",
      "internal",
      { attempt: string; objectId: Id<"fileObjects"> },
      null
    >;
    reserveUpload: FunctionReference<
      "mutation",
      "internal",
      {
        files: Array<{ mimeType: string; name: string; sizeBytes: number }>;
        folderId?: Id<"fileFolders"> | null;
        projectId: Id<"projects">;
        updateId?: Id<"updates">;
      },
      Array<{
        assetId: Id<"fileAssets">;
        expiresAt: number;
        mimeType: string;
        objectId: Id<"fileObjects">;
        sizeBytes: number;
        stagingKey: string;
      }>
    >;
  };
  filesJobs: {
    acknowledge: FunctionReference<
      "mutation",
      "internal",
      { attempt: number; jobId: Id<"storageCleanupJobs"> },
      null
    >;
    claim: FunctionReference<
      "mutation",
      "internal",
      { jobId: Id<"storageCleanupJobs"> },
      null | {
        job: {
          _creationTime: number;
          _id: Id<"storageCleanupJobs">;
          attempt: number;
          finishedAt?: number;
          lastError?: string;
          leaseUntil: number;
          maxAttempt: number;
          notBefore: number;
          objectId: Id<"fileObjects">;
          projectId: Id<"projects">;
          stagingOnly: boolean;
          state: "pending" | "running" | "failed" | "done";
        };
        keys: Array<string>;
        publicId: string;
      }
    >;
    fail: FunctionReference<
      "mutation",
      "internal",
      { attempt: number; jobId: Id<"storageCleanupJobs"> },
      null
    >;
  };
  filesProjectPurge: {
    batch: FunctionReference<
      "mutation",
      "internal",
      { projectId: Id<"projects"> },
      null
    >;
    begin: FunctionReference<
      "mutation",
      "internal",
      { projectId: Id<"projects"> },
      null
    >;
  };
  filesTransport: {
    cleanup: FunctionReference<
      "action",
      "internal",
      { jobId: Id<"storageCleanupJobs"> },
      null
    >;
  };
  github: {
    createUser: FunctionReference<
      "mutation",
      "internal",
      {
        provider: {
          accountId: string;
          name: "github";
          profile: {
            avatarUrl?: string;
            email?: string;
            emailVerified: boolean;
            id: string;
            login: string;
            name?: string;
          };
        };
      },
      Id<"users">
    >;
    onSignIn: FunctionReference<
      "mutation",
      "internal",
      {
        provider: {
          accountId: string;
          name: "github";
          profile: {
            avatarUrl?: string;
            email?: string;
            emailVerified: boolean;
            id: string;
            login: string;
            name?: string;
          };
        };
        userId: Id<"users">;
      },
      null
    >;
  };
  imageUpload: {
    reconcileOrphanedImages: FunctionReference<
      "mutation",
      "internal",
      { cursor?: string | null; cutoff?: number; since?: number },
      { checked: number; deleted: number; done: boolean }
    >;
  };
  mail: {
    deliver: FunctionReference<
      "action",
      "internal",
      { attempt: number; challengeId: Id<"authChallenges">; code: string },
      null
    >;
    deliverInvitation: FunctionReference<
      "action",
      "internal",
      { attempt: number; invitationId: Id<"invitations"> },
      null
    >;
    pending: FunctionReference<
      "query",
      "internal",
      { challengeId: Id<"authChallenges">; code: string; now: number },
      null | {
        email: string;
        locale: "en-US" | "es-419" | "zh-Hans";
        name: string;
        purpose: "verify" | "reset";
      }
    >;
    pendingInvitation: FunctionReference<
      "query",
      "internal",
      { invitationId: Id<"invitations">; now: number },
      null | {
        email: string;
        invitationId: Id<"invitations">;
        inviterEmail: string;
        inviterName: string;
        locale: "en-US" | "es-419" | "zh-Hans";
        organizationName: string;
        role: "admin" | "moderator";
      }
    >;
    recordInvitationDelivery: FunctionReference<
      "mutation",
      "internal",
      { invitationId: Id<"invitations">; status: "accepted" | "failed" },
      null
    >;
  };
  operations: {
    cleanupHistory: FunctionReference<
      "mutation",
      "internal",
      {},
      { alerts: number; jobs: number; maintenance: number }
    >;
    scanAlerts: FunctionReference<
      "mutation",
      "internal",
      {},
      { active: number; created: number; resolved: number }
    >;
  };
  operationsMail: {
    deliver: FunctionReference<
      "action",
      "internal",
      { alertId: Id<"operationalAlerts">; attempt: number },
      null
    >;
    pending: FunctionReference<
      "query",
      "internal",
      { alertId: Id<"operationalAlerts"> },
      null | { kind: string; state: string; targetId: string }
    >;
    record: FunctionReference<
      "mutation",
      "internal",
      {
        alertId: Id<"operationalAlerts">;
        attempt: number;
        status: "accepted" | "failed" | "disabled";
      },
      null
    >;
  };
  operationsMaintenance: {
    fail: FunctionReference<
      "mutation",
      "internal",
      { jobId: Id<"maintenanceJobs"> },
      null
    >;
    run: FunctionReference<
      "action",
      "internal",
      { jobId: Id<"maintenanceJobs"> },
      null
    >;
    step: FunctionReference<
      "mutation",
      "internal",
      { jobId: Id<"maintenanceJobs"> },
      { continue: boolean }
    >;
  };
  organizationAppearance: {
    clearExpiredLogoUploadIntents: FunctionReference<
      "mutation",
      "internal",
      {},
      number
    >;
  };
  password: {
    clearExpiredChallenges: FunctionReference<
      "mutation",
      "internal",
      {},
      number
    >;
    createUser: FunctionReference<
      "mutation",
      "internal",
      {
        provider: {
          accountId: string;
          name: "emailPassword";
          profile: {
            email: string;
            locale?: "en-US" | "es-419" | "zh-Hans";
            name?: string;
          };
        };
      },
      Id<"users">
    >;
    onSignIn: FunctionReference<
      "mutation",
      "internal",
      {
        provider: {
          accountId: string;
          name: "emailPassword";
          profile: {
            email: string;
            locale?: "en-US" | "es-419" | "zh-Hans";
            name?: string;
          };
        };
        userId: Id<"users">;
      },
      null
    >;
  };
  profiles: {
    clearExpiredAvatarUploadIntents: FunctionReference<
      "mutation",
      "internal",
      {},
      number
    >;
  };
  projectDeletion: {
    batch: FunctionReference<
      "mutation",
      "internal",
      { projectId: Id<"projects"> },
      null
    >;
  };
  relay: {
    callbackContext: FunctionReference<
      "mutation",
      "internal",
      { state: string },
      {
        knownInstallationIds: Array<number>;
        targets: Array<{
          accountId: number;
          repositories: Array<{ fullName: string; id: number }>;
        }>;
      }
    >;
    complete: FunctionReference<
      "mutation",
      "internal",
      {
        deletedInstallationIds: Array<number>;
        installations: Array<{
          authorizedRepositoryIds: Array<number>;
          installation: {
            account: null | { id: number; login: string; type: string };
            events: Array<string>;
            id: number;
            permissions: Record<string, string>;
            repository_selection: string;
          };
        }>;
        state: string;
      },
      { orgSlug: string; projectSlug?: string }
    >;
    installationContext: FunctionReference<
      "query",
      "internal",
      { installationId: number; orgSlug: string; projectSlug?: string },
      {
        accountId: number;
        accountLogin: string;
        accountType: string;
        connectedByProfileId: Id<"profiles">;
        events: Array<string>;
        id: Id<"relayInstallations">;
        installationId: number;
        orgId: Id<"organizations">;
        orgSlug: string;
        permissions: Record<string, string>;
        repositorySelection: string;
        status: "active" | "stale" | "deleted" | "suspended";
        updatedTime: number;
      }
    >;
    reserveAction: FunctionReference<
      "mutation",
      "internal",
      { orgSlug: string; projectSlug?: string },
      null
    >;
    saveRepository: FunctionReference<
      "mutation",
      "internal",
      {
        enabledSources: Array<"issues" | "discussions">;
        installationId: number;
        installationRowId: Id<"relayInstallations">;
        mode: "read" | "read_write";
        orgSlug: string;
        projectSlug: string;
        repository: {
          full_name: string;
          id: number;
          name: string;
          node_id: string;
          owner: { login: string };
          private: boolean;
        };
        verificationSummary: {
          discussions: { enabled: boolean; ok: boolean };
          issues: { ok: boolean };
        };
      },
      { connectionId: Id<"relayConnections"> }
    >;
    stale: FunctionReference<
      "mutation",
      "internal",
      { id: Id<"relayInstallations"> },
      null
    >;
    webhook: FunctionReference<
      "mutation",
      "internal",
      {
        action?: string;
        deliveryId: string;
        event: string;
        events?: Array<string>;
        installationId?: number;
        issue?: {
          nodeId: string;
          number: number;
          repositoryId: number;
          state: string;
          title: string;
          url: string;
        };
        permissions?: Record<string, string>;
        removedRepositoryIds?: Array<number>;
      },
      { duplicate: boolean; result: "ignored" | "processed" }
    >;
  };
  relayFeedback: {
    context: FunctionReference<
      "query",
      "internal",
      { feedbackId: Id<"feedback"> },
      {
        connection: {
          connectedByProfileId: Id<"profiles">;
          deletedTime?: number;
          enabledSources: Array<"issues" | "discussions">;
          githubInstallationId: Id<"relayInstallations">;
          id: Id<"relayConnections">;
          mode: "read" | "read_write";
          orgId: Id<"organizations">;
          orgSlug: string;
          projectId: Id<"projects">;
          projectSlug: string;
          repoFullName: string;
          repoId: number;
          repoName: string;
          repoNodeId: string;
          repoOwner: string;
          repoPrivate: boolean;
          updatedTime: number;
          verificationStatus: string;
          verificationSummary: {
            discussions: { enabled: boolean; ok: boolean };
            issues: { ok: boolean };
          };
        };
        feedbackTitle: string;
        installation: {
          accountId: number;
          accountLogin: string;
          accountType: string;
          connectedByProfileId: Id<"profiles">;
          events: Array<string>;
          id: Id<"relayInstallations">;
          installationId: number;
          orgId: Id<"organizations">;
          orgSlug: string;
          permissions: Record<string, string>;
          repositorySelection: string;
          status: "active" | "stale" | "deleted" | "suspended";
          updatedTime: number;
        };
        profileId: Id<"profiles">;
      }
    >;
    save: FunctionReference<
      "mutation",
      "internal",
      {
        connectionId: Id<"relayConnections">;
        feedbackId: Id<"feedback">;
        refresh?: boolean;
        target: {
          databaseId: number;
          nodeId: string;
          number: number;
          state: string;
          title: string;
          url: string;
        };
      },
      { connectionId: Id<"relayIssues"> }
    >;
  };
  settings: {
    githubImportContext: FunctionReference<
      "query",
      "internal",
      { id: Id<"projects"> },
      {
        connection: {
          connectedByProfileId: Id<"profiles">;
          deletedTime?: number;
          enabledSources: Array<"issues" | "discussions">;
          githubInstallationId: Id<"relayInstallations">;
          id: Id<"relayConnections">;
          mode: "read" | "read_write";
          orgId: Id<"organizations">;
          orgSlug: string;
          projectId: Id<"projects">;
          projectSlug: string;
          repoFullName: string;
          repoId: number;
          repoName: string;
          repoNodeId: string;
          repoOwner: string;
          repoPrivate: boolean;
          updatedTime: number;
          verificationStatus: string;
          verificationSummary: {
            discussions: { enabled: boolean; ok: boolean };
            issues: { ok: boolean };
          };
        };
        installation: {
          accountId: number;
          accountLogin: string;
          accountType: string;
          connectedByProfileId: Id<"profiles">;
          events: Array<string>;
          id: Id<"relayInstallations">;
          installationId: number;
          orgId: Id<"organizations">;
          orgSlug: string;
          permissions: Record<string, string>;
          repositorySelection: string;
          status: "active" | "stale" | "deleted" | "suspended";
          updatedTime: number;
        };
      }
    >;
  };
  updates: {
    cleanComment: FunctionReference<
      "mutation",
      "internal",
      { id: Id<"updateComments"> },
      null
    >;
    deleteBatch: FunctionReference<
      "mutation",
      "internal",
      { id: Id<"updates"> },
      null
    >;
  };
};

export declare const components: {
  auth: import("@convex-dev/auth/core/_generated/component.js").ComponentApi<"auth">;
  password: import("@convex-dev/auth/providers/password/_generated/component.js").ComponentApi<"password">;
  authLimits: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"authLimits">;
  oauthGithub: import("@convex-dev/auth/providers/oauth/_generated/component.js").ComponentApi<"oauthGithub">;
};
