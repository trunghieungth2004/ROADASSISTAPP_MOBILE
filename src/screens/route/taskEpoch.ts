export type TaskEpoch = {claim: () => number; current: (id: number) => boolean; invalidate: () => void};

export function createTaskEpoch(): TaskEpoch {
  let seq = 0;
  return {
    claim: () => {
      seq += 1;
      return seq;
    },
    current: (id: number) => seq === id,
    invalidate: () => {
      seq += 1;
    },
  };
}
