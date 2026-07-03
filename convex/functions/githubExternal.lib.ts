import { z } from "zod"

export const connectionModeSchema = z.enum(["read", "read_write"])
export const sourceSchema = z.enum(["issues", "discussions"])
