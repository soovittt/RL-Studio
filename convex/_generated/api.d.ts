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
import type * as authNode from "../authNode.js";
import type * as coderabbit from "../coderabbit.js";
import type * as environments from "../environments.js";
import type * as firecrawl from "../firecrawl.js";
import type * as http from "../http.js";
import type * as import_ from "../import.js";
import type * as metrics from "../metrics.js";
import type * as rolloutFrames from "../rolloutFrames.js";
import type * as rolloutHistory from "../rolloutHistory.js";
import type * as runs from "../runs.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  authNode: typeof authNode;
  coderabbit: typeof coderabbit;
  environments: typeof environments;
  firecrawl: typeof firecrawl;
  http: typeof http;
  import: typeof import_;
  metrics: typeof metrics;
  rolloutFrames: typeof rolloutFrames;
  rolloutHistory: typeof rolloutHistory;
  runs: typeof runs;
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

export declare const components: {};
