import { existsSync, readFileSync, writeFileSync } from 'fs';

export function parseArgs(): Map<string, string> {
  return new Map(
    process.argv.slice(2)
      .filter((a) => a.startsWith('--'))
      .map((a) => {
        const [key, ...rest] = a.slice(2).split('=')
        return [key, rest.join('=') || 'true']
      })
  )
}

export function requireArg(args: Map<string, string>, key: string, hint: string): string {
  const value = args.get(key)
  if (!value) throw new Error(`Missing required --${key}=${hint}`)
  return value
}

export function readJsonFile<T>(path: string): T {
  if (!existsSync(path)) throw new Error(`Input file not found: ${path}`)
  return JSON.parse(readFileSync(path, 'utf-8')) as T
}

export function loadState<T>(statePath: string, restart: boolean, initial: T): T {
  if (!restart && existsSync(statePath)) {
    return JSON.parse(readFileSync(statePath, 'utf-8')) as T
  }
  return initial
}

export function saveState<T>(statePath: string, state: T): void {
  writeFileSync(statePath, JSON.stringify(state, null, 2))
}
