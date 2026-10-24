export interface Command {
  name: string;
  execute(): void;
  undo(): void;
}

export class CommandStack {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxHistory: number;
  private pendingGroup: Command[] | null = null;

  constructor(maxHistory = 100) {
    this.maxHistory = maxHistory;
  }

  public execute(cmd: Command): void {
    cmd.execute();
    if (this.pendingGroup) {
      this.pendingGroup.push(cmd);
      return;
    }
    this.push(cmd);
  }

  /**
   * Runs `fn` and records every command it executes as a single undo step.
   * Nested calls are merged into the outermost group.
   */
  public group<T>(name: string, fn: () => T): T {
    if (this.pendingGroup) return fn();

    const cmds: Command[] = [];
    this.pendingGroup = cmds;
    try {
      return fn();
    } finally {
      this.pendingGroup = null;
      if (cmds.length === 1) {
        this.push(cmds[0]);
      } else if (cmds.length > 1) {
        this.push({
          name,
          execute: () => {
            for (const c of cmds) c.execute();
          },
          undo: () => {
            for (let i = cmds.length - 1; i >= 0; i--) cmds[i].undo();
          },
        });
      }
    }
  }

  public undo(): boolean {
    const cmd = this.undoStack.pop();
    if (!cmd) return false;

    cmd.undo();
    this.redoStack.push(cmd);
    return true;
  }

  public redo(): boolean {
    const cmd = this.redoStack.pop();
    if (!cmd) return false;

    cmd.execute();
    this.undoStack.push(cmd);
    return true;
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  private push(cmd: Command): void {
    this.undoStack.push(cmd);
    this.redoStack = [];

    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
  }
}
