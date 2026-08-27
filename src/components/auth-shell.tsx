/**
 * The frame every signed-out screen shares.
 *
 * Wordmark, one sentence of orientation, then the form. Nothing else — these
 * screens exist to be got through, not read.
 */
export function AuthShell({
  title,
  lede,
  notice,
  children,
}: {
  title: string;
  lede?: string;
  notice?: string | null;
  children: React.ReactNode;
}) {
  return (
    <main className="auth-screen">
      <div className="auth-card fade">
        <span className="auth-wordmark">numulo</span>
        <h1 className="auth-title">{title}</h1>
        {lede ? <p className="auth-lede">{lede}</p> : null}
        {notice ? <p className="auth-notice">{notice}</p> : null}
        {children}
      </div>
    </main>
  );
}
