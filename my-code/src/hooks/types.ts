import { z } from "zod";

export const HooksSchema = () => z.record(z.array(z.record(z.unknown())));
export type HooksSettings = z.infer<ReturnType<typeof HooksSchema>>;
