import { signIn } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminLoginPage({
  searchParams,
}: LoginPageProps) {
  const { error } = await searchParams;

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="admin-login-title">
        <p className="sl-system-label page-eyebrow">Storyloop internal</p>
        <h1 id="admin-login-title">Admin sign in</h1>
        <p className="page-copy">
          Restricted to authorised Storyloop team members.
        </p>

        <form action={signIn} className="auth-form">
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </label>

          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>

          {error ? (
            <div className="auth-error" role="alert">
              {error === "missing"
                ? "Enter both email and password."
                : "Sign-in failed. Check your credentials."}
            </div>
          ) : null}

          <button className="primary-button" type="submit">
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
