import type { Vec2 } from '../schema/types';

export function vec2(x: number, y: number): Vec2 {
  return { x, y };
}

export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI;
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function mul(v: Vec2, scalar: number): Vec2 {
  return { x: v.x * scalar, y: v.y * scalar };
}

export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

export function cross(a: Vec2, b: Vec2): number {
  return a.x * b.y - a.y * b.x;
}

export function lengthSq(v: Vec2): number {
  return v.x * v.x + v.y * v.y;
}

export function length(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function distSq(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.sqrt(distSq(a, b));
}

export function normalize(v: Vec2): Vec2 {
  const len = length(v);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function rotateRad(v: Vec2, angleRad: number): Vec2 {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return {
    x: v.x * cos - v.y * sin,
    y: v.x * sin + v.y * cos,
  };
}

export function rotate(v: Vec2, angleDeg: number): Vec2 {
  return rotateRad(v, degToRad(angleDeg));
}

export function transformPoint(point: Vec2, origin: Vec2, rotationDeg: number): Vec2 {
  const rotated = rotate(point, rotationDeg);
  return add(origin, rotated);
}

export function inverseTransformPoint(point: Vec2, origin: Vec2, rotationDeg: number): Vec2 {
  const translated = sub(point, origin);
  return rotate(translated, -rotationDeg);
}

export function approxEqual(a: Vec2, b: Vec2, tol = 0.01): boolean {
  return Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol;
}

export function distanceToSegmentSq(p: Vec2, a: Vec2, b: Vec2): number {
  const ab = sub(b, a);
  const ap = sub(p, a);
  const abLenSq = lengthSq(ab);
  if (abLenSq === 0) {
    return distSq(p, a);
  }
  const t = Math.max(0, Math.min(1, dot(ap, ab) / abLenSq));
  const projection = add(a, mul(ab, t));
  return distSq(p, projection);
}

export function distanceToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  return Math.sqrt(distanceToSegmentSq(p, a, b));
}
