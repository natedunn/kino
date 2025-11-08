import type { GenericId } from "convex/values";

import type { GenericDataModel, TableNamesInDataModel } from "convex/server";
import { z as zValidate } from "zod";
import * as z from "zod/v4/core";

// Simple registry for metadata
const metadata = new WeakMap<z.$ZodType, any>();

export const registryHelpers = {
  getMetadata: (type: z.$ZodType) => metadata.get(type),
  setMetadata: (type: z.$ZodType, meta: any) => metadata.set(type, meta),
};

/**
 * Create a Zod validator for a Convex Id
 *
 * Uses the string → transform → brand pattern for proper type narrowing with ctx.db.get()
 * This aligns with Zod v4 best practices and matches convex-helpers implementation
 */

export function zid<
  DataModel extends GenericDataModel,
  TableName extends
    TableNamesInDataModel<DataModel> = TableNamesInDataModel<DataModel>,
>(tableName: TableName) {
  const schema = zValidate.string<
    GenericId<TableName>
  >();

  registryHelpers.setMetadata(schema, {
    isConvexId: true,
    tableName,
  });

  return schema;
}

// export function zid<
//   DataModel extends GenericDataModel,
//   TableName extends
//     TableNamesInDataModel<DataModel> = TableNamesInDataModel<DataModel>,
// >(tableName: TableName) {
//   const baseSchema = zValidate
//     .string()
//     .refine((val) => typeof val === "string" && val.length > 0, {
//       message: `Invalid ID for table "${tableName}"`,
//     })
//     .transform((val) => {
//       return val as string & GenericId<TableName>;
//     })
//     .brand(`ConvexId_${tableName}`)
//     .describe(`convexId:${tableName}`);

//   registryHelpers.setMetadata(baseSchema, {
//     isConvexId: true,
//     tableName,
//   });

//   const branded = baseSchema as any;
//   branded._tableName = tableName;

//   return branded as zValidate.ZodType<
//     GenericId<TableName>,
//     GenericId<TableName>
//   > & {
//     _tableName: TableName;
//   };
// }

export function isZid<T extends string>(schema: z.$ZodType): schema is Zid<T> {
  // Check our metadata registry for ConvexId marker
  const metadata = registryHelpers.getMetadata(schema);
  return (
    metadata?.isConvexId === true &&
    metadata?.tableName &&
    typeof metadata.tableName === "string"
  );
}

export type Zid<TableName extends string> = ReturnType<
  typeof zid<GenericDataModel, TableName>
>;
