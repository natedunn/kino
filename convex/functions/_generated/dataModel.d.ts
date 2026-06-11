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
  account: {
    document: {
      accessToken?: null | string;
      accessTokenExpiresAt?: null | number;
      accountId: string;
      createdAt: number;
      idToken?: null | string;
      password?: null | string;
      providerId: string;
      refreshToken?: null | string;
      refreshTokenExpiresAt?: null | number;
      scope?: null | string;
      updatedAt: number;
      userId: string;
      _id: Id<"account">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "accessToken"
      | "accessTokenExpiresAt"
      | "accountId"
      | "createdAt"
      | "idToken"
      | "password"
      | "providerId"
      | "refreshToken"
      | "refreshTokenExpiresAt"
      | "scope"
      | "updatedAt"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      accountId: ["accountId", "_creationTime"];
      accountId_providerId: ["accountId", "providerId", "_creationTime"];
      providerId_userId: ["providerId", "userId", "_creationTime"];
      userId: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  aggregate_bucket: {
    document: {
      count: number;
      indexName: string;
      keyHash: string;
      keyParts: Array<null | any>;
      nonNullCountValues: Record<string, number>;
      sumValues: Record<string, number>;
      tableKey: string;
      updatedAt: number;
      _id: Id<"aggregate_bucket">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "count"
      | "indexName"
      | "keyHash"
      | "keyParts"
      | "nonNullCountValues"
      | `nonNullCountValues.${string}`
      | "sumValues"
      | `sumValues.${string}`
      | "tableKey"
      | "updatedAt";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_table_index: ["tableKey", "indexName", "_creationTime"];
      by_table_index_hash: [
        "tableKey",
        "indexName",
        "keyHash",
        "_creationTime",
      ];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  aggregate_extrema: {
    document: {
      count: number;
      fieldName: string;
      indexName: string;
      keyHash: string;
      sortKey: string;
      tableKey: string;
      updatedAt: number;
      value: any;
      valueHash: string;
      _id: Id<"aggregate_extrema">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "count"
      | "fieldName"
      | "indexName"
      | "keyHash"
      | "sortKey"
      | "tableKey"
      | "updatedAt"
      | "value"
      | "valueHash";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_table_index: ["tableKey", "indexName", "_creationTime"];
      by_table_index_hash_field_sort: [
        "tableKey",
        "indexName",
        "keyHash",
        "fieldName",
        "sortKey",
        "_creationTime",
      ];
      by_table_index_hash_field_value: [
        "tableKey",
        "indexName",
        "keyHash",
        "fieldName",
        "valueHash",
        "_creationTime",
      ];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  aggregate_member: {
    document: {
      docId: string;
      extremaValues: Record<string, null | any>;
      indexName: string;
      keyHash: string;
      keyParts: Array<null | any>;
      kind: string;
      nonNullCountValues: Record<string, number>;
      rankKey?: null | any;
      rankNamespace?: null | any;
      rankSumValue?: null | number;
      sumValues: Record<string, number>;
      tableKey: string;
      updatedAt: number;
      _id: Id<"aggregate_member">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "docId"
      | "extremaValues"
      | `extremaValues.${string}`
      | "indexName"
      | "keyHash"
      | "keyParts"
      | "kind"
      | "nonNullCountValues"
      | `nonNullCountValues.${string}`
      | "rankKey"
      | "rankNamespace"
      | "rankSumValue"
      | "sumValues"
      | `sumValues.${string}`
      | "tableKey"
      | "updatedAt";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_kind_table_index: ["kind", "tableKey", "indexName", "_creationTime"];
      by_kind_table_index_doc: [
        "kind",
        "tableKey",
        "indexName",
        "docId",
        "_creationTime",
      ];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  aggregate_rank_node: {
    document: {
      aggregate?: null | { count: number; sum: number };
      items: Array<{ k: null | any; s: number; v: null | any }>;
      subtrees: Array<string>;
      _id: Id<"aggregate_rank_node">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "aggregate"
      | "aggregate.count"
      | "aggregate.sum"
      | "items"
      | "subtrees";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  aggregate_rank_tree: {
    document: {
      aggregateName: string;
      maxNodeSize: number;
      namespace?: null | any;
      root: Id<"aggregate_rank_node">;
      _id: Id<"aggregate_rank_tree">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "aggregateName"
      | "maxNodeSize"
      | "namespace"
      | "root";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_aggregate_name: ["aggregateName", "_creationTime"];
      by_namespace: ["namespace", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  aggregate_state: {
    document: {
      completedAt?: null | number;
      cursor?: null | string;
      indexName: string;
      keyDefinitionHash: string;
      kind: string;
      lastError?: null | string;
      metricDefinitionHash: string;
      processed: number;
      startedAt: number;
      status: string;
      tableKey: string;
      updatedAt: number;
      _id: Id<"aggregate_state">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "completedAt"
      | "cursor"
      | "indexName"
      | "keyDefinitionHash"
      | "kind"
      | "lastError"
      | "metricDefinitionHash"
      | "processed"
      | "startedAt"
      | "status"
      | "tableKey"
      | "updatedAt";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_kind_status: ["kind", "status", "_creationTime"];
      by_kind_table_index: ["kind", "tableKey", "indexName", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  feedback: {
    document: {
      answerCommentId?: null | Id<"feedbackComment">;
      assignedProfileId?: null | Id<"profile">;
      authorProfileId: Id<"profile">;
      boardId: Id<"feedbackBoard">;
      deletedTime?: null | number;
      firstCommentId?: null | Id<"feedbackComment">;
      projectId: Id<"project">;
      searchContent?: null | string;
      slug: string;
      status: "open" | "in-progress" | "closed" | "completed" | "paused";
      tags?: null | Array<string>;
      title: string;
      updatedTime?: null | number;
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
      | "deletedTime"
      | "firstCommentId"
      | "projectId"
      | "searchContent"
      | "slug"
      | "status"
      | "tags"
      | "title"
      | "updatedTime"
      | "upvotes";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_projectId: ["projectId", "_creationTime"];
      by_projectId_boardId: ["projectId", "boardId", "_creationTime"];
      by_projectId_boardId_status: [
        "projectId",
        "boardId",
        "status",
        "_creationTime",
      ];
      by_projectId_slug: ["projectId", "slug", "_creationTime"];
      by_projectId_status: ["projectId", "status", "_creationTime"];
      by_slug: ["slug", "_creationTime"];
    };
    searchIndexes: {
      by_projectId_boardId_status_searchContent: {
        searchField: "searchContent";
        filterFields: "boardId" | "projectId" | "status";
      };
    };
    vectorIndexes: {};
  };
  feedbackBoard: {
    document: {
      deletedTime?: null | number;
      description?: null | string;
      icon?: null | string;
      name: string;
      projectId: Id<"project">;
      slug: string;
      updatedTime?: null | number;
      _id: Id<"feedbackBoard">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "deletedTime"
      | "description"
      | "icon"
      | "name"
      | "projectId"
      | "slug"
      | "updatedTime";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_projectId: ["projectId", "_creationTime"];
      by_slug_projectId: ["slug", "projectId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  feedbackComment: {
    document: {
      authorProfileId: Id<"profile">;
      content: string;
      deletedTime?: null | number;
      feedbackId: Id<"feedback">;
      initial?: null | boolean;
      replyFeedbackCommentId?: null | Id<"feedbackComment">;
      updatedTime?: null | number;
      _id: Id<"feedbackComment">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "authorProfileId"
      | "content"
      | "deletedTime"
      | "feedbackId"
      | "initial"
      | "replyFeedbackCommentId"
      | "updatedTime";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_authorProfileId: ["authorProfileId", "_creationTime"];
      by_feedbackId: ["feedbackId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  feedbackCommentEmote: {
    document: {
      authorProfileId: Id<"profile">;
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
      deletedTime?: null | number;
      feedbackCommentId: Id<"feedbackComment">;
      feedbackId: Id<"feedback">;
      updatedTime?: null | number;
      _id: Id<"feedbackCommentEmote">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "authorProfileId"
      | "content"
      | "deletedTime"
      | "feedbackCommentId"
      | "feedbackId"
      | "updatedTime";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_authorProfileId: ["authorProfileId", "_creationTime"];
      by_feedbackCommentId: ["feedbackCommentId", "_creationTime"];
      by_feedbackId: ["feedbackId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  feedbackEvent: {
    document: {
      actorProfileId: Id<"profile">;
      deletedTime?: null | number;
      eventType:
        | "status_changed"
        | "board_changed"
        | "assigned"
        | "unassigned"
        | "title_changed"
        | "answer_marked"
        | "answer_unmarked";
      feedbackId: Id<"feedback">;
      metadata?: null | any;
      updatedTime?: null | number;
      _id: Id<"feedbackEvent">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "actorProfileId"
      | "deletedTime"
      | "eventType"
      | "feedbackId"
      | "metadata"
      | "updatedTime";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_feedbackId: ["feedbackId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  feedbackUpvote: {
    document: {
      authorProfileId: Id<"profile">;
      deletedTime?: null | number;
      feedbackId: Id<"feedback">;
      updatedTime?: null | number;
      _id: Id<"feedbackUpvote">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "authorProfileId"
      | "deletedTime"
      | "feedbackId"
      | "updatedTime";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_feedbackId: ["feedbackId", "_creationTime"];
      by_feedbackId_authorProfileId: [
        "feedbackId",
        "authorProfileId",
        "_creationTime",
      ];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  githubConnectionState: {
    document: {
      consumedAt?: null | number;
      createdByProfileId: Id<"profile">;
      createdByUserId: string;
      deletedTime?: null | number;
      expiresAt: number;
      mode: "read" | "read_write";
      orgId: string;
      orgSlug: string;
      projectId?: null | Id<"project">;
      projectSlug?: null | string;
      stateHash: string;
      status: "pending" | "consumed" | "expired";
      updatedTime?: null | number;
      _id: Id<"githubConnectionState">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "consumedAt"
      | "createdByProfileId"
      | "createdByUserId"
      | "deletedTime"
      | "expiresAt"
      | "mode"
      | "orgId"
      | "orgSlug"
      | "projectId"
      | "projectSlug"
      | "stateHash"
      | "status"
      | "updatedTime";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_expiresAt: ["expiresAt", "_creationTime"];
      by_orgId: ["orgId", "_creationTime"];
      by_projectId: ["projectId", "_creationTime"];
      by_stateHash: ["stateHash", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  githubInstallation: {
    document: {
      accountId: number;
      accountLogin: string;
      accountType: string;
      connectedByProfileId: Id<"profile">;
      deletedTime?: null | number;
      events?: null | Array<string>;
      installationId: number;
      orgId: string;
      orgSlug: string;
      permissions?: null | any;
      repositorySelection: string;
      status: "active" | "suspended" | "deleted";
      updatedTime?: null | number;
      _id: Id<"githubInstallation">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "accountId"
      | "accountLogin"
      | "accountType"
      | "connectedByProfileId"
      | "deletedTime"
      | "events"
      | "installationId"
      | "orgId"
      | "orgSlug"
      | "permissions"
      | "repositorySelection"
      | "status"
      | "updatedTime";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_installationId: ["installationId", "_creationTime"];
      by_orgId: ["orgId", "_creationTime"];
      by_orgId_installationId: ["orgId", "installationId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  githubRepositoryConnection: {
    document: {
      connectedByProfileId: Id<"profile">;
      deletedTime?: null | number;
      discussionsVerifiedAt?: null | number;
      enabledSources?: null | Array<string>;
      githubInstallationId: Id<"githubInstallation">;
      issuesVerifiedAt?: null | number;
      lastWebhookAt?: null | number;
      mode: "read" | "read_write";
      orgId: string;
      orgSlug: string;
      projectId: Id<"project">;
      projectSlug: string;
      repoFullName: string;
      repoId: number;
      repoName: string;
      repoNodeId: string;
      repoOwner: string;
      updatedTime?: null | number;
      verificationStatus: string;
      verificationSummary?: null | any;
      _id: Id<"githubRepositoryConnection">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "connectedByProfileId"
      | "deletedTime"
      | "discussionsVerifiedAt"
      | "enabledSources"
      | "githubInstallationId"
      | "issuesVerifiedAt"
      | "lastWebhookAt"
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
      | "updatedTime"
      | "verificationStatus"
      | "verificationSummary";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_githubInstallationId: ["githubInstallationId", "_creationTime"];
      by_orgId_repoId: ["orgId", "repoId", "_creationTime"];
      by_projectId: ["projectId", "_creationTime"];
      by_repoId: ["repoId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  githubWebhookDelivery: {
    document: {
      action?: null | string;
      deletedTime?: null | number;
      deliveryId: string;
      error?: null | string;
      event: string;
      githubInstallationId?: null | Id<"githubInstallation">;
      installationId?: null | number;
      payloadSummary?: null | any;
      processedAt?: null | number;
      receivedAt: number;
      repoId?: null | number;
      status: "received" | "processed" | "failed";
      updatedTime?: null | number;
      _id: Id<"githubWebhookDelivery">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "action"
      | "deletedTime"
      | "deliveryId"
      | "error"
      | "event"
      | "githubInstallationId"
      | "installationId"
      | "payloadSummary"
      | "processedAt"
      | "receivedAt"
      | "repoId"
      | "status"
      | "updatedTime";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_deliveryId: ["deliveryId", "_creationTime"];
      by_githubInstallationId: ["githubInstallationId", "_creationTime"];
      by_installationId: ["installationId", "_creationTime"];
      by_repoId: ["repoId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  invitation: {
    document: {
      createdAt: number;
      email: string;
      expiresAt: number;
      inviterId: string;
      organizationId: string;
      role?: null | string;
      status: string;
      _id: Id<"invitation">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "createdAt"
      | "email"
      | "expiresAt"
      | "inviterId"
      | "organizationId"
      | "role"
      | "status";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      email: ["email", "_creationTime"];
      inviterId: ["inviterId", "_creationTime"];
      organizationId: ["organizationId", "_creationTime"];
      role: ["role", "_creationTime"];
      status: ["status", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  jwks: {
    document: {
      createdAt: number;
      expiresAt?: null | number;
      privateKey: string;
      publicKey: string;
      _id: Id<"jwks">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "createdAt"
      | "expiresAt"
      | "privateKey"
      | "publicKey";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  member: {
    document: {
      createdAt: number;
      organizationId: string;
      role: string;
      userId: string;
      _id: Id<"member">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "createdAt"
      | "organizationId"
      | "role"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      organizationId: ["organizationId", "_creationTime"];
      role: ["role", "_creationTime"];
      userId: ["userId", "_creationTime"];
      userId_organizationId: ["userId", "organizationId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  migration_run: {
    document: {
      allowDrift: boolean;
      cancelRequested: boolean;
      completedAt?: null | number;
      currentIndex: number;
      direction: string;
      dryRun: boolean;
      lastError?: null | string;
      migrationIds: Array<string>;
      runId: string;
      startedAt: number;
      status: string;
      updatedAt: number;
      _id: Id<"migration_run">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "allowDrift"
      | "cancelRequested"
      | "completedAt"
      | "currentIndex"
      | "direction"
      | "dryRun"
      | "lastError"
      | "migrationIds"
      | "runId"
      | "startedAt"
      | "status"
      | "updatedAt";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_run_id: ["runId", "_creationTime"];
      by_status: ["status", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  migration_state: {
    document: {
      applied: boolean;
      checksum: string;
      completedAt?: null | number;
      cursor?: null | string;
      direction?: null | string;
      lastError?: null | string;
      migrationId: string;
      processed: number;
      runId?: null | string;
      startedAt?: null | number;
      status: string;
      updatedAt: number;
      writeMode: string;
      _id: Id<"migration_state">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "applied"
      | "checksum"
      | "completedAt"
      | "cursor"
      | "direction"
      | "lastError"
      | "migrationId"
      | "processed"
      | "runId"
      | "startedAt"
      | "status"
      | "updatedAt"
      | "writeMode";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_migration_id: ["migrationId", "_creationTime"];
      by_status: ["status", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  organization: {
    document: {
      createdAt: number;
      logo?: null | string;
      metadata?: null | string;
      name: string;
      slug: string;
      visibility: string;
      _id: Id<"organization">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "createdAt"
      | "logo"
      | "metadata"
      | "name"
      | "slug"
      | "visibility";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      name: ["name", "_creationTime"];
      slug: ["slug", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  orgStorageUsage: {
    document: {
      deletedTime?: null | number;
      fileCount: number;
      orgSlug: string;
      totalBytes: number;
      updatedTime?: null | number;
      _id: Id<"orgStorageUsage">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "deletedTime"
      | "fileCount"
      | "orgSlug"
      | "totalBytes"
      | "updatedTime";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_orgSlug: ["orgSlug", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  profile: {
    document: {
      bio?: null | string;
      deletedTime?: null | number;
      email: string;
      imageKey?: null | string;
      imageUrl?: null | string;
      location?: null | string;
      name: string;
      personalOrganizationId?: null | string;
      role: "system:admin" | "system:editor" | "user";
      updatedTime?: null | number;
      urls?: null | Array<{ text: string; url: string }>;
      userId: string;
      username: string;
      _id: Id<"profile">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "bio"
      | "deletedTime"
      | "email"
      | "imageKey"
      | "imageUrl"
      | "location"
      | "name"
      | "personalOrganizationId"
      | "role"
      | "updatedTime"
      | "urls"
      | "userId"
      | "username";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_userId: ["userId", "_creationTime"];
      by_username: ["username", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  project: {
    document: {
      deletedTime?: null | number;
      description?: null | string;
      logoUrl?: null | string;
      name: string;
      orgSlug: string;
      slug: string;
      updatedTime?: null | number;
      urls?: null | Array<{ text: string; url: string }>;
      visibility: "public" | "private" | "archived";
      _id: Id<"project">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "deletedTime"
      | "description"
      | "logoUrl"
      | "name"
      | "orgSlug"
      | "slug"
      | "updatedTime"
      | "urls"
      | "visibility";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_orgSlug: ["orgSlug", "_creationTime"];
      by_orgSlug_slug: ["orgSlug", "slug", "_creationTime"];
      by_orgSlug_visibility_updatedAt: [
        "orgSlug",
        "visibility",
        "updatedTime",
        "_creationTime",
      ];
      by_slug: ["slug", "_creationTime"];
      by_updatedTime: ["updatedTime", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  projectMember: {
    document: {
      deletedTime?: null | number;
      profileId: Id<"profile">;
      projectId: Id<"project">;
      projectSlug: string;
      projectVisibility: "public" | "private" | "archived";
      role: "admin" | "member" | "editor" | "org:admin" | "org:editor";
      updatedTime?: null | number;
      _id: Id<"projectMember">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "deletedTime"
      | "profileId"
      | "projectId"
      | "projectSlug"
      | "projectVisibility"
      | "role"
      | "updatedTime";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_profileId_projectId: ["profileId", "projectId", "_creationTime"];
      by_profileId_projectId_role: [
        "profileId",
        "projectId",
        "role",
        "_creationTime",
      ];
      by_profileId_projectSlug: ["profileId", "projectSlug", "_creationTime"];
      by_profileId_projectSlug_role: [
        "profileId",
        "projectSlug",
        "role",
        "_creationTime",
      ];
      by_projectId: ["projectId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  session: {
    document: {
      activeOrganizationId?: null | string;
      createdAt: number;
      expiresAt: number;
      impersonatedBy?: null | string;
      ipAddress?: null | string;
      token: string;
      updatedAt: number;
      userAgent?: null | string;
      userId: string;
      _id: Id<"session">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "activeOrganizationId"
      | "createdAt"
      | "expiresAt"
      | "impersonatedBy"
      | "ipAddress"
      | "token"
      | "updatedAt"
      | "userAgent"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      expiresAt: ["expiresAt", "_creationTime"];
      expiresAt_userId: ["expiresAt", "userId", "_creationTime"];
      session_token_unique: ["token", "_creationTime"];
      userId: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  update: {
    document: {
      authorAsOrg?: null | boolean;
      authorProfileId: Id<"profile">;
      category: "changelog" | "article" | "announcement";
      content: string;
      coverImageId?: null | string;
      deletedTime?: null | number;
      projectId: Id<"project">;
      publishedAt?: null | number;
      relatedFeedbackIds?: null | Array<Id<"feedback">>;
      slug: string;
      status: "draft" | "published";
      tags?: null | Array<string>;
      title: string;
      updatedTime: number;
      _id: Id<"update">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "authorAsOrg"
      | "authorProfileId"
      | "category"
      | "content"
      | "coverImageId"
      | "deletedTime"
      | "projectId"
      | "publishedAt"
      | "relatedFeedbackIds"
      | "slug"
      | "status"
      | "tags"
      | "title"
      | "updatedTime";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_projectId_slug: ["projectId", "slug", "_creationTime"];
      by_projectId_status_publishedAt: [
        "projectId",
        "status",
        "publishedAt",
        "_creationTime",
      ];
      by_projectId_updatedTime: ["projectId", "updatedTime", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  updateComment: {
    document: {
      authorProfileId: Id<"profile">;
      content: string;
      deletedTime?: null | number;
      updateId: Id<"update">;
      updatedTime?: null | number;
      _id: Id<"updateComment">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "authorProfileId"
      | "content"
      | "deletedTime"
      | "updatedTime"
      | "updateId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_authorProfileId: ["authorProfileId", "_creationTime"];
      by_updateId: ["updateId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  updateCommentEmote: {
    document: {
      authorProfileId: Id<"profile">;
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
      deletedTime?: null | number;
      updateCommentId: Id<"updateComment">;
      updateId: Id<"update">;
      updatedTime?: null | number;
      _id: Id<"updateCommentEmote">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "authorProfileId"
      | "content"
      | "deletedTime"
      | "updateCommentId"
      | "updatedTime"
      | "updateId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_updateCommentId: ["updateCommentId", "_creationTime"];
      by_updateId: ["updateId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  updateEmote: {
    document: {
      authorProfileId: Id<"profile">;
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
      deletedTime?: null | number;
      updateId: Id<"update">;
      updatedTime?: null | number;
      _id: Id<"updateEmote">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "authorProfileId"
      | "content"
      | "deletedTime"
      | "updatedTime"
      | "updateId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_updateId: ["updateId", "_creationTime"];
      by_updateId_authorProfileId: [
        "updateId",
        "authorProfileId",
        "_creationTime",
      ];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  user: {
    document: {
      banExpires?: null | number;
      banReason?: null | string;
      banned?: null | boolean;
      createdAt: number;
      displayUsername?: null | string;
      email: string;
      emailVerified: boolean;
      image?: null | string;
      name: string;
      profileId?: null | string;
      role?: null | string;
      updatedAt: number;
      userId?: null | string;
      username?: null | string;
      _id: Id<"user">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "banExpires"
      | "banned"
      | "banReason"
      | "createdAt"
      | "displayUsername"
      | "email"
      | "emailVerified"
      | "image"
      | "name"
      | "profileId"
      | "role"
      | "updatedAt"
      | "userId"
      | "username";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      email_name: ["email", "name", "_creationTime"];
      name: ["name", "_creationTime"];
      profileId: ["profileId", "_creationTime"];
      userId: ["userId", "_creationTime"];
      user_email_unique: ["email", "_creationTime"];
      username: ["username", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  verification: {
    document: {
      createdAt: number;
      expiresAt: number;
      identifier: string;
      updatedAt: number;
      value: string;
      _id: Id<"verification">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "createdAt"
      | "expiresAt"
      | "identifier"
      | "updatedAt"
      | "value";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      expiresAt: ["expiresAt", "_creationTime"];
      identifier: ["identifier", "_creationTime"];
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
