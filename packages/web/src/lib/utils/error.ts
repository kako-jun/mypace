// Get error message from unknown error
export function getErrorMessage(error: unknown, fallback: string = 'An error occurred'): string {
  return error instanceof Error ? error.message : fallback
}
