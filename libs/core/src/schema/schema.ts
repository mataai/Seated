import { z } from 'zod';
import type { Floorplan as IFloorplan } from './types';

export const Vec2Schema = z
  .object({
    x: z.number(),
    y: z.number(),
  })
  .passthrough();

export const FloorplanDimensionsSchema = z
  .object({
    width: z.number().positive(),
    height: z.number().positive(),
  })
  .passthrough();

export const FloorplanBackgroundSchema = z
  .object({
    src: z.string(),
    position: Vec2Schema.optional(),
    scale: z.number().positive().optional(),
    opacity: z.number().min(0).max(1).optional(),
    locked: z.boolean().optional(),
  })
  .passthrough();

export const SeatSchema = z
  .object({
    id: z.string().min(1),
    index: z.number().int().min(0),
    side: z.enum(['a', 'b']),
    label: z.string(),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const RowTableStyleSchema = z
  .object({
    fill: z.string().optional(),
    stroke: z.string().optional(),
    strokeWidth: z.number().nonnegative().optional(),
    cornerRadius: z.number().nonnegative().optional(),
  })
  .passthrough();

export const RowBaseSchema = z
  .object({
    id: z.string().min(1),
    label: z.string(),
    position: Vec2Schema,
    rotation: z.number(),
    side: z.enum(['one', 'both']),
    seatSpacing: z.number().positive(),
    seatRadius: z.number().positive(),
    tableWidth: z.number().nonnegative(),
    tableStyle: RowTableStyleSchema.optional(),
    seats: z.array(SeatSchema),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const RowSchema = RowBaseSchema.superRefine((row, ctx) => {
  if (row.side === 'one') {
    for (let i = 0; i < row.seats.length; i++) {
      if (row.seats[i].side === 'b') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Seat "${row.seats[i].id}" has side 'b' but row "${row.id}" has side 'one'`,
          path: ['seats', i, 'side'],
        });
      }
    }
  }
});

export const ZoneTextSchema = z
  .object({
    value: z.string(),
    color: z.string().optional(),
    fontSize: z.number().positive().optional(),
    fontFamily: z.string().optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
    offset: Vec2Schema.optional(),
  })
  .passthrough();

export const ZoneSchema = z
  .object({
    id: z.string().min(1),
    position: Vec2Schema,
    rotation: z.number(),
    points: z.array(Vec2Schema).min(3),
    fill: z.string(),
    stroke: z.string().optional(),
    opacity: z.number().min(0).max(1).optional(),
    text: ZoneTextSchema.optional(),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const BuildingSchema = z
  .object({
    id: z.string().min(1),
    label: z.string(),
    position: Vec2Schema,
    rotation: z.number(),
    points: z.array(Vec2Schema).min(3),
    zones: z.array(ZoneSchema),
    rows: z.array(RowSchema),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const FloorplanSchema = z
  .object({
    schemaVersion: z.literal(1),
    dimensions: FloorplanDimensionsSchema,
    background: FloorplanBackgroundSchema.optional(),
    buildings: z.array(BuildingSchema),
  })
  .passthrough();

export type InferredFloorplan = z.infer<typeof FloorplanSchema>;
export type InferredBuilding = z.infer<typeof BuildingSchema>;
export type InferredZone = z.infer<typeof ZoneSchema>;
export type InferredRow = z.infer<typeof RowSchema>;
export type InferredSeat = z.infer<typeof SeatSchema>;

export function parseFloorplan(input: unknown): IFloorplan {
  return FloorplanSchema.parse(input) as IFloorplan;
}

export function safeParseFloorplan(
  input: unknown
): ReturnType<typeof FloorplanSchema.safeParse> {
  return FloorplanSchema.safeParse(input);
}
