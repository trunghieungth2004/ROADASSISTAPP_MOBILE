export type CameraIntent = {focusPending: boolean; flagCount: number; fitted: boolean};

export function shouldAutoFit(intent: CameraIntent): boolean {
  if (intent.focusPending || intent.fitted || intent.flagCount === 0) return false;
  return true;
}

export function shouldRetryCenter(centered: boolean, attempt: number, maxAttempts: number): boolean {
  return !centered && attempt < maxAttempts;
}
