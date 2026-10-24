import { describe, expect, it } from 'vitest';
import { CommandStack } from '../src/history/command-stack';

describe('CommandStack', () => {
  const counter = () => {
    const state = { value: 0 };
    const inc = (by: number) => ({
      name: `+${by}`,
      execute: () => {
        state.value += by;
      },
      undo: () => {
        state.value -= by;
      },
    });
    return { state, inc };
  };

  it('records grouped commands as a single undo step', () => {
    const stack = new CommandStack();
    const { state, inc } = counter();

    stack.group('both', () => {
      stack.execute(inc(1));
      stack.execute(inc(10));
    });
    expect(state.value).toBe(11);

    expect(stack.undo()).toBe(true);
    expect(state.value).toBe(0);
    expect(stack.canUndo()).toBe(false);

    expect(stack.redo()).toBe(true);
    expect(state.value).toBe(11);
  });

  it('merges nested groups into the outer group', () => {
    const stack = new CommandStack();
    const { state, inc } = counter();

    stack.group('outer', () => {
      stack.execute(inc(1));
      stack.group('inner', () => stack.execute(inc(2)));
    });

    stack.undo();
    expect(state.value).toBe(0);
    expect(stack.canUndo()).toBe(false);
  });

  it('records nothing for an empty group', () => {
    const stack = new CommandStack();
    stack.group('empty', () => undefined);
    expect(stack.canUndo()).toBe(false);
  });
});
