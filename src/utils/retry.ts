export interface RetryOptions {
  /** 最大重试次数（不包含第一次尝试），默认 3 */
  retries?: number;
  /** 首次重试前的等待时间，默认 1000ms，之后指数退避 */
  baseDelayMs?: number;
  /** 最大等待时间，默认 10000ms */
  maxDelayMs?: number;
  /** 自定义是否应该重试（例如某些错误不重试） */
  shouldRetry?: (err: unknown) => boolean;
  /** 重试回调（可用于日志） */
  onRetry?: (err: unknown, attempt: number) => void;
}

/**
 * 带指数退避 + 抖动（jitter）的重试包装器。
 * 用于网络请求和 LLM 调用，缓解瞬时限流/超时导致的整局失败。
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    retries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 10000,
    shouldRetry = () => true,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === retries || !shouldRetry(err)) {
        throw err;
      }
      const delay =
        Math.min(baseDelayMs * 2 ** attempt, maxDelayMs) + Math.random() * 200;
      onRetry?.(err, attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // 理论上不会走到这里，但 TS 需要明确的 throw
  throw lastError;
}
