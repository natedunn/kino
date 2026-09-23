/* eslint-disable */
/**
 * Generated data model types.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  DocumentByName,
  TableNamesInDataModel,
  SystemTableNames,
  AnyDataModel,
} from "convex/server";
import type { GenericId } from "convex/values";

/**
 * A type describing your Convex data model.
 *
 * This type includes information about what tables you have, the type of
 * documents stored in those tables, and the indexes defined on them.
 *
 * This type is used to parameterize methods like `queryGeneric` and
 * `mutationGeneric` to make them type-safe.
 */

export type DataModel = {
  authChallenges: {
    document: {
      expiresAt: number;
      hash: string;
      purpose: "verify" | "reset";
      userId: Id<"users">;
      _id: Id<"authChallenges">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "expiresAt"
      | "hash"
      | "purpose"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_expiresAt: ["expiresAt", "_creationTime"];
      by_hash: ["hash", "_creationTime"];
      by_userId_and_purpose: ["userId", "purpose", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  feedback: {
    document: {
      answerCommentId?: Id<"feedbackComments">;
      assignedProfileId?: Id<"profiles">;
      authorProfileId: Id<"profiles">;
      boardId: Id<"feedbackBoards">;
      deletingAt?: number;
      firstCommentId?: Id<"feedbackComments">;
      priority: "none" | "low" | "medium" | "high" | "urgent";
      projectId: Id<"projects">;
      searchContent: string;
      slug: string;
      status: "open" | "in-progress" | "closed" | "completed" | "paused";
      tags: Array<string>;
      target?: string;
      targetGranularity?: "day" | "month" | "quarter" | "year";
      title: string;
      updatedAt: number;
      upvotes: number;
      _id: Id<"feedback">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "answerCommentId"
      | "assignedProfileId"
      | "authorProfileId"
      | "boardId"
      | "deletingAt"
      | "firstCommentId"
      | "priority"
      | "projectId"
      | "searchContent"
      | "slug"
      | "status"
      | "tags"
      | "target"
      | "targetGranularity"
      | "title"
      | "updatedAt"
      | "upvotes";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_answerCommentId: ["answerCommentId", "_creationTime"];
      by_boardId: ["boardId", "_creationTime"];
      by_firstCommentId: ["firstCommentId", "_creationTime"];
      by_projectId: ["projectId", "_creationTime"];
      by_projectId_and_boardId: ["projectId", "boardId", "_creationTime"];
      by_projectId_and_boardId_and_status: [
        "projectId",
        "boardId",
        "status",
        "_creationTime",
      ];
      by_projectId_and_slug: ["projectId", "slug", "_creationTime"];
      by_projectId_and_status: ["projectId", "status", "_creationTime"];
    };
    searchIndexes: {
      search_by_searchContent: {
        searchField: "searchContent";
        filterFields: "boardId" | "projectId" | "status";
      };
    };
    vectorIndexes: {};
  };
  feedbackBoards: {
    document: {
      deletingAt?: number;
      description?: string;
      icon?: string;
      name: string;
      projectId: Id<"projects">;
      slug: string;
      updatedAt?: number;
      _id: Id<"feedbackBoards">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "deletingAt"
      | "description"
      | "icon"
      | "name"
      | "projectId"
      | "slug"
      | "updatedAt";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_deletingAt: ["deletingAt", "_creationTime"];
      by_projectId: ["projectId", "_creationTime"];
      by_projectId_and_slug: ["projectId", "slug", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  feedbackCommentEmotes: {
    document: {
      authorProfileId: Id<"profiles">;
      content: string;
      feedbackCommentId: Id<"feedbackComments">;
      feedbackId: Id<"feedback">;
      updatedAt: number;
      _id: Id<"feedbackCommentEmotes">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "authorProfileId"
      | "content"
      | "feedbackCommentId"
      | "feedbackId"
      | "updatedAt";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_feedbackCommentId: ["feedbackCommentId", "_creationTime"];
      by_feedbackCommentId_and_authorProfileId_and_content: [
        "feedbackCommentId",
        "authorProfileId",
        "content",
        "_creationTime",
      ];
      by_feedbackId: ["feedbackId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  feedbackComments: {
    document: {
      authorProfileId: Id<"profiles">;
      content: string;
      feedbackId: Id<"feedback">;
      initial: boolean;
      replyFeedbackCommentId?: Id<"feedbackComments">;
      updatedAt?: number;
      _id: Id<"feedbackComments">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "authorProfileId"
      | "content"
      | "feedbackId"
      | "initial"
      | "replyFeedbackCommentId"
      | "updatedAt";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_authorProfileId: ["authorProfileId", "_creationTime"];
      by_feedbackId: ["feedbackId", "_creationTime"];
      by_replyFeedbackCommentId: ["replyFeedbackCommentId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  feedbackDeletionJobs: {
    document: {
      feedbackId: Id<"feedback">;
      requestedByProfileId: Id<"profiles">;
      startedAt: number;
      _id: Id<"feedbackDeletionJobs">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "feedbackId"
      | "requestedByProfileId"
      | "startedAt";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_feedbackId: ["feedbackId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  feedbackEvents: {
    document: {
      actorProfileId: Id<"profiles">;
      eventType:
        | "status_changed"
        | "priority_changed"
        | "title_changed"
        | "board_changed"
        | "answer_marked"
        | "answer_unmarked"
        | "assigned"
        | "unassigned";
      feedbackId: Id<"feedback">;
      metadata?: {
        newValue?: string;
        oldValue?: string;
        targetProfileId?: Id<"profiles">;
      };
      _id: Id<"feedbackEvents">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "actorProfileId"
      | "eventType"
      | "feedbackId"
      | "metadata"
      | "metadata.newValue"
      | "metadata.oldValue"
      | "metadata.targetProfileId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_feedbackId: ["feedbackId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  feedbackRelations: {
    document: {
      createdByProfileId: Id<"profiles">;
      feedbackId: Id<"feedback">;
      projectId: Id<"projects">;
      relatedFeedbackId: Id<"feedback">;
      _id: Id<"feedbackRelations">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "createdByProfileId"
      | "feedbackId"
      | "projectId"
      | "relatedFeedbackId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_feedbackId: ["feedbackId", "_creationTime"];
      by_feedbackId_and_relatedFeedbackId: [
        "feedbackId",
        "relatedFeedbackId",
        "_creationTime",
      ];
      by_relatedFeedbackId: ["relatedFeedbackId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  feedbackTimelineEntries: {
    document: {
      commentId?: Id<"feedbackComments">;
      eventId?: Id<"feedbackEvents">;
      feedbackId: Id<"feedback">;
      kind: "comment" | "event";
      _id: Id<"feedbackTimelineEntries">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "commentId"
      | "eventId"
      | "feedbackId"
      | "kind";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_commentId: ["commentId", "_creationTime"];
      by_eventId: ["eventId", "_creationTime"];
      by_feedbackId: ["feedbackId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  feedbackUpvotes: {
    document: {
      authorProfileId: Id<"profiles">;
      feedbackId: Id<"feedback">;
      _id: Id<"feedbackUpvotes">;
      _creationTime: number;
    };
    fieldPaths: "_creationTime" | "_id" | "authorProfileId" | "feedbackId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_feedbackId_and_authorProfileId: [
        "feedbackId",
        "authorProfileId",
        "_creationTime",
      ];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  feedbackWatchers: {
    document: {
      feedbackId: Id<"feedback">;
      profileId: Id<"profiles">;
      _id: Id<"feedbackWatchers">;
      _creationTime: number;
    };
    fieldPaths: "_creationTime" | "_id" | "feedbackId" | "profileId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_feedbackId_and_profileId: ["feedbackId", "profileId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  fileAssets: {
    document: {
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
      _id: Id<"fileAssets">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "access"
      | "category"
      | "coverUpdateId"
      | "extension"
      | "extractedText"
      | "folderId"
      | "listing"
      | "name"
      | "normalizedName"
      | "objectId"
      | "origin"
      | "projectId"
      | "publicId"
      | "searchContent"
      | "state"
      | "updatedAt"
      | "uploaderClass"
      | "uploaderId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_coverUpdateId: ["coverUpdateId", "_creationTime"];
      by_projectId_and_listing_and_access_and_state: [
        "projectId",
        "listing",
        "access",
        "state",
        "_creationTime",
      ];
      by_projectId_and_listing_and_access_and_state_and_category: [
        "projectId",
        "listing",
        "access",
        "state",
        "category",
        "_creationTime",
      ];
      by_projectId_and_listing_and_access_and_state_and_extension: [
        "projectId",
        "listing",
        "access",
        "state",
        "extension",
        "_creationTime",
      ];
      by_projectId_and_listing_and_access_and_state_and_folderId: [
        "projectId",
        "listing",
        "access",
        "state",
        "folderId",
        "_creationTime",
      ];
      by_projectId_and_listing_and_access_and_state_and_normalizedName: [
        "projectId",
        "listing",
        "access",
        "state",
        "normalizedName",
        "_creationTime",
      ];
      by_projectId_and_listing_and_access_and_state_and_updatedAt: [
        "projectId",
        "listing",
        "access",
        "state",
        "updatedAt",
        "_creationTime",
      ];
      by_projectId_and_state_and_category: [
        "projectId",
        "state",
        "category",
        "_creationTime",
      ];
      by_projectId_and_state_and_folderId: [
        "projectId",
        "state",
        "folderId",
        "_creationTime",
      ];
      by_publicId: ["publicId", "_creationTime"];
    };
    searchIndexes: {
      search_by_searchContent: {
        searchField: "searchContent";
        filterFields:
          | "access"
          | "category"
          | "extension"
          | "folderId"
          | "listing"
          | "projectId"
          | "state";
      };
    };
    vectorIndexes: {};
  };
  fileFolders: {
    document: {
      name: string;
      normalizedName: string;
      parentId?: Id<"fileFolders">;
      projectId: Id<"projects">;
      systemKey?: "uploads" | "updates";
      updatedAt: number;
      _id: Id<"fileFolders">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "name"
      | "normalizedName"
      | "parentId"
      | "projectId"
      | "systemKey"
      | "updatedAt";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_projectId_and_parentId_and_normalizedName: [
        "projectId",
        "parentId",
        "normalizedName",
        "_creationTime",
      ];
      by_projectId_and_systemKey: ["projectId", "systemKey", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  fileObjects: {
    document: {
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
      _id: Id<"fileObjects">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "accounting"
      | "actualBytes"
      | "assetId"
      | "declaredBytes"
      | "expiresAt"
      | "key"
      | "maxBytes"
      | "mimeType"
      | "processingAttempt"
      | "processingUntil"
      | "projectId"
      | "settleAfter"
      | "stagingKey"
      | "state"
      | "thumbnailBytes"
      | "thumbnailKey";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_assetId: ["assetId", "_creationTime"];
      by_projectId_and_state: ["projectId", "state", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  fileReferences: {
    document: {
      assetId: Id<"fileAssets">;
      projectId: Id<"projects">;
      updateId: Id<"updates">;
      _id: Id<"fileReferences">;
      _creationTime: number;
    };
    fieldPaths: "_creationTime" | "_id" | "assetId" | "projectId" | "updateId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_assetId: ["assetId", "_creationTime"];
      by_updateId: ["updateId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  imageUploadReconciliation: {
    document: {
      checkedThrough: number;
      key: "root-storage";
      _id: Id<"imageUploadReconciliation">;
      _creationTime: number;
    };
    fieldPaths: "_creationTime" | "_id" | "checkedThrough" | "key";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_key: ["key", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  invitations: {
    document: {
      acceptedBy?: Id<"users">;
      deliveryStatus?: "accepted" | "failed";
      email: string;
      expiresAt: number;
      inviterId: Id<"users">;
      membershipId?: Id<"memberships">;
      organizationId: Id<"organizations">;
      projectIds: Array<Id<"projects">>;
      role: "admin" | "moderator";
      status: "pending" | "accepted" | "cancelled" | "rejected" | "expired";
      _id: Id<"invitations">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "acceptedBy"
      | "deliveryStatus"
      | "email"
      | "expiresAt"
      | "inviterId"
      | "membershipId"
      | "organizationId"
      | "projectIds"
      | "role"
      | "status";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_organizationId: ["organizationId", "_creationTime"];
      by_organizationId_and_email_and_status: [
        "organizationId",
        "email",
        "status",
        "_creationTime",
      ];
      by_organizationId_and_status: [
        "organizationId",
        "status",
        "_creationTime",
      ];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  maintenanceJobs: {
    document: {
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
      _id: Id<"maintenanceJobs">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "changed"
      | "checked"
      | "childCursor"
      | "completedAt"
      | "countA"
      | "countB"
      | "createdAt"
      | "dryRun"
      | "entityCursor"
      | "entityId"
      | "error"
      | "kind"
      | "phase"
      | "requestedByUserId"
      | "status"
      | "updatedAt";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_kind_and_status: ["kind", "status", "_creationTime"];
      by_status: ["status", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  memberships: {
    document: {
      organizationId: Id<"organizations">;
      role: "owner" | "admin" | "moderator";
      userId: Id<"users">;
      _id: Id<"memberships">;
      _creationTime: number;
    };
    fieldPaths: "_creationTime" | "_id" | "organizationId" | "role" | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_organizationId_and_role: ["organizationId", "role", "_creationTime"];
      by_organizationId_and_userId: [
        "organizationId",
        "userId",
        "_creationTime",
      ];
      by_userId: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  operationalAlerts: {
    document: {
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
      _id: Id<"operationalAlerts">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "attempt"
      | "deliveryStatus"
      | "firstSeenAt"
      | "jobId"
      | "key"
      | "kind"
      | "lastAttemptAt"
      | "lastSeenAt"
      | "lastSentAt"
      | "resolvedAt"
      | "scheduledAt"
      | "state"
      | "suppressedUntil"
      | "targetId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_key: ["key", "_creationTime"];
      by_resolvedAt: ["resolvedAt", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  organizationLogoUploadIntents: {
    document: {
      createdAt: number;
      expiresAt: number;
      organizationId: Id<"organizations">;
      requestedByUserId: Id<"users">;
      storageId?: Id<"_storage">;
      token: string;
      _id: Id<"organizationLogoUploadIntents">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "createdAt"
      | "expiresAt"
      | "organizationId"
      | "requestedByUserId"
      | "storageId"
      | "token";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_expiresAt: ["expiresAt", "_creationTime"];
      by_organizationId: ["organizationId", "_creationTime"];
      by_storageId: ["storageId", "_creationTime"];
      by_token: ["token", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  organizations: {
    document: {
      logoStorageId?: Id<"_storage">;
      name: string;
      personalOwnerId?: Id<"users">;
      slug: string;
      visibility: "public" | "private";
      _id: Id<"organizations">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "logoStorageId"
      | "name"
      | "personalOwnerId"
      | "slug"
      | "visibility";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_logoStorageId: ["logoStorageId", "_creationTime"];
      by_personalOwnerId: ["personalOwnerId", "_creationTime"];
      by_slug: ["slug", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  profileAvatarUploadIntents: {
    document: {
      createdAt: number;
      expiresAt: number;
      profileId: Id<"profiles">;
      requestedByUserId: Id<"users">;
      storageId?: Id<"_storage">;
      token: string;
      _id: Id<"profileAvatarUploadIntents">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "createdAt"
      | "expiresAt"
      | "profileId"
      | "requestedByUserId"
      | "storageId"
      | "token";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_expiresAt: ["expiresAt", "_creationTime"];
      by_profileId: ["profileId", "_creationTime"];
      by_storageId: ["storageId", "_creationTime"];
      by_token: ["token", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  profiles: {
    document: {
      avatarStorageId?: Id<"_storage">;
      bio?: string;
      imageUrl?: string;
      locale?: "en-US" | "es-419" | "zh-Hans";
      location?: string;
      name: string;
      urls?: Array<{ text: string; url: string }>;
      userId: Id<"users">;
      username: string;
      _id: Id<"profiles">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "avatarStorageId"
      | "bio"
      | "imageUrl"
      | "locale"
      | "location"
      | "name"
      | "urls"
      | "userId"
      | "username";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_avatarStorageId: ["avatarStorageId", "_creationTime"];
      by_userId: ["userId", "_creationTime"];
      by_username: ["username", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  projectDeletionJobs: {
    document: {
      invitationsCursor?: string;
      invitationsDone: boolean;
      projectId: Id<"projects">;
      _id: Id<"projectDeletionJobs">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "invitationsCursor"
      | "invitationsDone"
      | "projectId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_projectId: ["projectId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  projectMembers: {
    document: {
      projectId: Id<"projects">;
      userId: Id<"users">;
      _id: Id<"projectMembers">;
      _creationTime: number;
    };
    fieldPaths: "_creationTime" | "_id" | "projectId" | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_projectId_and_userId: ["projectId", "userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  projectModeratorAssignments: {
    document: {
      membershipId: Id<"memberships">;
      projectId: Id<"projects">;
      _id: Id<"projectModeratorAssignments">;
      _creationTime: number;
    };
    fieldPaths: "_creationTime" | "_id" | "membershipId" | "projectId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_membershipId_and_projectId: [
        "membershipId",
        "projectId",
        "_creationTime",
      ];
      by_projectId: ["projectId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  projects: {
    document: {
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
      _id: Id<"projects">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "deletingAt"
      | "description"
      | "name"
      | "organizationId"
      | "slug"
      | "storageDeletingAt"
      | "updatesFeaturedMode"
      | "urls"
      | "visibility";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_organizationId: ["organizationId", "_creationTime"];
      by_organizationId_and_slug: ["organizationId", "slug", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  projectThemes: {
    document: {
      projectId: Id<"projects">;
      publishedByProfileId?: Id<"profiles">;
      publishedDark: {
        background: string;
        foreground: string;
        primary: string;
        primaryForeground: string;
        surface: string;
        surfaceForeground: string;
      };
      publishedLight: {
        background: string;
        foreground: string;
        primary: string;
        primaryForeground: string;
        surface: string;
        surfaceForeground: string;
      };
      publishedPresetId:
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
      publishedRevision: number;
      publishedTime: number;
      version: number;
      _id: Id<"projectThemes">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "projectId"
      | "publishedByProfileId"
      | "publishedDark"
      | "publishedDark.background"
      | "publishedDark.foreground"
      | "publishedDark.primary"
      | "publishedDark.primaryForeground"
      | "publishedDark.surface"
      | "publishedDark.surfaceForeground"
      | "publishedLight"
      | "publishedLight.background"
      | "publishedLight.foreground"
      | "publishedLight.primary"
      | "publishedLight.primaryForeground"
      | "publishedLight.surface"
      | "publishedLight.surfaceForeground"
      | "publishedPresetId"
      | "publishedRevision"
      | "publishedTime"
      | "version";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_projectId: ["projectId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  relayConnections: {
    document: {
      connectedByProfileId: Id<"profiles">;
      deletedTime?: number;
      enabledSources: Array<"issues" | "discussions">;
      githubInstallationId: Id<"relayInstallations">;
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
      _id: Id<"relayConnections">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "connectedByProfileId"
      | "deletedTime"
      | "enabledSources"
      | "githubInstallationId"
      | "mode"
      | "orgId"
      | "orgSlug"
      | "projectId"
      | "projectSlug"
      | "repoFullName"
      | "repoId"
      | "repoName"
      | "repoNodeId"
      | "repoOwner"
      | "repoPrivate"
      | "updatedTime"
      | "verificationStatus"
      | "verificationSummary"
      | "verificationSummary.discussions"
      | "verificationSummary.discussions.enabled"
      | "verificationSummary.discussions.ok"
      | "verificationSummary.issues"
      | "verificationSummary.issues.ok";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_githubInstallationId: ["githubInstallationId", "_creationTime"];
      by_orgId_and_deletedTime: ["orgId", "deletedTime", "_creationTime"];
      by_orgId_and_repoId: ["orgId", "repoId", "_creationTime"];
      by_projectId_and_deletedTime: [
        "projectId",
        "deletedTime",
        "_creationTime",
      ];
      by_repoId: ["repoId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  relayDeliveries: {
    document: {
      deliveryId: string;
      event: string;
      receivedAt: number;
      result: "processed" | "ignored";
      _id: Id<"relayDeliveries">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "deliveryId"
      | "event"
      | "receivedAt"
      | "result";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_deliveryId: ["deliveryId", "_creationTime"];
      by_receivedAt: ["receivedAt", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  relayInstallations: {
    document: {
      accountId: number;
      accountLogin: string;
      accountType: string;
      connectedByProfileId: Id<"profiles">;
      events: Array<string>;
      installationId: number;
      orgId: Id<"organizations">;
      orgSlug: string;
      permissions: Record<string, string>;
      repositorySelection: string;
      status: "active" | "stale" | "deleted" | "suspended";
      updatedTime: number;
      _id: Id<"relayInstallations">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "accountId"
      | "accountLogin"
      | "accountType"
      | "connectedByProfileId"
      | "events"
      | "installationId"
      | "orgId"
      | "orgSlug"
      | "permissions"
      | `permissions.${string}`
      | "repositorySelection"
      | "status"
      | "updatedTime";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_installationId: ["installationId", "_creationTime"];
      by_orgId: ["orgId", "_creationTime"];
      by_orgId_and_installationId: ["orgId", "installationId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  relayIssues: {
    document: {
      connectedByProfileId: Id<"profiles">;
      feedbackId: Id<"feedback">;
      githubDatabaseId: number;
      githubNodeId: string;
      githubNumber: number;
      githubRepositoryConnectionId: Id<"relayConnections">;
      kind: "issue";
      projectId: Id<"projects">;
      state: string;
      title: string;
      updatedTime: number;
      url: string;
      _id: Id<"relayIssues">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "connectedByProfileId"
      | "feedbackId"
      | "githubDatabaseId"
      | "githubNodeId"
      | "githubNumber"
      | "githubRepositoryConnectionId"
      | "kind"
      | "projectId"
      | "state"
      | "title"
      | "updatedTime"
      | "url";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_feedbackId: ["feedbackId", "_creationTime"];
      by_feedbackId_and_githubNodeId: [
        "feedbackId",
        "githubNodeId",
        "_creationTime",
      ];
      by_githubRepositoryConnectionId_and_githubNodeId: [
        "githubRepositoryConnectionId",
        "githubNodeId",
        "_creationTime",
      ];
      by_projectId: ["projectId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  relayStates: {
    document: {
      consumedAt?: number;
      createdByUserId: Id<"users">;
      expiresAt: number;
      hash: string;
      mode: "read" | "read_write";
      orgId: Id<"organizations">;
      orgSlug: string;
      projectId?: Id<"projects">;
      projectSlug?: string;
      _id: Id<"relayStates">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "consumedAt"
      | "createdByUserId"
      | "expiresAt"
      | "hash"
      | "mode"
      | "orgId"
      | "orgSlug"
      | "projectId"
      | "projectSlug";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_expiresAt: ["expiresAt", "_creationTime"];
      by_hash: ["hash", "_creationTime"];
      by_projectId: ["projectId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  storageCleanupJobs: {
    document: {
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
      _id: Id<"storageCleanupJobs">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "attempt"
      | "finishedAt"
      | "lastError"
      | "leaseUntil"
      | "maxAttempt"
      | "notBefore"
      | "objectId"
      | "projectId"
      | "stagingOnly"
      | "state";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_objectId_and_stagingOnly: ["objectId", "stagingOnly", "_creationTime"];
      by_projectId_and_state: ["projectId", "state", "_creationTime"];
      by_state: ["state", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  storageProjectPurges: {
    document: {
      done: boolean;
      projectId: Id<"projects">;
      _id: Id<"storageProjectPurges">;
      _creationTime: number;
    };
    fieldPaths: "_creationTime" | "_id" | "done" | "projectId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_done: ["done", "_creationTime"];
      by_projectId: ["projectId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  storageUsage: {
    document: {
      byCategory: Record<string, { bytes: number; files: number }>;
      byOrigin: Record<string, { bytes: number; files: number }>;
      byUploaderClass: Record<string, { bytes: number; files: number }>;
      fileCount: number;
      organizationId: Id<"organizations">;
      projectId: Id<"projects">;
      reservedBytes: number;
      usedBytes: number;
      _id: Id<"storageUsage">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "byCategory"
      | `byCategory.${string}`
      | "byOrigin"
      | `byOrigin.${string}`
      | "byUploaderClass"
      | `byUploaderClass.${string}`
      | "fileCount"
      | "organizationId"
      | "projectId"
      | "reservedBytes"
      | "usedBytes";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_organizationId: ["organizationId", "_creationTime"];
      by_projectId: ["projectId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  updateCommentEmotes: {
    document: {
      authorProfileId: Id<"profiles">;
      commentId: Id<"updateComments">;
      content: string;
      updateId: Id<"updates">;
      _id: Id<"updateCommentEmotes">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "authorProfileId"
      | "commentId"
      | "content"
      | "updateId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_commentId_and_authorProfileId_and_content: [
        "commentId",
        "authorProfileId",
        "content",
        "_creationTime",
      ];
      by_updateId: ["updateId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  updateComments: {
    document: {
      authorProfileId: Id<"profiles">;
      content: string;
      emoteCounts: Record<string, number>;
      replyCommentId?: Id<"updateComments">;
      updateId: Id<"updates">;
      updatedAt?: number;
      _id: Id<"updateComments">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "authorProfileId"
      | "content"
      | "emoteCounts"
      | `emoteCounts.${string}`
      | "replyCommentId"
      | "updatedAt"
      | "updateId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_authorProfileId: ["authorProfileId", "_creationTime"];
      by_replyCommentId: ["replyCommentId", "_creationTime"];
      by_updateId: ["updateId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  updateDeletionJobs: {
    document: {
      updateId: Id<"updates">;
      _id: Id<"updateDeletionJobs">;
      _creationTime: number;
    };
    fieldPaths: "_creationTime" | "_id" | "updateId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_updateId: ["updateId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  updateEmotes: {
    document: {
      authorProfileId: Id<"profiles">;
      content: string;
      updateId: Id<"updates">;
      _id: Id<"updateEmotes">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "authorProfileId"
      | "content"
      | "updateId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_updateId_and_authorProfileId_and_content: [
        "updateId",
        "authorProfileId",
        "content",
        "_creationTime",
      ];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  updates: {
    document: {
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
      _id: Id<"updates">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "authorProfileId"
      | "category"
      | "commentCount"
      | "content"
      | "coverAssetId"
      | "deletingAt"
      | "featuredAt"
      | "heartCount"
      | "projectId"
      | "publishedAt"
      | "relatedFeedbackIds"
      | "searchContent"
      | "slug"
      | "status"
      | "tags"
      | "title"
      | "updatedAt";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_projectId_and_category_and_status_and_publishedAt: [
        "projectId",
        "category",
        "status",
        "publishedAt",
        "_creationTime",
      ];
      by_projectId_and_slug: ["projectId", "slug", "_creationTime"];
      by_projectId_and_status_and_featuredAt: [
        "projectId",
        "status",
        "featuredAt",
        "_creationTime",
      ];
      by_projectId_and_status_and_publishedAt: [
        "projectId",
        "status",
        "publishedAt",
        "_creationTime",
      ];
      by_projectId_and_updatedAt: ["projectId", "updatedAt", "_creationTime"];
    };
    searchIndexes: {
      search_by_searchContent: {
        searchField: "searchContent";
        filterFields: "category" | "projectId" | "status";
      };
    };
    vectorIndexes: {};
  };
  users: {
    document: {
      githubAccountId?: string;
      githubEmail?: string;
      githubEmailVerifiedAt?: number;
      passwordEmail?: string;
      passwordEmailVerifiedAt?: number;
      personalOrganizationId?: Id<"organizations">;
      profileId?: Id<"profiles">;
      registrationLocale?: "en-US" | "es-419" | "zh-Hans";
      registrationName?: string;
      status: "pendingVerification" | "active" | "disabled";
      systemRole: "user" | "system:admin";
      _id: Id<"users">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "githubAccountId"
      | "githubEmail"
      | "githubEmailVerifiedAt"
      | "passwordEmail"
      | "passwordEmailVerifiedAt"
      | "personalOrganizationId"
      | "profileId"
      | "registrationLocale"
      | "registrationName"
      | "status"
      | "systemRole";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_githubEmail: ["githubEmail", "_creationTime"];
      by_passwordEmail: ["passwordEmail", "_creationTime"];
      by_status: ["status", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
};

/**
 * The names of all of your Convex tables.
 */
export type TableNames = TableNamesInDataModel<DataModel>;

/**
 * The type of a document stored in Convex.
 *
 * @typeParam TableName - A string literal type of the table name (like "users").
 */
export type Doc<TableName extends TableNames> = DocumentByName<
  DataModel,
  TableName
>;

/**
 * An identifier for a document in Convex.
 *
 * Convex documents are uniquely identified by their `Id`, which is accessible
 * on the `_id` field. To learn more, see [Document IDs](https://docs.convex.dev/using/document-ids).
 *
 * Documents can be loaded using `db.get(tableName, id)` in query and mutation functions.
 *
 * IDs are just strings at runtime, but this type can be used to distinguish them from other
 * strings when type checking.
 *
 * @typeParam TableName - A string literal type of the table name (like "users").
 */
export type Id<TableName extends TableNames | SystemTableNames> =
  GenericId<TableName>;
