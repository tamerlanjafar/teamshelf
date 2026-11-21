// Stands in for @neondatabase/neon-js in mock mode (vite.config.ts points the import here), so
// src/lib/neon.ts and everything that uses it run unchanged. Sign-in and data are answered by
// the mock backend instead of Neon.

import { useSyncExternalStore } from 'react'
import { runQuery, runRpc, type Answer, type Filter, type Query } from './backend'
import { getState, subscribe, update, userOfSlot, type User } from './store'

/** A little wait, so loading states show the way they do over a network. */
const LATENCY = 160
const later = <T,>(make: () => T) => new Promise<T>((resolve) => setTimeout(() => resolve(make()), LATENCY))

class QueryBuilder implements PromiseLike<Answer> {
  private query: Query
  private user: () => User | null

  constructor(table: string, user: () => User | null) {
    this.user = user
    this.query = { table, action: 'select', filters: [], columns: null, returning: false, single: null }
  }

  select(columns = '*') {
    const list = columns.trim() === '*' ? null : columns.split(',').map((column) => column.trim())
    if (this.query.action === 'select') this.query.columns = list
    else {
      this.query.returning = true
      this.query.columns = list
    }
    return this
  }

  insert(values: Query['values']) {
    return this.write('insert', values)
  }
  upsert(values: Query['values']) {
    return this.write('upsert', values)
  }
  update(values: Query['values']) {
    return this.write('update', values)
  }
  delete() {
    return this.write('delete')
  }

  eq(column: string, value: unknown) {
    return this.filter(column, 'eq', value)
  }
  neq(column: string, value: unknown) {
    return this.filter(column, 'neq', value)
  }
  match(values: Record<string, unknown>) {
    for (const [column, value] of Object.entries(values)) this.filter(column, 'eq', value)
    return this
  }
  order(column: string, options: { ascending?: boolean } = {}) {
    this.query.order = { column, ascending: options.ascending ?? true }
    return this
  }
  single() {
    this.query.single = 'one'
    return this
  }
  maybeSingle() {
    this.query.single = 'maybe'
    return this
  }

  then<Result1 = Answer, Result2 = never>(onFulfilled?: ((value: Answer) => Result1 | PromiseLike<Result1>) | null, onRejected?: ((reason: unknown) => Result2 | PromiseLike<Result2>) | null) {
    return later(() => runQuery(this.query, this.user())).then(onFulfilled, onRejected)
  }

  private write(action: Query['action'], values?: Query['values']) {
    this.query.action = action
    this.query.values = values
    return this
  }

  private filter(column: string, op: Filter['op'], value: unknown) {
    this.query.filters.push({ column, op, value })
    return this
  }
}

interface SessionAnswer {
  data: { user: User & { emailVerified: boolean; image: null }; session: { token: string; userId: string } } | null
  isPending: false
  error: null
  refetch: () => void
}

export function createClient({ auth }: { auth: { url: string }; dataApi?: unknown }) {
  // The session path this page uses: the last part of /api/auth/<slot>.
  const slot = new URL(auth.url).pathname.split('/').filter(Boolean).pop() ?? '_new'
  const user = () => userOfSlot(slot)

  // useSession must hand back the same object until the session changes.
  let cached: { key: string; answer: SessionAnswer } | null = null
  const session = (): SessionAnswer => {
    const current = user()
    const token = getState().sessions[slot] ?? ''
    const key = current ? `${token}:${current.id}:${current.email}:${current.name}` : ''
    if (cached?.key === key) return cached.answer
    const answer: SessionAnswer = {
      data: current ? { user: { ...current, emailVerified: true, image: null }, session: { token, userId: current.id } } : null,
      isPending: false,
      error: null,
      refetch: () => {},
    }
    cached = { key, answer }
    return answer
  }

  return {
    from: (table: string) => new QueryBuilder(table, user),
    rpc: (name: string, args: Record<string, unknown> = {}) => ({
      then: <Result1 = Answer, Result2 = never>(onFulfilled?: ((value: Answer) => Result1 | PromiseLike<Result1>) | null, onRejected?: ((reason: unknown) => Result2 | PromiseLike<Result2>) | null) =>
        later(() => runRpc(name, args, user())).then(onFulfilled, onRejected),
    }),
    auth: {
      useSession: () => useSyncExternalStore(subscribe, session),
      getSession: async () => ({ data: session().data, error: null }),
      signIn: {
        // Nothing is emailed: the toolbar offers to open the link instead.
        magicLink: async ({ email, callbackURL }: { email: string; callbackURL: string }) => {
          await later(() => null)
          update((draft) => {
            draft.pendingLink = { email: email.trim().toLowerCase(), callbackURL }
          })
          return { data: { status: true }, error: null }
        },
      },
    },
  }
}
