import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const magicLinkSchema = z.object({
  email: z.string().email('Enter a valid email'),
})

export const songSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  artist: z.string().optional(),
  song_key: z.string().optional(),
  bpm: z.number().int().min(20, 'BPM too slow').max(280, 'BPM too fast').optional(),
  time_signature: z.string().optional(),
  chord_chart: z.string().optional(),
  notes: z.string().optional(),
})

export const setlistSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  show_date: z.string().optional(),
  venue: z.string().optional(),
  notes: z.string().optional(),
})

export type LoginFormData = z.infer<typeof loginSchema>
export type MagicLinkFormData = z.infer<typeof magicLinkSchema>
export type SongFormData = z.infer<typeof songSchema>
export type SetlistFormData = z.infer<typeof setlistSchema>
