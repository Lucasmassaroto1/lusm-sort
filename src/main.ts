import './style.css';
import { COLORS, MAX_NAME_LENGTH, type Entry, type HistoryItem } from './types';
import { secureShuffle } from './random';
import { easeOut, indexAtPointer, mod, planSpin, TAU } from './spin';
import { winsByName } from './stats';
import { commitFor, makeProof, newSeed, verifyProof, type Proof } from './fair';
import { WheelRenderer } from './wheel';
import { SoundFx } from './audio';
import { Confetti } from './confetti';
import { loadSoundOn, loadState, saveSoundOn, saveState } from './storage';
import { icons, setButton } from './icons';

// ---------- Elementos ----------
function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Elemento #${id} não encontrado`);
  return node as T;
}

const ui = {
  wrap: el('wrap'),
  pointer: el('pointer'),
  wheel: el<HTMLCanvasElement>('wheel'),
  spin: el<HTMLButtonElement>('spin'),
  status: el('status'),
  input: el<HTMLTextAreaElement>('input'),
  addBtn: el<HTMLButtonElement>('addBtn'),
  msg: el('msg'),
  list: el<HTMLUListElement>('list'),
  count: el('count'),
  sound: el<HTMLButtonElement>('sound'),
  shuffle: el<HTMLButtonElement>('shuffle'),
  clear: el<HTMLButtonElement>('clear'),
  podium: el('podium'),
  stats: el('stats'),
  htabs: el('htabs'),
  tabHist: el<HTMLButtonElement>('tabHist'),
  tabStats: el<HTMLButtonElement>('tabStats'),
  hist: el<HTMLOListElement>('hist'),
  hcount: el('hcount'),
  year: el('year'),
  overlay: el('overlay'),
  winName: el('winName'),
  again: el<HTMLButtonElement>('again'),
  close: el<HTMLButtonElement>('close'),
  confetti: el<HTMLCanvasElement>('confetti'),
  proof: el('proof'),
  commit: el('commit'),
  copyCommit: el<HTMLButtonElement>('copyCommit'),
  word: el<HTMLInputElement>('word'),
  openVerify: el<HTMLButtonElement>('openVerify'),
  winProof: el('winProof'),
  winSeed: el('winSeed'),
  winCheck: el('winCheck'),
  copyProof: el<HTMLButtonElement>('copyProof'),
  verifyOverlay: el('verifyOverlay'),
  verifyInput: el<HTMLTextAreaElement>('verifyInput'),
  verifyResult: el<HTMLUListElement>('verifyResult'),
  verifyBtn: el<HTMLButtonElement>('verifyBtn'),
  verifyClose: el<HTMLButtonElement>('verifyClose'),
};

// ---------- Estado ----------
const saved = loadState();
let entries: Entry[] = saved.names.map(name => ({ name, color: COLORS[0] }));
let history: HistoryItem[] = saved.history;

/** Compromisso do próximo giro: semente secreta + nomes, já com o hash publicado. */
let pending: { seed: string; commit: string; names: string[] } | null = null;
let commitToken = 0;
/** Prova do último giro (para o botão "Copiar prova"). */
let lastProof: Proof | null = null;

const wheel = new WheelRenderer(ui.wheel);
const sfx = new SoundFx(loadSoundOn());
const confetti = new Confetti(ui.confetti);

// ---------- Utilidades ----------
const normalize = (s: string): string => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

let msgTimer: number | undefined;
function showMsg(text: string, ok = false): void {
  ui.msg.textContent = text;
  ui.msg.className = 'msg' + (ok ? ' ok' : '');
  clearTimeout(msgTimer);
  msgTimer = window.setTimeout(() => (ui.msg.textContent = ''), 3500);
}

/** Cores em sequência, evitando duas fatias vizinhas iguais (inclusive a última com a primeira). */
function recolor(): void {
  const L = COLORS.length;
  entries.forEach((e, i) => (e.color = COLORS[i % L]));
  const n = entries.length;
  if (n > 1 && entries[n - 1].color === entries[0].color) {
    for (let k = 1; k < L; k++) {
      const c = COLORS[(n - 1 + k) % L];
      if (c !== entries[0].color && c !== entries[n - 2].color) {
        entries[n - 1].color = c;
        break;
      }
    }
  }
}

// ---------- Render ----------
function renderList(): void {
  ui.list.innerHTML = '';
  if (!entries.length) ui.list.innerHTML = '<li class="empty">Nenhum nome ainda</li>';
  entries.forEach((entry, i) => {
    const li = document.createElement('li');
    li.style.animationDelay = `${Math.min(i * 20, 300)}ms`;
    li.innerHTML = `<span class="dot" style="background:${entry.color};color:${entry.color}"></span><span class="n"></span><button class="x" title="Remover">×</button>`;
    li.querySelector<HTMLElement>('.n')!.textContent = entry.name;
    li.querySelector<HTMLButtonElement>('.x')!.onclick = () => {
      if (wheel.spinning) return;
      li.classList.add('out');
      setTimeout(() => {
        entries = entries.filter(e => e !== entry);
        refresh();
      }, 280);
    };
    ui.list.appendChild(li);
  });
  ui.count.textContent = String(entries.length);
}

function renderHistory(): void {
  // Pódio: 1º no centro, 2º à esquerda, 3º à direita (na ordem em que foram sorteados)
  ui.podium.innerHTML = '';
  ([[1, 2], [0, 1], [2, 3]] as const).forEach(([index, place]) => {
    const h = history[index];
    if (!h) return;
    const div = document.createElement('div');
    div.className = `place p${place}`;
    div.innerHTML =
      (place === 1 ? `<span class="crown" aria-hidden="true">${icons.coroa}</span>` : '') +
      `<span class="pname"></span><span class="ptime">${escapeHtml(h.time)}</span><div class="block">${place}</div>`;
    div.querySelector<HTMLElement>('.pname')!.textContent = h.name;
    div.title = `${place}º · ${h.name}` + (h.proof ? ' · clique para verificar' : '');
    if (h.proof) { div.classList.add('has-proof'); div.onclick = () => openVerify(h.proof!); }
    ui.podium.appendChild(div);
  });
  ui.podium.hidden = history.length === 0;

  // Do 4º em diante: lista simples, sem numeração
  ui.hist.innerHTML = '';
  if (!history.length) ui.hist.innerHTML = '<li class="empty">Nenhum sorteio ainda</li>';
  history.slice(3).forEach(h => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="nm"></span><span class="t">${escapeHtml(h.time)}</span>`;
    li.querySelector<HTMLElement>('.nm')!.textContent = h.name;
    if (h.proof) { li.classList.add('has-proof'); li.title = 'Clique para verificar'; li.onclick = () => openVerify(h.proof!); }
    ui.hist.appendChild(li);
  });
  ui.hcount.textContent = String(history.length);
  renderStats();
}

function showTab(t: 'hist' | 'stats'): void {
  ui.hist.hidden = t !== 'hist';
  ui.stats.hidden = t !== 'stats';
  ui.tabHist.classList.toggle('on', t === 'hist');
  ui.tabStats.classList.toggle('on', t === 'stats');
  ui.tabHist.setAttribute('aria-selected', String(t === 'hist'));
  ui.tabStats.setAttribute('aria-selected', String(t === 'stats'));
}
ui.tabHist.onclick = () => showTab('hist');
ui.tabStats.onclick = () => showTab('stats');

/** Placar: quantas vezes cada nome ganhou e a % sobre o total de sorteios. */
function renderStats(): void {
  ui.stats.innerHTML = '';
  ui.htabs.hidden = history.length === 0;
  if (!history.length) showTab('hist');
  if (!history.length) return;

  const stats = winsByName(history, entries.map(e => e.name));
  const max = Math.max(...stats.map(s => s.wins), 1);
  const colorOf = new Map(entries.map(e => [e.name, e.color]));

  const title = document.createElement('div');
  title.className = 'stats-title';
  title.textContent = `Vitórias em ${history.length} ${history.length === 1 ? 'sorteio' : 'sorteios'}`;
  ui.stats.appendChild(title);

  for (const s of stats) {
    const row = document.createElement('div');
    row.className = 'srow' + (colorOf.has(s.name) ? '' : ' gone');
    row.title = colorOf.has(s.name) ? s.name : `${s.name} (fora da roleta)`;
    row.innerHTML =
      `<span class="sname"></span>` +
      `<span class="sbar"><span class="sfill"></span></span>` +
      `<span class="snum">${s.wins} <small>${s.pct.toFixed(0)}%</small></span>`;
    row.querySelector<HTMLElement>('.sname')!.textContent = s.name;
    const fill = row.querySelector<HTMLElement>('.sfill')!;
    fill.style.width = `${(s.wins / max) * 100}%`;
    fill.style.background = colorOf.get(s.name) ?? 'var(--muted)';
    ui.stats.appendChild(row);
  }
}

function updateStatus(): void {
  const n = entries.length;
  const ready = n >= 2 && !wheel.spinning && pending !== null;
  ui.spin.disabled = !ready;
  ui.spin.classList.toggle('pulse', ready);
  ui.word.disabled = wheel.spinning;
  if (wheel.spinning) ui.status.innerHTML = `Girando… boa sorte! ${icons.trevo}`;
  else if (n === 0) ui.status.innerHTML = 'Adicione pelo menos <b>2 nomes</b> para girar.';
  else if (n === 1) ui.status.innerHTML = `Só resta <b>${escapeHtml(entries[0].name)}</b>. Adicione mais nomes para girar.`;
  else ui.status.innerHTML = '';
}

function persist(): void {
  saveState({ names: entries.map(e => e.name), history });
}

function refresh(): void {
  recolor();
  renderList();
  renderHistory();
  updateStatus();
  wheel.draw(entries);
  persist();
  void prepareCommit();
}

// ---------- Sorteio verificável ----------
/**
 * Gera semente nova e publica o compromisso para a lista ATUAL.
 * Chamado sempre que a lista muda e depois de cada giro, então o compromisso
 * mostrado na tela é sempre o que vale para o próximo giro.
 */
async function prepareCommit(): Promise<void> {
  const token = ++commitToken;
  pending = null;
  const names = entries.map(e => e.name);
  ui.proof.hidden = names.length < 2;
  ui.commit.textContent = 'gerando…';
  updateStatus();
  if (names.length < 2) return;
  const seed = newSeed();
  const commit = await commitFor(seed, names);
  if (token !== commitToken) return; // a lista mudou enquanto calculava
  pending = { seed, commit, names };
  ui.commit.textContent = commit;
  updateStatus();
}

async function copyText(text: string, okMsg: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    showMsg(okMsg, true);
  } catch {
    showMsg('Não foi possível copiar. Selecione o texto e copie manualmente.');
  }
}

ui.copyCommit.onclick = () => { if (pending) void copyText(pending.commit, 'Compromisso copiado!'); };
ui.copyProof.onclick = () => { if (lastProof) void copyText(JSON.stringify(lastProof), 'Prova copiada!'); };

function openVerify(proof?: Proof): void {
  ui.verifyResult.innerHTML = '';
  if (proof) ui.verifyInput.value = JSON.stringify(proof, null, 2);
  ui.verifyOverlay.classList.add('show');
  if (proof) void runVerify();
  else ui.verifyInput.focus();
}
function closeVerify(): void { ui.verifyOverlay.classList.remove('show'); }

async function runVerify(): Promise<void> {
  ui.verifyResult.innerHTML = '';
  const add = (text: string, ok: boolean, total = false): void => {
    const li = document.createElement('li');
    li.className = (ok ? 'ok' : 'bad') + (total ? ' total' : '');
    li.textContent = text;
    ui.verifyResult.appendChild(li);
  };
  let data: Partial<Proof>;
  try {
    data = JSON.parse(ui.verifyInput.value) as Partial<Proof>;
  } catch {
    add('Isso não é um JSON válido.', false, true);
    return;
  }
  const r = await verifyProof(data);
  r.checks.forEach(c => add(c.label, c.ok));
  add(r.ok ? 'Sorteio válido.' : 'Sorteio NÃO confere.', r.ok, true);
}

ui.openVerify.onclick = () => openVerify();
ui.verifyBtn.onclick = () => void runVerify();
ui.verifyClose.onclick = closeVerify;
ui.verifyOverlay.addEventListener('click', e => { if (e.target === ui.verifyOverlay) closeVerify(); });

// ---------- Adicionar nomes ----------
function autoGrow(): void {
  ui.input.style.height = 'auto';
  ui.input.style.height = `${Math.min(ui.input.scrollHeight, 180)}px`;
}

function addNames(): void {
  if (wheel.spinning) return;
  const parts = ui.input.value
    .split(/[\n,;]+/)
    .map(s => s.trim().replace(/\s+/g, ' '))
    .filter(Boolean);
  if (!parts.length) return;

  const existing = new Set(entries.map(e => normalize(e.name)));
  const ignored: string[] = [];
  let added = 0;
  for (const p of parts) {
    const key = normalize(p);
    if (existing.has(key)) { ignored.push(p); continue; }
    if (p.length > MAX_NAME_LENGTH) { ignored.push(p.slice(0, 20) + '…'); continue; }
    existing.add(key);
    entries.push({ name: p, color: COLORS[0] });
    added++;
  }
  ui.input.value = '';
  autoGrow();
  refresh();
  if (ignored.length) {
    showMsg(`Ignorado (já existe ou muito longo): ${ignored.slice(0, 4).join(', ')}${ignored.length > 4 ? '…' : ''}`);
  } else if (added > 1) {
    showMsg(`${added} nomes adicionados!`, true);
  }
}

ui.addBtn.onclick = addNames;
ui.input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNames(); }
});
ui.input.addEventListener('input', autoGrow);
ui.input.addEventListener('paste', () =>
  setTimeout(() => { if (/[\n,;]/.test(ui.input.value)) addNames(); }, 0));

// ---------- Botões ----------
function paintSound(): void {
  if (sfx.enabled) setButton(ui.sound, 'somLigado', 'Som ligado');
  else setButton(ui.sound, 'somDesligado', 'Som desligado');
}
ui.sound.onclick = () => {
  sfx.enabled = !sfx.enabled;
  saveSoundOn(sfx.enabled);
  paintSound();
  if (sfx.enabled) sfx.tick();
};

ui.shuffle.onclick = () => {
  if (wheel.spinning || entries.length < 2) return;
  secureShuffle(entries);
  ui.wheel.animate(
    [{ transform: 'scale(1) rotate(0)' }, { transform: 'scale(.92) rotate(-8deg)' }, { transform: 'scale(1) rotate(0)' }],
    { duration: 450, easing: 'cubic-bezier(.3,1.5,.5,1)' },
  );
  refresh();
  showMsg('Posições embaralhadas!', true);
};

let clearArmed = false;
let clearTimer: number | undefined;
function paintClear(): void {
  clearArmed = false;
  ui.clear.classList.remove('warn');
  setButton(ui.clear, 'limpar', 'Limpar');
}
ui.clear.onclick = () => {
  if (wheel.spinning) return;
  if (!clearArmed) {
    clearArmed = true;
    setButton(ui.clear, 'alerta', 'Clique de novo p/ confirmar');
    ui.clear.classList.add('warn');
    clearTimer = window.setTimeout(paintClear, 3000);
    return;
  }
  clearTimeout(clearTimer);
  paintClear();
  entries = [];
  history = [];
  wheel.rotation = 0;
  refresh();
  showMsg('Tudo limpo.', true);
};

// ---------- Giro ----------
async function spin(): Promise<void> {
  if (wheel.spinning || entries.length < 2 || !pending) return;
  const names = entries.map(e => e.name);
  // Segurança extra: o compromisso precisa ser exatamente da lista que está na roleta.
  if (JSON.stringify(names) !== JSON.stringify(pending.names)) { void prepareCommit(); return; }
  sfx.unlock();
  const n = entries.length;
  wheel.spinning = true;
  ui.wrap.classList.add('spinning');
  updateStatus();

  // O vencedor sai da semente já comprometida + palavra do público, antes da animação.
  const proof = await makeProof(pending.seed, pending.names, ui.word.value.trim());
  const plan = planSpin(wheel.rotation, n, undefined, proof.index);

  const t0 = performance.now();
  let lastIdx = indexAtPointer(wheel.rotation, n);

  const frame = (now: number): void => {
    const t = Math.min(1, (now - t0) / plan.duration);
    wheel.rotation = plan.from + (plan.to - plan.from) * easeOut(t);
    const idx = indexAtPointer(wheel.rotation, n);
    if (idx !== lastIdx) {
      lastIdx = idx;
      sfx.tick();
      ui.pointer.classList.remove('tick');
      void ui.pointer.getBoundingClientRect(); // reinicia a animação
      ui.pointer.classList.add('tick');
    }
    wheel.bulbPhase = Math.floor(now / 90);
    wheel.draw(entries);
    if (t < 1) requestAnimationFrame(frame);
    else finish(plan.winner, proof);
  };
  requestAnimationFrame(frame);
}

function finish(winnerIndex: number, proof: Proof): void {
  const n = entries.length;
  const landed = indexAtPointer(wheel.rotation, n);
  if (landed !== winnerIndex) console.warn('LUSM: ponteiro fora do vencedor sorteado', { landed, winnerIndex });
  const winner = entries[landed];

  // Volta a rotação para [0, 2π): mesma posição na tela, mas o número não cresce a cada giro.
  wheel.rotation = mod(wheel.rotation, TAU);
  wheel.spinning = false;
  ui.wrap.classList.remove('spinning');
  const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  history.push({ name: winner.name, n: history.length + 1, time, proof });
  renderHistory();
  persist();

  // Revela a semente e já confere na hora.
  lastProof = proof;
  ui.winProof.hidden = false;
  ui.winSeed.textContent = proof.seed;
  ui.winCheck.className = 'pok';
  ui.winCheck.textContent = 'Conferindo…';
  void verifyProof(proof).then(r => {
    ui.winCheck.className = 'pok' + (r.ok ? '' : ' bad');
    ui.winCheck.textContent = r.ok ? '✔ Bate com o compromisso publicado antes do giro' : '✘ Não confere';
  });
  ui.word.value = '';
  void prepareCommit(); // novo compromisso para o próximo giro

  ui.winName.textContent = winner.name;
  ui.overlay.classList.add('show');
  sfx.win();
  confetti.burst(winner.color);
  updateStatus();
}

function closeModal(): void {
  ui.overlay.classList.remove('show');
}

ui.spin.onclick = () => void spin();
ui.close.onclick = closeModal;
ui.again.onclick = () => { closeModal(); setTimeout(() => void spin(), 450); };
ui.overlay.addEventListener('click', e => { if (e.target === ui.overlay) closeModal(); });
document.addEventListener('keydown', e => {
  const open = ui.overlay.classList.contains('show');
  const vOpen = ui.verifyOverlay.classList.contains('show');
  if (e.key === 'Escape' && open) closeModal();
  if (e.key === 'Escape' && vOpen) closeVerify();
  const typing = ['TEXTAREA', 'INPUT'].includes(document.activeElement?.tagName ?? '');
  if (e.code === 'Space' && !open && !vOpen && !typing) {
    e.preventDefault();
    void spin();
  }
});

// ---------- Lâmpadas piscando em repouso ----------
setInterval(() => {
  if (!wheel.spinning) {
    wheel.bulbPhase++;
    wheel.draw(entries);
  }
}, 350);

// ---------- Início ----------
ui.year.textContent = String(new Date().getFullYear());
paintSound();
paintClear();
setButton(ui.shuffle, 'embaralhar', 'Embaralhar posições');
refresh();
void document.fonts?.ready.then(() => wheel.draw(entries));
