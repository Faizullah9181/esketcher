import type { Paint } from "@/types";

export type ShapeId = string;

export interface SketchBoardProps {
  /** board number on the desk: 01, 02 … */
  num: number;
  sketchId: string;
  title: string;
  category: string;
  variant: number;
  seed: number;
  complexity: number;
  /** region id → applied material */
  paints: Record<string, Paint>;
  /** when set, painting this board uses this material and skips Jev */
  lockedMaterial: string | null;
  /** palette direction Jev chose for the board (older boards: undefined) */
  palette?: string | null;
}

interface BaseShape {
  id: ShapeId;
  x: number;
  y: number;
  w: number;
  h: number;
  /** radians, around the shape's centre */
  rotation: number;
  /** paint order: higher draws on top */
  z: number;
  locked: boolean;
  groupId: string | null;
}

export interface BoardShape extends BaseShape {
  type: "board";
  props: SketchBoardProps;
}

export interface StrokeShape extends BaseShape {
  type: "stroke";
  /** local points [x, y, pressure] relative to (x, y), in the shape's unscaled space */
  points: [number, number, number][];
  color: string;
  size: number;
  /** translucent marker-like stroke */
  brush: boolean;
}

export interface FrameShape extends BaseShape {
  type: "frame";
  title: string;
}

export type Shape = BoardShape | StrokeShape | FrameShape;

export interface DeskDoc {
  version: 1;
  shapes: Record<ShapeId, Shape>;
}

export interface Camera {
  x: number;
  y: number;
  z: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ToolId = "select" | "hand" | "zoom" | "draw" | "highlight" | "eraser" | "paint" | "pick" | "frame" | "jev";

export interface StrokeStyle {
  color: string;
  size: number;
}

export interface Vec {
  x: number;
  y: number;
}
