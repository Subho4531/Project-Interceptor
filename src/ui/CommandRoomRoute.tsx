import { useEffect, useRef, useState } from 'react';
import { CommandRoom } from '../rendering/CommandRoom';
import { useSession, useSessionSnapshot } from '../session/SessionContext';
import { appLink } from '../routing';
import { postById } from '../dashboard/posts';
import BrandIcon from './BrandIcon';
import './room.css';

export default function CommandRoomRoute({ paneVisible = true }: { paneVisible?: boolean }) {
  const controller = useSession();
  const session = useSessionSnapshot();
  const canvas = useRef<HTMLCanvasElement>(null);
  const room = useRef<CommandRoom | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!canvas.current) return;
    setReady(false);
    setError('');
    try {
      room.current = new CommandRoom(canvas.current, controller, {
        ready: () => setReady(true),
        error: setError,
        xr: setSupported,
        notice: setNotice,
      });
      if (!paneVisible) room.current.setVisible(false);
    } catch (reason) {
      setError(String(reason));
    }
    return () => {
      room.current?.dispose();
      room.current = undefined;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, session.postId]);

  // Keep-alive parking: flip the render loop instead of rebuilding the room on every view change.
  useEffect(() => { room.current?.setVisible(paneVisible); }, [paneVisible, ready]);

  const post = postById(session.postId);

  return (
    <main className="room-route">
      <canvas ref={canvas} aria-label="Interactive imported 3D tactical command room" />

      {/* Tactical Top Bar */}
      <header className="room-topbar">
        <div className="room-brand">
          <div className="room-brand-mark"><BrandIcon size={26} /></div>
          <div>
            <strong>PROJECT INTERCEPTOR</strong>
            <small>SEATED C2 COMMAND POST · {post.name.toUpperCase()} / {post.region.toUpperCase()}</small>
          </div>
        </div>

        <div className="room-telemetry">
          <span className={`room-pill pill-${session.status}`}>
            {session.status.toUpperCase()}
          </span>
          <span className="room-pill pill-mode">
            {session.trainingMode?.toUpperCase()} · LVL {session.level}
          </span>
          <span className="room-pill pill-clock">
            {Math.floor(session.time)}s
          </span>
        </div>

        <nav className="room-nav">
          <a href={appLink('progress')} className="room-nav-btn">Curriculum</a>
          <a href={appLink('dashboard')} className="room-nav-btn">Command Console</a>
        </nav>
      </header>

      {/* Loading overlay if asset loading */}
      {!ready && (
        <section className="room-loading" role="status">
          <h1>{error ? 'Command Room Unavailable' : 'Initializing Tactical Command Post…'}</h1>
          <p>{error || 'Assembling imported Kenney PBR modules, radar scope, and shared C2 monitor telemetry.'}</p>
          <a href={appLink('dashboard')}>Open command dashboard</a>
        </section>
      )}

      {/* Bottom Tactical Controls Bar */}
      <footer className="room-footer">
        <div className="room-footer-guide">
          <b>SEATED DESKTOP / PC OPENXR COMMAND POST</b>
          <span>Drag to look around workstation. Click monitor controls directly with pointer ray or WebXR controller.</span>
          <small>Furniture Kit by Kenney · CC0. Fictional 3D room assembled from imported PBR modules.</small>
        </div>

        <div className="room-footer-actions">
          <button
            type="button"
            className="room-btn room-btn-primary"
            onClick={() => room.current?.recenter()}
          >
            Recenter View ⌖
          </button>

          {session.status === 'running' ? (
            <button
              type="button"
              className="room-btn"
              onClick={() => controller.command({ type: 'pause', reason: 'room-operator' })}
            >
              Pause ⏸
            </button>
          ) : (
            <button
              type="button"
              className="room-btn"
              onClick={() => controller.command({ type: session.status === 'ready' ? 'start' : 'resume' })}
            >
              {session.status === 'ready' ? 'Start Exercise ▶' : 'Resume ▶'}
            </button>
          )}

          <button
            type="button"
            className="room-btn"
            disabled={!ready || !supported}
            onClick={() => void room.current?.enterVR().catch((reason) => setNotice(String(reason)))}
          >
            {supported ? 'Enter PC VR 🥽' : 'VR Unavailable'}
          </button>

          <a href={appLink('dashboard')} className="room-btn room-btn-accent">
            Open Assessment &amp; AAR ↗
          </a>
        </div>

        {notice && <div className="room-footer-notice" role="status">{notice}</div>}
      </footer>
    </main>
  );
}
