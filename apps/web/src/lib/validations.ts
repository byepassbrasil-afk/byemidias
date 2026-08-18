import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

export const signupSchema = z.object({
  full_name: z.string().min(2, 'Nome muito curto'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

export const organizationSchema = z.object({
  name: z.string().min(2, 'Nome muito curto'),
  slug: z.string().min(2, 'Slug muito curto').regex(/^[a-z0-9-]+$/, 'Slug inválido'),
});

export const unitSchema = z.object({
  name: z.string().min(2, 'Nome muito curto'),
  city: z.string().optional(),
  state: z.string().optional(),
});

export const playlistSchema = z.object({
  name: z.string().min(2, 'Nome muito curto'),
  description: z.string().optional(),
});

export const campaignSchema = z.object({
  name: z.string().min(2, 'Nome muito curto'),
  description: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  priority: z.number().min(1).max(4),
});
