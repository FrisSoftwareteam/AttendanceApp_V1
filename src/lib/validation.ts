import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters")
});

export const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters"),
    email: z.string().trim().email("Enter a valid email"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(64, "Password must be at most 64 characters"),
    role: z.enum(["user", "admin"]),
    inviteCode: z.string().trim().optional()
  })
  .superRefine((data, ctx) => {
    if (data.role === "admin" && !data.inviteCode) {
      ctx.addIssue({
        path: ["inviteCode"],
        code: z.ZodIssueCode.custom,
        message: "Admin invite code is required"
      });
    }
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type SignupValues = z.infer<typeof signupSchema>;

export function toFieldErrors(error: z.ZodError) {
  const flattened = error.flatten();
  const fieldErrors: Record<string, string> = {};
  for (const [field, messages] of Object.entries(flattened.fieldErrors)) {
    if (messages && messages.length > 0) {
      fieldErrors[field] = messages[0] ?? "Invalid value";
    }
  }
  return {
    fieldErrors,
    formError: flattened.formErrors[0]
  };
}
