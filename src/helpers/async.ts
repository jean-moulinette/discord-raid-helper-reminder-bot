type RetryOptions = {
  delayMs?: number;
  onRetry?: (error: unknown) => void;
};

const DEFAULT_DELAY_MS = 60_000;

export async function retryOnceAfterDelay<T>(
  operation: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS;
  try {
    return await operation();
  } catch (error) {
    if (options?.onRetry) {
      options.onRetry(error);
      console.error(`Retrying in ${delayMs / 1000} seconds...`);
    }
    await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    return operation();
  }
}
