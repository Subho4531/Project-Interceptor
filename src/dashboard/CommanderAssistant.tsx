import { useEffect, useRef, useState } from 'react';
import { answerAssistant } from './assistant';
import type { AssistantReply, CommandResult, SelectedObject, SessionSnapshot, SimulationCommand } from './types';
import type { ExerciseState } from '../training/Exercise';
import { buildGuideContext, deriveStage, localGuide, requestModelGuide } from './commanderGuide';
import { assetUrl } from '../routing';

type Message = { id: number; role: 'user' | 'commander'; text: string; via: 'local' | 'model' };
type Props = {
  snapshot: SessionSnapshot;
  exercise: ExerciseState;
  selected: SelectedObject;
  onCommand: (value: SimulationCommand, source?: 'operator' | 'assistant', confirmed?: boolean) => CommandResult;
};
const AVATAR = assetUrl('./assets/ui/commander-icon.png');
const AUTO_STAGES = ['configure', 'watch', 'contact', 'investigate', 'assess', 'respond', 'review'];
const sessionClock = (time: number) => `${Math.floor(time / 60).toString().padStart(2, '0')}:${Math.floor(time % 60).toString().padStart(2, '0')}`;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Floating commander assistant. Draggable anywhere in the window (defaults to the top-right,
 *  double-click re-anchors). Guidance derives from neutral shared exercise state; the model
 *  proxy receives the same delivered evidence only — no hidden identity, route or rubric. */
export default function CommanderAssistant({ snapshot, exercise, selected, onCommand }: Props) {
  const [open, setOpen] = useState(true);
  const [provider, setProvider] = useState<'local' | 'model'>('local');
  const [quota, setQuota] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<AssistantReply | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, role: 'commander', text: 'SAARTHI online, Commander. This console follows the shared session clock — CONFIGURE, RUN, REVIEW. My guide tracks each step as evidence is delivered.', via: 'local' },
  ]);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef<{ dx: number; dy: number } | null>(null);
  const messageId = useRef(0);
  const lastAuto = useRef(0);
  const lastStage = useRef('');
  const logEnd = useRef<HTMLDivElement>(null);
  const stageInfo = deriveStage(snapshot, exercise);
  useEffect(() => {
    const log = logEnd.current?.parentElement;
    log?.scrollTo({ top: log.scrollHeight, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [messages, thinking, pending]);
  function addMessage(role: Message['role'], text: string, via: Message['via'] = 'local') {
    setMessages(current => [...current, { id: ++messageId.current, role, text, via }].slice(-40));
  }
  async function guide(question?: string) {
    const context = buildGuideContext(snapshot, exercise);
    setThinking(true);
    const outcome = await requestModelGuide(context, question);
    setThinking(false);
    if (outcome?.text) { setProvider('model'); setQuota(false); addMessage('commander', outcome.text, 'model'); return; }
    if (outcome?.quota) setQuota(true);
    setProvider('local');
    addMessage('commander', question ? `${localGuide(stageInfo.stage, context)} You asked: “${question}” — I can only answer from the session state while the model link is down.` : localGuide(stageInfo.stage, context), 'local');
  }
  useEffect(() => {
    if (thinking || !AUTO_STAGES.includes(stageInfo.stage)) return;
    const stageChanged = lastStage.current !== stageInfo.stage;
    lastStage.current = stageInfo.stage;
    const now = Date.now();
    if (!stageChanged && now - lastAuto.current < 20000) return;
    lastAuto.current = now;
    void guide();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageInfo.stage, stageInfo.key, thinking]);
  function ask(text: string) {
    if (!text.trim()) return;
    addMessage('user', text.trim());
    setInput('');
    setPending(null);
    const reply = answerAssistant(text, snapshot, selected);
    if (reply.confirmation) { setPending(reply); addMessage('commander', reply.text); return; }
    if (reply.command) {
      const result = onCommand(reply.command, 'assistant');
      addMessage('commander', `[Session · ${sessionClock(snapshot.time)}] ${result.ok ? 'Applied: ' : 'Not applied: '}${result.message}`);
      return;
    }
    const context = buildGuideContext(snapshot, exercise);
    void (async () => {
      setThinking(true);
      const outcome = await requestModelGuide(context, text);
      setThinking(false);
      if (outcome?.text) { setProvider('model'); setQuota(false); addMessage('commander', outcome.text, 'model'); }
      else { if (outcome?.quota) setQuota(true); addMessage('commander', reply.text); }
    })();
  }
  function startDrag(event: React.PointerEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest('button,input')) return;
    const dock = event.currentTarget.parentElement;
    if (!dock) return;
    const rect = dock.getBoundingClientRect();
    setPosition({ x: rect.left, y: rect.top });
    dragOffset.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveDrag(event: React.PointerEvent<HTMLElement>) {
    if (!dragOffset.current) return;
    const width = event.currentTarget.parentElement?.offsetWidth ?? 292;
    setPosition({
      x: clamp(event.clientX - dragOffset.current.dx, 6, Math.max(6, window.innerWidth - width - 6)),
      y: clamp(event.clientY - dragOffset.current.dy, 6, Math.max(6, window.innerHeight - 64)),
    });
  }
  function endDrag(event: React.PointerEvent<HTMLElement>) {
    if (!dragOffset.current) return;
    dragOffset.current = null;
    setDragging(false);
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* capture already released */ }
  }
  const floatingStyle = position ? { left: `${position.x}px`, top: `${position.y}px`, right: 'auto' } as const : undefined;
  return <section className={'commander-dock' + (dragging ? ' dragging' : '') + (open ? '' : ' cmdr-min')} style={floatingStyle} aria-label="Commander support assistant">
    <header className="cmdr-head" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onLostPointerCapture={endDrag}
      onDoubleClick={() => setPosition(null)} title="Drag to move · double-click to re-anchor">
      <img src={AVATAR} alt="" draggable={false} aria-hidden="true" />
      <div><h2>SAARTHI</h2><small>CMDR ASSISTANT · {stageInfo.label}</small></div>
      <span className="cmdr-via" title={provider === 'model' ? 'Live model guidance' : quota ? 'Model key quota exhausted — local rules' : 'Local deterministic guidance'}>{provider === 'model' ? 'MODEL' : 'LOCAL'}</span>
      <button className="cmdr-min-button" type="button" onPointerDown={event => event.stopPropagation()} onClick={() => setOpen(value => !value)}
        aria-expanded={open} aria-controls="cmdr-body" aria-label={open ? 'Collapse commander assistant' : 'Expand commander assistant'}>{open ? '▾' : '▴'}</button>
    </header>
    {open && <div className="cmdr-body" id="cmdr-body">
      <div className="cmdr-messages" role="log" aria-label="Commander guidance" aria-live="polite">
        {messages.map(message => <article className={`cmdr-message ${message.role}`} key={message.id}>
          {message.role === 'commander' && <img src={AVATAR} alt="" draggable={false} aria-hidden="true" />}
          <div className="cm-speech"><span>{message.role === 'commander' ? 'SAARTHI' : 'YOU'}{message.role === 'commander' ? ` · ${message.via.toUpperCase()}` : ''}</span><p>{message.text}</p></div>
        </article>)}
        {thinking && <div className="cmdr-message thinking" aria-label="Commander is thinking"><img src={AVATAR} alt="" draggable={false} aria-hidden="true" /><div className="cm-speech"><span>SAARTHI</span><p>Assessing the current step…</p></div></div>}
        <div ref={logEnd} />
      </div>
      {pending && <div className="assistant-confirm cmdr-confirm"><span>Confirm session change</span>
        <button type="button" onClick={() => { if (pending.command) { const result = onCommand(pending.command, 'assistant', true); addMessage('commander', `${result.ok ? 'Applied: ' : 'Not applied: '}${result.message}`); } setPending(null); }}>Confirm</button>
        <button type="button" onClick={() => { setPending(null); addMessage('commander', 'Cancelled. Session retained.'); }}>Cancel</button>
      </div>}
      <div className="cmdr-quick">
        <button type="button" onClick={() => void guide()}>Guide this step</button>
        <button type="button" onClick={() => ask('Summarise this post')}>Brief post</button>
        <button type="button" onClick={() => ask('Radar status')}>Radar status</button>
        <button type="button" onClick={() => ask('Explain the last event')}>Last event</button>
      </div>
      <form onSubmit={event => { event.preventDefault(); ask(input); }}>
        <input aria-label="Ask the commander assistant" value={input} maxLength={500} onChange={event => setInput(event.target.value)} placeholder="Ask your commander…" />
        <button type="submit" disabled={!input.trim()} aria-label="Send message">↑</button>
      </form>
      <small className="cmdr-foot">{quota ? 'Model quota exhausted — local commander rules active until the key resets.' : 'Guidance uses delivered training evidence only · decisions stay operator-owned'}</small>
    </div>}
  </section>;
}
