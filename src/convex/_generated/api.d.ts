/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as features from "../features.js";
import type * as feedback from "../feedback.js";
import type * as feedbackBoard from "../feedbackBoard.js";
import type * as feedbackComment from "../feedbackComment.js";
import type * as feedbackCommentEmote from "../feedbackCommentEmote.js";
import type * as feedbackEvent from "../feedbackEvent.js";
import type * as feedbackUpvote from "../feedbackUpvote.js";
import type * as http from "../http.js";
import type * as org from "../org.js";
import type * as orgMember from "../orgMember.js";
import type * as profile from "../profile.js";
import type * as project from "../project.js";
import type * as projectMember from "../projectMember.js";
import type * as schema__shared from "../schema/_shared.js";
import type * as update from "../update.js";
import type * as updateComment from "../updateComment.js";
import type * as updateCommentEmote from "../updateCommentEmote.js";
import type * as updateEmote from "../updateEmote.js";
import type * as utils_context from "../utils/context.js";
import type * as utils_functions from "../utils/functions.js";
import type * as utils_helpers from "../utils/helpers.js";
import type * as utils_r2 from "../utils/r2.js";
import type * as utils_storageTracking from "../utils/storageTracking.js";
import type * as utils_table from "../utils/table.js";
import type * as utils_trigger from "../utils/trigger.js";
import type * as utils_types from "../utils/types.js";
import type * as utils_verify from "../utils/verify.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  features: typeof features;
  feedback: typeof feedback;
  feedbackBoard: typeof feedbackBoard;
  feedbackComment: typeof feedbackComment;
  feedbackCommentEmote: typeof feedbackCommentEmote;
  feedbackEvent: typeof feedbackEvent;
  feedbackUpvote: typeof feedbackUpvote;
  http: typeof http;
  org: typeof org;
  orgMember: typeof orgMember;
  profile: typeof profile;
  project: typeof project;
  projectMember: typeof projectMember;
  "schema/_shared": typeof schema__shared;
  update: typeof update;
  updateComment: typeof updateComment;
  updateCommentEmote: typeof updateCommentEmote;
  updateEmote: typeof updateEmote;
  "utils/context": typeof utils_context;
  "utils/functions": typeof utils_functions;
  "utils/helpers": typeof utils_helpers;
  "utils/r2": typeof utils_r2;
  "utils/storageTracking": typeof utils_storageTracking;
  "utils/table": typeof utils_table;
  "utils/trigger": typeof utils_trigger;
  "utils/types": typeof utils_types;
  "utils/verify": typeof utils_verify;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("../betterAuth/_generated/component.js").ComponentApi<"betterAuth">;
  r2: import("@convex-dev/r2/_generated/component.js").ComponentApi<"r2">;
  feedbackUpvotes: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"feedbackUpvotes">;
};
