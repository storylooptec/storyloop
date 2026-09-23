export default function AdminUnauthorizedPage() {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="sl-system-label page-eyebrow">Access restricted</p>
        <h1>Admin access unavailable</h1>
        <p className="page-copy">
          Your account is authenticated but does not have an active Storyloop
          team membership.
        </p>
      </section>
    </main>
  );
}
