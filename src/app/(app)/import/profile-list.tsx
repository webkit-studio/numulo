"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast/toast";
import { apiUrl } from "@/lib/base-path";

/** Remembered CSV layouts. Deletable, like every other list in numo. */
export function ProfileList({
  profiles,
}: {
  profiles: { id: number; name: string; detail: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<number | null>(null);

  return (
    <ul className="crud-list">
      {profiles.map((profile) => (
        <li key={profile.id} className="crud-row">
          <span className="crud-main">
            <span className="crud-title">{profile.name}</span>
            <span className="crud-meta">{profile.detail}</span>
          </span>
          <span className="crud-actions">
            <button
              type="button"
              className="is-danger"
              aria-label={`Zapomenout formát ${profile.name}`}
              title="Zapomenout"
              disabled={busy === profile.id}
              onClick={async () => {
                setBusy(profile.id);
                const response = await fetch(
                  apiUrl(`/api/import/profiles?id=${profile.id}`),
                  { method: "DELETE" },
                );
                setBusy(null);

                if (!response.ok) {
                  toast.show("Nepovedlo se to.", { tone: "danger" });
                  return;
                }
                toast.show(`Formát „${profile.name}" zapomenut.`);
                router.refresh();
              }}
            >
              🗑
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}
