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
  admin: {
    getSystemMetrics: FunctionReference<"query", "public", {}, any>;
  };
  feedback: {
    create: FunctionReference<
      "mutation",
      "public",
      {
        boardId: string;
        firstComment: string;
        projectId: string;
        title: string;
      },
      any
    >;
    getByIds: FunctionReference<"query", "public", { ids: Array<string> }, any>;
    getDetailCritical: FunctionReference<
      "query",
      "public",
      { projectId: string; slug: string },
      any
    >;
    getDetailInteractive: FunctionReference<
      "query",
      "public",
      { feedbackId: string; projectId: string },
      any
    >;
    getMiddleComments: FunctionReference<
      "query",
      "public",
      { cursor: string; endCursor?: string | null; feedbackId: string },
      any
    >;
    listProjectFeedback: FunctionReference<
      "query",
      "public",
      {
        boardId: string | "all";
        cursor?: string | null;
        limit?: number;
        order?: "asc" | "desc";
        projectId: string;
        search?: string;
        status?: "open" | "in-progress" | "closed" | "completed" | "paused";
        tags?: Array<string>;
      },
      { continueCursor: string | null; isDone: boolean; page: Array<any> }
    >;
    remove: FunctionReference<"mutation", "public", { id: string }, any>;
    searchForLinking: FunctionReference<
      "query",
      "public",
      { projectId: string; search: string },
      any
    >;
    setAnswerComment: FunctionReference<
      "mutation",
      "public",
      { commentId: string | null; feedbackId: string },
      any
    >;
    updateAssigned: FunctionReference<
      "mutation",
      "public",
      { assignedProfileId: string | null; feedbackId: string },
      any
    >;
    updateBoard: FunctionReference<
      "mutation",
      "public",
      { boardId: string; id: string },
      any
    >;
    updatePriority: FunctionReference<
      "mutation",
      "public",
      { id: string; priority: "none" | "low" | "medium" | "high" | "urgent" },
      any
    >;
    updateStatus: FunctionReference<
      "mutation",
      "public",
      {
        id: string;
        status: "open" | "in-progress" | "closed" | "completed" | "paused";
      },
      any
    >;
    updateTarget: FunctionReference<
      "mutation",
      "public",
      {
        feedbackId: string;
        target: string | null;
        targetGranularity: "day" | "month" | "quarter" | "year" | null;
      },
      any
    >;
    updateTitle: FunctionReference<
      "mutation",
      "public",
      { id: string; title: string },
      any
    >;
  };
  feedbackBoard: {
    _delete: FunctionReference<
      "mutation",
      "public",
      { boardId: string; projectId: string },
      any
    >;
    create: FunctionReference<
      "mutation",
      "public",
      {
        description?: string;
        icon?: string;
        name: string;
        projectId: string;
        slug: string;
      },
      any
    >;
    get: FunctionReference<
      "query",
      "public",
      { id: string; orgSlug: string; projectSlug: string },
      any
    >;
    listProjectBoards: FunctionReference<
      "query",
      "public",
      { projectId?: string; slug?: string },
      any
    >;
    remove: FunctionReference<
      "mutation",
      "public",
      { boardId: string; projectId: string },
      any
    >;
    update: FunctionReference<
      "mutation",
      "public",
      {
        description?: string;
        icon?: string;
        id: string;
        name?: string;
        orgSlug: string;
        projectSlug: string;
        slug?: string;
      },
      any
    >;
  };
  feedbackComment: {
    create: FunctionReference<
      "mutation",
      "public",
      { content: string; feedbackId: string },
      any
    >;
    listByFeedback: FunctionReference<
      "query",
      "public",
      { feedbackId: string },
      any
    >;
    remove: FunctionReference<"mutation", "public", { _id: string }, any>;
    update: FunctionReference<
      "mutation",
      "public",
      { _id: string; content: string },
      any
    >;
  };
  feedbackCommentEmote: {
    toggle: FunctionReference<
      "mutation",
      "public",
      {
        content:
          | "thumbsUp"
          | "thumbsDown"
          | "laugh"
          | "questionMark"
          | "sad"
          | "tada"
          | "eyes"
          | "heart"
          | "skull"
          | "explodingHead";
        feedbackCommentId: string;
        feedbackId: string;
      },
      any
    >;
  };
  feedbackEvent: {
    listByFeedback: FunctionReference<
      "query",
      "public",
      { feedbackId: string },
      any
    >;
  };
  feedbackGithub: {
    connectExisting: FunctionReference<
      "action",
      "public",
      {
        feedbackId: string;
        feedbackUrl: string;
        githubNumber: number;
        kind: "issue";
      },
      any
    >;
    createAndConnect: FunctionReference<
      "action",
      "public",
      {
        body?: string;
        feedbackId: string;
        feedbackUrl: string;
        kind: "issue";
        title: string;
      },
      any
    >;
    getAvailability: FunctionReference<
      "query",
      "public",
      { feedbackId: string },
      any
    >;
    listByFeedback: FunctionReference<
      "query",
      "public",
      { feedbackId: string },
      any
    >;
    refreshCounts: FunctionReference<
      "action",
      "public",
      { feedbackId: string },
      any
    >;
    searchTargets: FunctionReference<
      "action",
      "public",
      { feedbackId: string; kind: "issue"; query?: string },
      any
    >;
  };
  feedbackUpvote: {
    getCount: FunctionReference<"query", "public", { feedbackId: string }, any>;
    getUpvoteData: FunctionReference<
      "query",
      "public",
      { feedbackId: string },
      any
    >;
    hasUpvoted: FunctionReference<
      "query",
      "public",
      { feedbackId: string },
      any
    >;
    toggle: FunctionReference<
      "mutation",
      "public",
      { feedbackId: string },
      any
    >;
  };
  github: {
    disconnectRepository: FunctionReference<
      "mutation",
      "public",
      { connectionId: string; orgSlug: string; projectSlug: string },
      any
    >;
    getOrgIntegration: FunctionReference<
      "query",
      "public",
      { orgSlug: string },
      any
    >;
    getProjectIntegration: FunctionReference<
      "query",
      "public",
      { orgSlug: string; projectSlug: string },
      any
    >;
    startInstallationRefresh: FunctionReference<
      "mutation",
      "public",
      {
        callbackTargetUrl?: string;
        mode?: "read" | "read_write";
        orgSlug: string;
        projectSlug: string;
      },
      any
    >;
    startOrgConnection: FunctionReference<
      "mutation",
      "public",
      {
        callbackTargetUrl?: string;
        mode?: "read" | "read_write";
        orgSlug: string;
      },
      any
    >;
    startOrgInstallationRefresh: FunctionReference<
      "mutation",
      "public",
      {
        callbackTargetUrl?: string;
        mode?: "read" | "read_write";
        orgSlug: string;
      },
      any
    >;
    startProjectConnection: FunctionReference<
      "mutation",
      "public",
      {
        callbackTargetUrl?: string;
        mode?: "read" | "read_write";
        orgSlug: string;
        projectSlug: string;
      },
      any
    >;
  };
  githubExternal: {
    connectRepository: FunctionReference<
      "action",
      "public",
      {
        enabledSources?: Array<"issues" | "discussions">;
        installationId: number;
        mode?: "read" | "read_write";
        orgSlug: string;
        projectSlug: string;
        repoId: number;
      },
      any
    >;
    listInstallationRepositoriesForProject: FunctionReference<
      "action",
      "public",
      { installationId: number; orgSlug: string },
      any
    >;
  };
  org: {
    create: FunctionReference<
      "mutation",
      "public",
      {
        logo?: string;
        name: string;
        slug?: string;
        visibility?: "public" | "private";
      },
      any
    >;
    findMyEditableOrgs: FunctionReference<"query", "public", {}, any>;
    findMyOrgs: FunctionReference<"query", "public", {}, any>;
    generateAvatarUploadUrl: FunctionReference<
      "mutation",
      "public",
      { organizationId: string },
      any
    >;
    getDetails: FunctionReference<"query", "public", { slug: string }, any>;
    getMyPermission: FunctionReference<
      "query",
      "public",
      { slug: string },
      any
    >;
    syncAvatarMetadata: FunctionReference<
      "mutation",
      "public",
      { key: string },
      any
    >;
    update: FunctionReference<
      "mutation",
      "public",
      {
        currentSlug: string;
        logo?: string;
        name?: string;
        updatedSlug?: string;
        visibility?: "public" | "private";
      },
      any
    >;
  };
  orgMember: {
    cancelInvitation: FunctionReference<
      "mutation",
      "public",
      { invitationId: string },
      any
    >;
    inviteMember: FunctionReference<
      "mutation",
      "public",
      { email: string; organizationId: string; role: "admin" | "editor" },
      any
    >;
    leaveOrganization: FunctionReference<
      "mutation",
      "public",
      { organizationId: string },
      any
    >;
    listMembers: FunctionReference<"query", "public", { slug: string }, any>;
    listPendingInvitations: FunctionReference<
      "query",
      "public",
      { slug: string },
      any
    >;
    removeMember: FunctionReference<
      "mutation",
      "public",
      { memberId: string },
      any
    >;
    updateMemberRole: FunctionReference<
      "mutation",
      "public",
      { memberId: string; role: "owner" | "admin" | "editor" },
      any
    >;
  };
  profile: {
    findMyProfile: FunctionReference<"query", "public", {}, any>;
    generateAvatarUploadUrl: FunctionReference<"mutation", "public", {}, any>;
    getByUsername: FunctionReference<
      "query",
      "public",
      { username: string },
      any
    >;
    syncMetadata: FunctionReference<"mutation", "public", { key: string }, any>;
    update: FunctionReference<
      "mutation",
      "public",
      {
        profile: {
          bio?: string | null;
          imageKey?: string | null;
          location?: string | null;
          urls?: Array<{
            source?: "manual" | "github";
            text: string;
            url: string;
          }> | null;
        };
        user: {
          image?: string | null;
          name?: string | null;
          username?: string | null;
        };
      },
      any
    >;
  };
  project: {
    create: FunctionReference<
      "mutation",
      "public",
      {
        description?: string;
        name: string;
        orgSlug: string;
        slug: string;
        urls?: Array<{
          source?: "manual" | "github";
          text: string;
          url: string;
        }>;
        visibility: "public" | "private" | "archived";
      },
      any
    >;
    getDetails: FunctionReference<
      "query",
      "public",
      { orgSlug: string; slug: string },
      any
    >;
    getGithubImportInfo: FunctionReference<
      "query",
      "public",
      { id: string },
      any
    >;
    getManyByOrg: FunctionReference<
      "query",
      "public",
      { limit?: number; orgSlug: string },
      any
    >;
    remove: FunctionReference<"mutation", "public", { id: string }, any>;
    update: FunctionReference<
      "mutation",
      "public",
      {
        description?: string;
        id: string;
        name?: string;
        slug?: string;
        urls?: Array<{
          source?: "manual" | "github";
          text: string;
          url: string;
        }>;
        visibility?: "public" | "private" | "archived";
      },
      any
    >;
  };
  projectExternal: {
    importGithubUrls: FunctionReference<
      "action",
      "public",
      { id: string },
      any
    >;
  };
  projectMember: {
    inviteProjectMember: FunctionReference<
      "mutation",
      "public",
      { email: string; projectId: string },
      any
    >;
    listAssignableMembers: FunctionReference<
      "query",
      "public",
      { projectId: string },
      any
    >;
    listProjectMembers: FunctionReference<
      "query",
      "public",
      { projectId: string },
      any
    >;
    removeProjectMember: FunctionReference<
      "mutation",
      "public",
      { projectMemberId: string },
      any
    >;
  };
  update: {
    bulkPublish: FunctionReference<
      "mutation",
      "public",
      { ids: Array<string>; projectId: string },
      any
    >;
    bulkRemove: FunctionReference<
      "mutation",
      "public",
      { ids: Array<string>; projectId: string },
      any
    >;
    bulkUnpublish: FunctionReference<
      "mutation",
      "public",
      { ids: Array<string>; projectId: string },
      any
    >;
    clearCoverImage: FunctionReference<
      "mutation",
      "public",
      { updateId: string },
      any
    >;
    create: FunctionReference<
      "mutation",
      "public",
      {
        category?: "changelog" | "article" | "announcement";
        content: string;
        coverImageId?: string;
        projectId: string;
        relatedFeedbackIds?: Array<string>;
        tags?: Array<string>;
        title: string;
      },
      any
    >;
    generateCoverImageUploadUrl: FunctionReference<
      "mutation",
      "public",
      { updateId: string },
      any
    >;
    getBySlug: FunctionReference<
      "query",
      "public",
      { projectId: string; slug: string },
      any
    >;
    getCoverImageUrl: FunctionReference<
      "query",
      "public",
      { key: string },
      any
    >;
    getDetailCritical: FunctionReference<
      "query",
      "public",
      { projectId: string; slug: string },
      any
    >;
    getDetailInteractive: FunctionReference<
      "query",
      "public",
      { projectId: string; updateId: string },
      any
    >;
    getMiddleComments: FunctionReference<
      "query",
      "public",
      {
        cursor: string;
        limit?: number;
        tailCommentIds?: Array<string>;
        updateId: string;
      },
      any
    >;
    listByProject: FunctionReference<
      "query",
      "public",
      {
        category?: "changelog" | "article" | "announcement";
        cursor?: string | null;
        limit?: number;
        projectId: string;
      },
      { continueCursor: string | null; isDone: boolean; page: Array<any> }
    >;
    listProjectDashboard: FunctionReference<
      "query",
      "public",
      { cursor?: string | null; limit?: number; projectId: string },
      { continueCursor: string | null; isDone: boolean; page: Array<any> }
    >;
    publish: FunctionReference<"mutation", "public", { id: string }, any>;
    remove: FunctionReference<"mutation", "public", { id: string }, any>;
    syncMetadata: FunctionReference<"mutation", "public", { key: string }, any>;
    unpublish: FunctionReference<"mutation", "public", { id: string }, any>;
    update: FunctionReference<
      "mutation",
      "public",
      {
        category?: "changelog" | "article" | "announcement";
        content?: string;
        coverImageId?: string | null;
        id: string;
        relatedFeedbackIds?: Array<string>;
        tags?: Array<string>;
        title?: string;
      },
      any
    >;
  };
  updateComment: {
    create: FunctionReference<
      "mutation",
      "public",
      { content: string; updateId: string },
      any
    >;
    listByUpdate: FunctionReference<
      "query",
      "public",
      { updateId: string },
      any
    >;
    remove: FunctionReference<"mutation", "public", { _id: string }, any>;
    update: FunctionReference<
      "mutation",
      "public",
      { _id: string; content: string },
      any
    >;
  };
  updateCommentEmote: {
    toggle: FunctionReference<
      "mutation",
      "public",
      {
        content:
          | "thumbsUp"
          | "thumbsDown"
          | "laugh"
          | "questionMark"
          | "sad"
          | "tada"
          | "eyes"
          | "heart"
          | "skull"
          | "explodingHead";
        updateCommentId: string;
        updateId: string;
      },
      any
    >;
  };
  updateEmote: {
    toggle: FunctionReference<
      "mutation",
      "public",
      {
        content:
          | "thumbsUp"
          | "thumbsDown"
          | "laugh"
          | "questionMark"
          | "sad"
          | "tada"
          | "eyes"
          | "heart"
          | "skull"
          | "explodingHead";
        updateId: string;
      },
      any
    >;
  };
  userDataExport: {
    exportData: FunctionReference<
      "query",
      "public",
      { sections?: Array<"comments"> },
      any
    >;
    getAvailableSections: FunctionReference<"query", "public", {}, any>;
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
  crons: {
    cleanupWebhookDeliveries: FunctionReference<
      "mutation",
      "internal",
      {},
      any
    >;
  };
  email: {
    sendTransactionalEmail: FunctionReference<
      "action",
      "internal",
      { html: string; subject: string; to: string | Array<string> },
      any
    >;
  };
  feedbackBoard: {
    purgeBoard: FunctionReference<
      "mutation",
      "internal",
      { boardId: Id<"feedbackBoard"> },
      any
    >;
  };
  feedbackEvent: {
    create: FunctionReference<
      "mutation",
      "internal",
      {
        actorProfileId: string;
        eventType:
          | "status_changed"
          | "priority_changed"
          | "board_changed"
          | "assigned"
          | "unassigned"
          | "title_changed"
          | "answer_marked"
          | "answer_unmarked";
        feedbackId: string;
        metadata?: {
          newValue?: string;
          oldValue?: string;
          targetProfileId?: string;
        };
      },
      any
    >;
  };
  feedbackGithub: {
    ensureNotConnected: FunctionReference<
      "query",
      "internal",
      { feedbackId: string; githubNodeId: string; kind: "issue" },
      any
    >;
    getContextForAction: FunctionReference<
      "query",
      "internal",
      {
        feedbackId: string;
        kind: "issue";
        requireSource?: boolean;
        userId: string;
      },
      any
    >;
    saveConnection: FunctionReference<
      "mutation",
      "internal",
      {
        connectedByProfileId: string;
        feedbackId: string;
        githubDatabaseId?: number;
        githubNodeId: string;
        githubNumber: number;
        githubRepositoryConnectionId: string;
        kind: "issue";
        projectId: string;
        state: string;
        title: string;
        url: string;
      },
      any
    >;
    updateConnectionSnapshot: FunctionReference<
      "mutation",
      "internal",
      { connectionId: string; state: string; title: string; url: string },
      any
    >;
  };
  generated: {
    auth: {
      create: FunctionReference<
        "mutation",
        "internal",
        { input: { data: any; model: string }; select?: Array<string> },
        any
      >;
      deleteMany: FunctionReference<
        "mutation",
        "internal",
        {
          input: { model: string; where?: Array<any> };
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        any
      >;
      deleteOne: FunctionReference<
        "mutation",
        "internal",
        { input: { model: string; where?: Array<any> } },
        any
      >;
      findMany: FunctionReference<
        "query",
        "internal",
        {
          join?: any;
          limit?: number;
          model: string;
          offset?: number;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          sortBy?: { direction: "asc" | "desc"; field: string };
          where?: Array<{
            connector?: "AND" | "OR";
            field: string;
            mode?: "sensitive" | "insensitive";
            operator?:
              | "lt"
              | "lte"
              | "gt"
              | "gte"
              | "eq"
              | "in"
              | "not_in"
              | "ne"
              | "contains"
              | "starts_with"
              | "ends_with";
            value:
              | string
              | number
              | boolean
              | Array<string>
              | Array<number>
              | null;
          }>;
        },
        any
      >;
      findOne: FunctionReference<
        "query",
        "internal",
        {
          join?: any;
          model: string;
          select?: Array<string>;
          where?: Array<{
            connector?: "AND" | "OR";
            field: string;
            mode?: "sensitive" | "insensitive";
            operator?:
              | "lt"
              | "lte"
              | "gt"
              | "gte"
              | "eq"
              | "in"
              | "not_in"
              | "ne"
              | "contains"
              | "starts_with"
              | "ends_with";
            value:
              | string
              | number
              | boolean
              | Array<string>
              | Array<number>
              | null;
          }>;
        },
        any
      >;
      getLatestJwks: FunctionReference<"action", "internal", {}, any>;
      rotateKeys: FunctionReference<"action", "internal", {}, any>;
      updateMany: FunctionReference<
        "mutation",
        "internal",
        {
          input: { model: string; update: any; where?: Array<any> };
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        any
      >;
      updateOne: FunctionReference<
        "mutation",
        "internal",
        { input: { model: string; update: any; where?: Array<any> } },
        any
      >;
    };
    server: {
      aggregateBackfill: FunctionReference<"mutation", "internal", any, any>;
      aggregateBackfillChunk: FunctionReference<
        "mutation",
        "internal",
        any,
        any
      >;
      aggregateBackfillStatus: FunctionReference<
        "mutation",
        "internal",
        any,
        any
      >;
      migrationCancel: FunctionReference<"mutation", "internal", any, any>;
      migrationRun: FunctionReference<"mutation", "internal", any, any>;
      migrationRunChunk: FunctionReference<"mutation", "internal", any, any>;
      migrationStatus: FunctionReference<"mutation", "internal", any, any>;
      reset: FunctionReference<"action", "internal", any, any>;
      resetChunk: FunctionReference<
        "mutation",
        "internal",
        { cursor: string | null; tableName: string },
        any
      >;
      scheduledDelete: FunctionReference<"mutation", "internal", any, any>;
      scheduledMutationBatch: FunctionReference<
        "mutation",
        "internal",
        any,
        any
      >;
    };
  };
  github: {
    completeInstallationCallback: FunctionReference<
      "mutation",
      "internal",
      {
        installation: {
          account: { id: number; login: string; type: string } | null;
          events: Array<string>;
          id: number;
          permissions: Record<string, string>;
          repository_selection: string;
        };
        setupAction?: string;
        state: string;
      },
      any
    >;
    completeUserInstallationsCallback: FunctionReference<
      "mutation",
      "internal",
      {
        deletedInstallationIds?: Array<number>;
        installations: Array<{
          account: { id: number; login: string; type: string } | null;
          events: Array<string>;
          id: number;
          permissions: Record<string, string>;
          repository_selection: string;
        }>;
        state: string;
      },
      any
    >;
    getInstallationForExternal: FunctionReference<
      "query",
      "internal",
      { installationId: number; orgSlug: string; userId: string },
      any
    >;
    getRefreshInstallationsForCallback: FunctionReference<
      "query",
      "internal",
      { state: string },
      any
    >;
    processWebhookEvent: FunctionReference<
      "mutation",
      "internal",
      {
        action?: string;
        deliveryId: string;
        event: string;
        installation?: {
          events?: Array<string>;
          id: number;
          permissions?: Record<string, string>;
          repository_selection?: string;
        };
        issue?: {
          nodeId: string;
          number: number;
          repositoryId: number;
          state: string;
          title: string;
          url: string;
        };
      },
      any
    >;
    saveRepositoryConnection: FunctionReference<
      "mutation",
      "internal",
      {
        enabledSources: Array<"issues" | "discussions">;
        installationId: number;
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
        userId: string;
        verificationSummary: {
          discussions: { enabled: boolean; ok: boolean };
          issues: { ok: boolean };
        };
      },
      any
    >;
  };
  org: {
    onAvatarMetadataSynced: FunctionReference<
      "mutation",
      "internal",
      { bucket: string; isNew: boolean; key: string },
      any
    >;
  };
  profile: {
    onAvatarMetadataSynced: FunctionReference<
      "mutation",
      "internal",
      { bucket: string; isNew: boolean; key: string },
      any
    >;
  };
  project: {
    prepareGithubUrlImport: FunctionReference<
      "query",
      "internal",
      { id: string; userId: string },
      any
    >;
    purgeProject: FunctionReference<
      "mutation",
      "internal",
      { projectId: Id<"project"> },
      any
    >;
  };
  update: {
    onCoverImageMetadataSynced: FunctionReference<
      "mutation",
      "internal",
      { bucket: string; isNew: boolean; key: string },
      any
    >;
  };
};

export declare const components: {
  r2: import("@convex-dev/r2/_generated/component.js").ComponentApi<"r2">;
};
