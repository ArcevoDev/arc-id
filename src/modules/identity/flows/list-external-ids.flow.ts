// src/modules/identity/flows/list-external-ids.flow.ts

import { z } from "zod";
import type { Flow, FlowContext } from "@/core/flows";

const Input = z.object({ identityId: z.string().cuid() });

type Output = Array<{
  id: string;
  type: string;
  displayValue: string | null;
  verified: boolean;
  createdAt: Date;
}>;

export const listExternalIdsFlow: Flow<z.infer<typeof Input>, Output> = {
  name: "identity:list-external-ids",
  inputSchema: Input,

  async execute(input, ctx: FlowContext): Promise<Output> {
    const records = await ctx.db.externalIdentifier.findMany({
      where: { identityId: input.identityId },
      select: {
        id: true,
        type: true,
        displayValue: true,
        verified: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return records;
  },
};
