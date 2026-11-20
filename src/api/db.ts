interface DataApiError {
  message: string
  code?: string
}

interface DataApiResult<T> {
  data: T | null
  error: DataApiError | null
}

/** A stable empty list, for data that hasn't loaded yet. */
export const NONE: never[] = []

/** Postgres error codes the app explains in its own words. */
export const UNIQUE_VIOLATION = '23505'

const FRIENDLY: Record<string, string> = {
  [UNIQUE_VIOLATION]: 'That already exists.',
  '23514': "That value isn't allowed.",
}

/** An error from the database, with the Postgres code that says what kind. */
export class DataError extends Error {
  code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

/** Awaits a Data API request and returns its rows, or throws an error a person can read. */
export async function unwrap<T>(request: PromiseLike<DataApiResult<T>>): Promise<T> {
  const { data, error } = await request
  if (error) throw new DataError((error.code && FRIENDLY[error.code]) || error.message, error.code)
  return data as T
}

export const isUniqueViolation = (error: unknown) => error instanceof DataError && error.code === UNIQUE_VIOLATION
