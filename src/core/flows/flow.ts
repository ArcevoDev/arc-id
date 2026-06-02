import { z } from "zod";
import type { FlowContext } from "./flow-context";

export interface Flow<I = unknown, O = unknown> {
  name: string;
  inputSchema: z.ZodType<I>;
  outputSchema?: z.ZodType<O>;
  execute(input: I, ctx: FlowContext): Promise<O>;
}
