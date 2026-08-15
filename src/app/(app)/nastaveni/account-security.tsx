"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast/toast";
import { apiUrl } from "@/lib/base-path";
import { postJson } from "@/lib/client/post-json";

interface Member {
  id: number;
  name: string;
  email: string | null;
  hasPassword: boolean;
}

/**
 * Password change, and a way to hand another member a set-password link.
 *
 * Both live on one card because they answer the same question — "how does
 * someone get in" — and because the second one only exists thanks to the first
 * one's absence having locked the household out of its own app.
 */
export function AccountSecurity({
  me,
  members,
  emailConfigured,
}: {
  me: { id: number; name: string };
  members: Member[];
  emailConfigured: boolean;
}) {
  const router = useRouter();
  const toast = useToast();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [saving, setSaving] = useState(false);

  const [issued, setIssued] = useState<{ name: string; link: string } | null>(null);
  const [issuing, setIssuing] = useState<number | null>(null);

  const others = members.filter((member) => member.id !== me.id);

  return (
    <div className="crud">
      <form
        className="stack-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          const result = await postJson(apiUrl("/api/auth/change-password"), {
            current,
            next,
          });
          setSaving(false);

          if (!result.ok) {
            toast.show(result.error ?? "Nepovedlo se to.", { tone: "danger" });
            return;
          }
          setCurrent("");
          setNext("");
          toast.show("Heslo změněno. Ostatní zařízení se odhlásila.", {
            tone: "success",
          });
          router.refresh();
        }}
      >
        <div className="crud-fields">
          <label className="crud-field is-half">
            <span className="crud-label">Současné heslo</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
            />
          </label>
          <label className="crud-field is-half">
            <span className="crud-label">Nové heslo</span>
            <input
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
              value={next}
              onChange={(event) => setNext(event.target.value)}
            />
            <span className="crud-hint">aspoň 10 znaků</span>
          </label>
        </div>

        <div className="crud-form-actions">
          <button type="submit" className="is-primary" disabled={saving}>
            {saving ? "Měním…" : "Změnit heslo"}
          </button>
        </div>
      </form>

      {others.length > 0 ? (
        <>
          <p className="card-sub card-sub-inline">
            Když se někdo z domácnosti nemůže dostat dovnitř, vyrob mu odkaz.
            Platí hodinu a jde použít jednou
            {emailConfigured
              ? " — můžeš ho poslat mailem, nebo prostě ukázat."
              : ". E-maily nastavené nejsou, takže se ukáže tady a předáš ho, jak chceš."}
          </p>

          <ul className="crud-list">
            {others.map((member) => (
              <li key={member.id} className="crud-row">
                <span className="crud-main">
                  <span className="crud-title">{member.name}</span>
                  <span className="crud-meta">
                    {member.email ?? "bez e-mailu"} ·{" "}
                    {member.hasPassword ? "heslo nastavené" : "heslo zatím nemá"}
                  </span>
                </span>
                <span className="crud-actions">
                  <button
                    type="button"
                    className="crud-add"
                    disabled={issuing === member.id}
                    onClick={async () => {
                      setIssuing(member.id);
                      const result = await postJson<{ link: string; name: string }>(
                        apiUrl("/api/auth/member-link"),
                        { userId: member.id, alsoEmail: emailConfigured },
                      );
                      setIssuing(null);

                      if (!result.ok || !result.data) {
                        toast.show(result.error ?? "Nepovedlo se to.", {
                          tone: "danger",
                        });
                        return;
                      }
                      setIssued({ name: result.data.name, link: result.data.link });
                    }}
                  >
                    {issuing === member.id ? "Vyrábím…" : "Vyrobit odkaz"}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {issued ? (
        <div className="recovery-link">
          {/* Name first rather than "odkaz pro {jméno}" — Czech would need the
              accusative there and a template cannot decline a name. */}
          <p>
            <strong>{issued.name}</strong> — odkaz platí hodinu a jde použít
            jednou:
          </p>
          {/* Selectable rather than a link: this is meant to be copied or read
              out, and clicking it here would burn the token on the wrong person. */}
          <code>{issued.link}</code>
          <div className="crud-form-actions">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(issued.link);
                  toast.show("Odkaz zkopírovaný.", { tone: "success" });
                } catch {
                  toast.show("Zkopíruj ho ručně — schránka nedovolila zápis.");
                }
              }}
            >
              Zkopírovat
            </button>
            <button type="button" onClick={() => setIssued(null)}>
              Skrýt
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
