import { existsSync, readFileSync, writeFileSync } from 'fs';
export function parseArgs() {
    return new Map(process.argv.slice(2)
        .filter((a) => a.startsWith('--'))
        .map((a) => {
        const [key, ...rest] = a.slice(2).split('=');
        return [key, rest.join('=') || 'true'];
    }));
}
export function requireArg(args, key, hint) {
    const value = args.get(key);
    if (!value)
        throw new Error(`Missing required --${key}=${hint}`);
    return value;
}
export function readJsonFile(path) {
    if (!existsSync(path))
        throw new Error(`Input file not found: ${path}`);
    return JSON.parse(readFileSync(path, 'utf-8'));
}
export function loadState(statePath, restart, initial) {
    if (!restart && existsSync(statePath)) {
        return JSON.parse(readFileSync(statePath, 'utf-8'));
    }
    return initial;
}
export function saveState(statePath, state) {
    writeFileSync(statePath, JSON.stringify(state, null, 2));
}
