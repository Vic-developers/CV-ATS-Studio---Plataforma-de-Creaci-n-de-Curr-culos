"use client";
import { useEffect, useState, type FormEvent } from "react";
import { BadgeCheck, FileCheck2, Fingerprint, ScanLine } from "lucide-react";
import { api, message, payload } from "./client";
import { Brand, Notice } from "./primitives";

type Mode = "login" | "register" | "forgot" | "reset";
const titles: Record<Mode, string> = {
  login: "Inicia sesión",
  register: "Crea tu cuenta",
  forgot: "Recupera tu contraseña",
  reset: "Elige una contraseña nueva",
};
const descriptions: Record<Mode, string> = {
  login: "Accede a tu espacio de trabajo y continúa con tu CV.",
  register: "Crea, organiza y adapta tus currículums en un solo lugar.",
  forgot: "Te enviaremos un enlace para recuperar tu acceso.",
  reset: "Usa una contraseña de al menos 12 caracteres.",
};
export function AuthScreen({ initial = "login" }: { initial?: Mode }) {
  const [mode, setMode] = useState<Mode>(initial);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (initial === "forgot" && /^[\w-]{43}$/.test(hash)) {
      setToken(hash);
      setMode("reset");
      history.replaceState(null, "", location.pathname);
    }
  }, [initial]);
  const switchTo = (next: Mode) => {
    setMode(next);
    setError("");
    setSent(false);
  };
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      await api(
        "/auth/" + mode,
        payload({
          email: form.get("email"),
          password: form.get("password"),
          token,
        }),
      );
      if (mode === "forgot" || mode === "reset") setSent(true);
      else window.location.assign("/");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <section className="auth-main">
        <Brand />
        <div className="auth-center">
          <div className="auth-mark">
            <Fingerprint size={27} />
          </div>
          <h1>{titles[mode]}</h1>
          <p className="muted">{descriptions[mode]}</p>
          {error && <Notice>{error}</Notice>}
          {sent ? (
            <Notice kind="success">
              {mode === "reset"
                ? "Tu contraseña se actualizó. Ya puedes iniciar sesión."
                : "Si el correo pertenece a una cuenta, recibirás un enlace de recuperación."}
            </Notice>
          ) : (
            <form key={mode} onSubmit={submit} className="stack auth-form">
              {mode !== "reset" && (
                <label>
                  Correo electrónico
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="tu@correo.com"
                    required
                    maxLength={254}
                  />
                </label>
              )}
              {mode !== "forgot" && (
                <label>
                  Contraseña
                  <input
                    name="password"
                    type="password"
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    minLength={12}
                    maxLength={128}
                    placeholder="Al menos 12 caracteres"
                    required
                  />
                </label>
              )}
              {mode === "login" && (
                <button
                  className="link-button align-right"
                  type="button"
                  onClick={() => switchTo("forgot")}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              )}
              <button className="button primary auth-submit" disabled={busy}>
                {busy
                  ? "Procesando…"
                  : mode === "forgot"
                    ? "Enviar enlace"
                    : mode === "reset"
                      ? "Guardar contraseña"
                      : mode === "register"
                        ? "Crear cuenta"
                        : "Iniciar sesión"}
              </button>
            </form>
          )}
          <div className="auth-switch">
            {mode === "login" ? (
              <>
                ¿Primera vez aquí?{" "}
                <button
                  className="link-button"
                  onClick={() => switchTo("register")}
                >
                  Crea una cuenta
                </button>
              </>
            ) : (
              <button
                className="link-button"
                onClick={() =>
                  initial === "forgot"
                    ? window.location.assign("/")
                    : switchTo("login")
                }
              >
                Volver a iniciar sesión
              </button>
            )}
          </div>
        </div>
        <div className="auth-footer">
          © {new Date().getFullYear()} CV ATS Studio
        </div>
      </section>
      <aside className="auth-aside">
        <div className="auth-grid" />
        <div className="hero-content">
          <div className="hero-art" aria-hidden="true">
            <div className="art-paper back-paper" />
            <div className="art-paper front-paper">
              <div className="art-avatar">
                <FileCheck2 size={28} />
              </div>
              <div className="art-heading" />
              <div className="art-line short" />
              <div className="art-rule" />
              <div className="art-line" />
              <div className="art-line" />
              <div className="art-line short" />
              <div className="art-rule" />
              <div className="art-line" />
              <div className="art-line short" />
            </div>
            <div className="art-badge">
              <ScanLine size={20} /> Análisis ATS
            </div>
            <div className="art-check">
              <BadgeCheck size={24} />
            </div>
          </div>
          <h2>
            Tu experiencia.
            <br />
            Un CV para cada oportunidad.
          </h2>
          <p>
            Crea un currículum claro, revisa su preparación ATS y adapta tu
            candidatura a cada oferta.
          </p>
        </div>
      </aside>
    </main>
  );
}
