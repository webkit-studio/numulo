"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { runImport, type ImportResult } from "@/app/actions/import";

const empty: ImportResult = { error: null };

/**
 * The drop area, the note about the file, and Zpracovat.
 *
 * The note beside the file matters more than it looks: "karta 4321 je Věrky,
 * převody na spořicí ignoruj" is the household's own knowledge about their own
 * statement, and it is the only thing the column mapping cannot work out on
 * its own.
 */
export function Upload({ householdId }: { householdId: string }) {
  const [state, action] = useActionState(runImport, empty);
  const [file, setFile] = useState<File | null>(null);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form action={action} className="import-form">
      <input type="hidden" name="householdId" value={householdId} />

      <div
        className={`dropzone${over ? " is-over" : ""}${file ? " has-file" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          const dropped = event.dataTransfer.files[0];
          if (!dropped || !inputRef.current) return;
          // Hand the file to the real input so the form submits it.
          const transfer = new DataTransfer();
          transfer.items.add(dropped);
          inputRef.current.files = transfer.files;
          setFile(dropped);
        }}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          name="file"
          accept=".csv,text/csv,text/plain"
          className="visually-hidden"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        {file ? (
          <p className="dropzone-file">{file.name}</p>
        ) : (
          <>
            <p className="dropzone-lead">Přetáhni výpis sem</p>
            <p className="dropzone-sub">nebo klikni a vyber soubor — <b>CSV</b></p>
          </>
        )}
      </div>

      <label className="field">
        <span className="field-label">Pokyny k souboru</span>
        <textarea
          className="input"
          name="instructions"
          rows={3}
          placeholder="např. Fio — společný účet. Karta 4321 je Věrky, ostatní Lukáše. Převody na spořicí účet ignoruj."
        />
      </label>

      {state.error ? <p className="form-error">{state.error}</p> : null}

      {state.batchId ? (
        <p className="form-notice">
          Hotovo — {state.filename}: přidáno {state.added}, duplicitní {state.duplicates},
          ke schválení {state.review}.
          {state.aiNote ? ` ${state.aiNote}.` : ""}
          {state.tokens
            ? ` Model spotřeboval ${state.tokens.input}+${state.tokens.output} tokenů.`
            : ""}
        </p>
      ) : null}

      <Actions hasFile={Boolean(file)} />
    </form>
  );
}

function Actions({ hasFile }: { hasFile: boolean }) {
  const { pending } = useFormStatus();

  return (
    <div className="import-actions">
      <button type="submit" className="btn btn-primary" disabled={!hasFile || pending}>
        {pending ? "Zpracovávám…" : "Zpracovat"}
      </button>
      {pending ? (
        <p className="import-progress">
          čtu řádky · páruju na pravidelné platby · hledám duplicity
        </p>
      ) : null}
    </div>
  );
}
