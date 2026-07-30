import * as vscode from 'vscode';
import { buildIndex, reconstruct, SessionMeta } from './indexer';

export function activate(context: vscode.ExtensionContext) {
    const provider = new ChatLensViewProvider(context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('chatlens.search', provider),
        vscode.commands.registerCommand('chatlens.refresh', () => provider.refresh())
    );
}

export function deactivate() {}

class ChatLensViewProvider implements vscode.WebviewViewProvider {
    private view?: vscode.WebviewView;

    constructor(private readonly context: vscode.ExtensionContext) {}

    refresh() {
        if (this.view) {
            this.postIndex(this.view.webview);
        }
    }

    resolveWebviewView(view: vscode.WebviewView) {
        this.view = view;
        view.webview.options = { enableScripts: true };
        view.webview.html = this.searchHtml();

        view.webview.onDidReceiveMessage(async msg => {
            if (msg.type === 'ready') {
                this.postIndex(view.webview);
            } else if (msg.type === 'open') {
                this.openTranscript(msg.id, msg.path, msg.ws);
            }
        });
    }

    private postIndex(webview: vscode.Webview) {
        const cfg = vscode.workspace.getConfiguration('chatlens');
        const maxKB = cfg.get<number>('maxIndexKB', 40);
        const days = cfg.get<number>('days', 0);
        let index: SessionMeta[] = [];
        try {
            index = buildIndex(maxKB, days);
        } catch (e) {
            webview.postMessage({ type: 'error', message: String(e) });
            return;
        }
        webview.postMessage({ type: 'index', data: index });
    }

    private openTranscript(id: string, file: string, ws: string) {
        const turns = reconstruct(file);
        const panel = vscode.window.createWebviewPanel(
            'chatlens.transcript',
            `💬 ${ws || 'Chat'}`,
            vscode.ViewColumn.Active,
            { enableScripts: true }
        );
        panel.webview.html = transcriptHtml(turns, ws || id);
    }

    private searchHtml(): string {
        return /* html */ `<!doctype html><html><head><meta charset="utf-8">
<style>
  body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);padding:8px;font-size:13px}
  input,select{width:100%;box-sizing:border-box;margin-bottom:6px;padding:6px 8px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:4px}
  .stats{color:var(--vscode-descriptionForeground);font-size:11px;margin:4px 0 8px}
  .card{border:1px solid var(--vscode-panel-border,#3334);border-radius:6px;padding:8px;margin-bottom:8px;cursor:pointer}
  .card:hover{background:var(--vscode-list-hoverBackground)}
  .meta{font-size:11px;color:var(--vscode-descriptionForeground);display:flex;gap:8px;flex-wrap:wrap;margin-bottom:4px}
  .ws{color:var(--vscode-charts-green)}.model{color:var(--vscode-charts-purple)}
  .hits{background:var(--vscode-charts-yellow);color:#000;border-radius:8px;padding:0 6px;font-weight:700}
  .snip{color:var(--vscode-descriptionForeground);font-size:12px;line-height:1.5}
  mark{background:var(--vscode-editor-findMatchHighlightBackground,#f2cc60);color:inherit}
  .empty{color:var(--vscode-descriptionForeground);text-align:center;padding:20px}
</style></head><body>
<input id="q" placeholder="Search all chats…" autofocus>
<select id="ws"><option value="">All workspaces</option></select>
<select id="model"><option value="">All models</option></select>
<div class="stats" id="stats">Indexing…</div>
<div id="results"></div>
<script>
const vscode = acquireVsCodeApi();
let SESSIONS = [];
const $ = id => document.getElementById(id);
function esc(s){return String(s).split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;');}
function snip(text,term){
  const lt=text.toLowerCase(), tt=term.toLowerCase();
  const i=lt.indexOf(tt); if(i<0) return '';
  const a=Math.max(0,i-50), b=Math.min(text.length,i+term.length+90);
  return (a>0?'…':'')+esc(text.slice(a,i))+'<mark>'+esc(text.slice(i,i+term.length))+'</mark>'+esc(text.slice(i+term.length,b))+(b<text.length?'…':'');
}
function fillSelect(sel,vals){[...new Set(vals)].sort().forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;sel.appendChild(o);});}
function render(){
  const term=$('q').value.trim(),fw=$('ws').value,fm=$('model').value;
  let list=SESSIONS;
  if(fw)list=list.filter(s=>s.ws===fw);
  if(fm)list=list.filter(s=>s.model===fm);
  if(term){const t=term.toLowerCase();list=list.map(s=>({s,h:s.text.toLowerCase().split(t).length-1})).filter(x=>x.h>0).sort((a,b)=>b.h-a.h).map(x=>Object.assign({},x.s,{h:x.h}));}
  else list=list.map(s=>Object.assign({},s,{h:0}));
  $('stats').textContent=list.length+' of '+SESSIONS.length+' sessions';
  if(!list.length){$('results').innerHTML='<div class="empty">No matches.</div>';return;}
  window.__list=list;
  $('results').innerHTML=list.slice(0,200).map((s,i)=>
    '<div class="card" data-i="'+i+'">'
    +'<div class="meta"><b>'+s.date+'</b><span class="ws">🗂️ '+esc(s.ws)+'</span><span class="model">🤖 '+esc(s.model)+'</span>'
    +(term?'<span class="hits">'+s.h+'</span>':'')+'</div>'
    +(term?'<div class="snip">'+snip(s.text,term)+'</div>':'')+'</div>').join('');
  document.querySelectorAll('.card').forEach(c=>c.addEventListener('click',()=>{const s=window.__list[+c.dataset.i];vscode.postMessage({type:'open',id:s.id,path:s.path,ws:s.ws});}));
}
['q','ws','model'].forEach(id=>$(id).addEventListener('input',render));
window.addEventListener('message',e=>{const m=e.data;if(m.type==='index'){SESSIONS=m.data||[];fillSelect($('ws'),SESSIONS.map(s=>s.ws));fillSelect($('model'),SESSIONS.map(s=>s.model));$('stats').textContent=SESSIONS.length+' sessions indexed';render();}else if(m.type==='error'){$('stats').textContent='Error: '+m.message;}});
vscode.postMessage({type:'ready'});
</script></body></html>`;
    }
}

function transcriptHtml(turns: { role: string; text: string }[], title: string): string {
    const json = JSON.stringify(turns);
    return /* html */ `<!doctype html><html><head><meta charset="utf-8">
<style>
  body{margin:0;font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background)}
  header{position:sticky;top:0;background:var(--vscode-editor-background);border-bottom:1px solid var(--vscode-panel-border,#3334);padding:10px 16px;font-size:14px}
  main{max-width:860px;margin:0 auto;padding:16px}
  .turn{display:flex;margin:10px 0}.turn.user{justify-content:flex-end}
  .bubble{max-width:82%;padding:10px 14px;border-radius:12px;font-size:13px;line-height:1.55;white-space:pre-wrap;word-wrap:break-word}
  .user .bubble{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border-bottom-right-radius:3px}
  .assistant .bubble{background:var(--vscode-input-background);border:1px solid var(--vscode-panel-border,#3334);border-bottom-left-radius:3px}
  .role{font-size:10px;color:var(--vscode-descriptionForeground);margin:0 6px 3px;text-transform:uppercase}
  .bubble h1,.bubble h2,.bubble h3{font-size:14px;margin:8px 0 3px}
  .bubble code{background:var(--vscode-textCodeBlock-background,#0b0f14);padding:1px 5px;border-radius:4px;font-family:var(--vscode-editor-font-family,monospace)}
  .bubble strong{color:var(--vscode-foreground)}
  .count{color:var(--vscode-descriptionForeground);font-size:12px;margin-left:8px}
</style></head><body>
<header>💬 ${escapeHtml(title)} <span class="count" id="c"></span></header>
<main id="chat"></main>
<script>
const TURNS=${json};
function esc(s){return s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
function md(s){s=esc(s);s=s.replace(/^### (.*)$/gm,'<h3>$1</h3>').replace(/^## (.*)$/gm,'<h2>$1</h2>').replace(/^# (.*)$/gm,'<h1>$1</h1>');s=s.replace(/\\*\\*([^*]+)\\*\\*/g,'<strong>$1</strong>');s=s.replace(/\`([^\`]+)\`/g,'<code>$1</code>');return s;}
document.getElementById('c').textContent=TURNS.length+' messages';
document.getElementById('chat').innerHTML=TURNS.map(t=>'<div class="turn '+t.role+'"><div><div class="role">'+(t.role==='user'?'You':'Copilot')+'</div><div class="bubble">'+md(t.text||'')+'</div></div></div>').join('');
</script></body></html>`;
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
}
