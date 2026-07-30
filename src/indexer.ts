import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface SessionMeta {
    id: string;
    date: string;
    ws: string;
    model: string;
    kb: number;
    path: string;
    text: string;
}

export interface Turn {
    role: 'user' | 'assistant';
    text: string;
}

function userDir(): string {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'Code', 'User');
}

function workspaceMap(): Record<string, string> {
    const wsRoot = path.join(userDir(), 'workspaceStorage');
    const map: Record<string, string> = {};
    if (!fs.existsSync(wsRoot)) {
        return map;
    }
    for (const hash of fs.readdirSync(wsRoot)) {
        const wj = path.join(wsRoot, hash, 'workspace.json');
        try {
            const folder = JSON.parse(fs.readFileSync(wj, 'utf8')).folder as string;
            if (folder) {
                const decoded = decodeURIComponent(folder).replace(/^file:\/\/\//, '').replace(/\//g, '\\');
                map[hash] = path.basename(decoded);
            }
        } catch {
            // no workspace.json / unreadable
        }
    }
    return map;
}

function sessionFiles(): { file: string; hash: string }[] {
    const out: { file: string; hash: string }[] = [];
    const wsRoot = path.join(userDir(), 'workspaceStorage');
    if (fs.existsSync(wsRoot)) {
        for (const hash of fs.readdirSync(wsRoot)) {
            const dir = path.join(wsRoot, hash, 'chatSessions');
            if (fs.existsSync(dir)) {
                for (const f of fs.readdirSync(dir)) {
                    if (f.endsWith('.jsonl')) {
                        out.push({ file: path.join(dir, f), hash });
                    }
                }
            }
        }
    }
    const empty = path.join(userDir(), 'globalStorage', 'emptyWindowChatSessions');
    if (fs.existsSync(empty)) {
        for (const f of fs.readdirSync(empty)) {
            if (f.endsWith('.jsonl')) {
                out.push({ file: path.join(empty, f), hash: '(empty window)' });
            }
        }
    }
    return out;
}

export function buildIndex(maxIndexKB: number, days: number): SessionMeta[] {
    const map = workspaceMap();
    const cap = maxIndexKB * 1024;
    const cutoff = days > 0 ? Date.now() - days * 86400_000 : 0;
    const sessions: SessionMeta[] = [];

    for (const { file, hash } of sessionFiles()) {
        let stat: fs.Stats;
        try {
            stat = fs.statSync(file);
        } catch {
            continue;
        }
        if (cutoff && stat.mtimeMs < cutoff) {
            continue;
        }
        let raw: string;
        try {
            raw = fs.readFileSync(file, 'utf8');
        } catch {
            continue;
        }
        if (!raw) {
            continue;
        }

        let model = 'unknown';
        let dateMs = stat.mtimeMs;
        try {
            const firstLine = raw.slice(0, raw.indexOf('\n'));
            const base = JSON.parse(firstLine).v;
            const mid = base?.inputState?.selectedModel?.identifier || base?.selectedModel?.identifier;
            if (mid) {
                model = String(mid).replace(/^copilot\//, '');
            }
            if (base?.creationDate) {
                dateMs = Number(base.creationDate);
            }
        } catch {
            // keep defaults
        }

        const ws = hash === '(empty window)' ? '(empty window)' : (map[hash] || hash.slice(0, 8));
        let text = raw.replace(/\s+/g, ' ').replace(/[<>]/g, ' ');
        if (text.length > cap) {
            text = text.slice(0, cap);
        }

        sessions.push({
            id: path.basename(file, '.jsonl'),
            date: new Date(dateMs).toISOString().slice(0, 16).replace('T', ' '),
            ws,
            model,
            kb: Math.round(stat.size / 1024),
            path: file,
            text
        });
    }

    sessions.sort((a, b) => (a.date < b.date ? 1 : -1));
    return sessions;
}

/** Reconstruct a conversation from the log-structured transcript. */
export function reconstruct(file: string): Turn[] {
    let raw: string;
    try {
        raw = fs.readFileSync(file, 'utf8');
    } catch {
        return [];
    }
    const lines = raw.split(/\r?\n/).filter(Boolean);
    if (!lines.length) {
        return [];
    }

    let base: any;
    try {
        base = JSON.parse(lines[0]).v;
    } catch {
        return [];
    }

    const reqObjs: any[] = Array.isArray(base?.requests) ? [...base.requests] : [];
    const respMap: Record<number, any[]> = {};

    for (let i = 1; i < lines.length; i++) {
        let o: any;
        try {
            o = JSON.parse(lines[i]);
        } catch {
            continue;
        }
        if (!o.k) {
            continue;
        }
        const p = (o.k as any[]).join('/');
        if (p === 'requests' && o.kind === 2) {
            for (const e of o.v) {
                reqObjs.push(e);
            }
        } else {
            const m = /^requests\/(\d+)\/response$/.exec(p);
            if (m) {
                const n = Number(m[1]);
                if (o.kind === 2) {
                    respMap[n] = (respMap[n] || []).concat(o.v);
                } else {
                    respMap[n] = o.v;
                }
            }
        }
    }

    const turns: Turn[] = [];
    for (let n = 0; n < reqObjs.length; n++) {
        const r = reqObjs[n];
        const user = r?.message?.text ? String(r.message.text) : '';
        const parts = respMap[n] || r?.response || [];
        let atext = '';
        for (const part of parts) {
            if (typeof part === 'string') {
                atext += part;
            } else if (typeof part?.value === 'string') {
                atext += part.value;
            }
        }
        if (user) {
            turns.push({ role: 'user', text: user });
        }
        if (atext.trim()) {
            turns.push({ role: 'assistant', text: atext });
        }
    }
    return turns;
}
