import type { Floorplan, TypedEventEmitter, Vec2 } from '@open-seats/core';
import type { CommandStack } from '../history/command-stack';
import type { EditorEvents, EditorRulesConfig } from '../types';

/**
 * The slice of editor state shared with the operation modules. Getters are
 * live: `floorplan` is replaced whenever a new plan is loaded.
 */
export interface EditorContext {
  readonly floorplan: Floorplan;
  readonly rules: EditorRulesConfig;
  readonly commandStack: CommandStack;
  readonly emitter: TypedEventEmitter<EditorEvents>;
  snap(pt: Vec2): Vec2;
  emitChange(): void;
  batch<T>(name: string, fn: () => T): T;
  getSelectedNodeIds(): readonly string[];
  selectNodes(ids: string[]): void;
  clearSelection(): void;
  deleteNode(nodeId: string): boolean;
}
