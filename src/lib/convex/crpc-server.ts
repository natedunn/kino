import { api } from "@convex/api"
import { createServerCRPCProxy } from "kitcn/rsc"

export const crpcServer = createServerCRPCProxy({ api })
