/**
 * What a navigation shows while the server is thinking.
 *
 * Every screen behind the login is rendered per request, so without this the
 * click does nothing for a second or two and the app reads as frozen. Three
 * grey cards say "coming" without pretending to be content.
 */
export default function Loading() {
  return (
    <>
      <header className="page-head">
        <div>
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-sub" />
        </div>
      </header>
      <section className="card"><div className="skeleton skeleton-block" /></section>
      <section className="card"><div className="skeleton skeleton-block short" /></section>
      <section className="card"><div className="skeleton skeleton-block" /></section>
    </>
  );
}
