import type { z } from 'zod';
import type { changePasswordSchema } from '@nutritrack/shared';

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
