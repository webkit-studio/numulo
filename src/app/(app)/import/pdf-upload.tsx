"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { commitPdfImport, getAiJob, startPdfExtract } from "@/app/actions/ai";
import { useToast } from "@/components/toast";

type Phase =
  | { name: "idle" }
  | { name: "uploading" }
  | { name: "extracting"; jobId: string }
  | { name: "committing" }
  | { name: "error"; message: string };

/**
 * The PDF path: upload, then wait honestly.
 *
 * Reading a statement takes the model tens of seconds, so this cannot pretend
 * to be a form submit. The job runs in the Edge Function; this component polls
 * every few seconds and narrates the phase it is actually in. When extraction
 * finishes, the commit runs the SAME import pipeline as a CSV — and the page
 * refresh at the end shows the standard three tabs.
 */
export function PdfUpload({ householdId }: { householdId: string }) {
  const toast = useToast();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const fileRef = useRef<HTMLInputElement>(null);
  const instructionsRef = useRef<HTMLTextAreaElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => {
    if (phase.name !== "extracting") return;

    const timer = setInterval(async () => {
      const job = await getAiJob(phase.jobId);
      if (!job) return;

      if (job.status === "error") {
        setPhase({ name: "error", message: job.error ?? "Extrakce selhala." });
      } else if (job.status === "done") {
        setPhase({ name: "committing" });
        const result = await commitPdfImport(phase.jobId);
        if (result.error) {
          setPhase({ name: "error", message: result.error });
        } else {
          toast.show(
            `${result.filename ?? "PDF"}: přidáno ${result.added}, duplicitní ${result.duplicates}, ke schválení ${result.review}.`,
          );
          setPhase({ name: "idle" });
          setFileName(null);
          router.refresh();
        }
      }
    }, 2500);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function submit() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setPhase({ name: "uploading" });
    const form = new FormData();
    form.set("householdId", householdId);
    form.set("file", file);
    form.set("instructions", instructionsRef.current?.value ?? "");

    const started = await startPdfExtract(form);
    if (started.error || !started.jobId) {
      setPhase({ name: "error", message: started.error ?? "Nepovedlo se to." });
      return;
    }
    setPhase({ name: "extracting", jobId: started.jobId });
  }

  const busy = phase.name === "uploading" || phase.name === "extracting" || phase.name === "committing";

  return (
    <div className="import-form">
      <div
        className={`dropzone${fileName ? " has-file" : ""}`}
        onClick={() => fileRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const dropped = event.dataTransfer.files[0];
          if (!dropped || !fileRef.current) return;
          const transfer = new DataTransfer();
          transfer.items.add(dropped);
          fileRef.current.files = transfer.files;
          setFileName(dropped.name);
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,application/pdf"
          className="visually-hidden"
          onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
        />
        {fileName ? (
          <p className="dropzone-file">{fileName}</p>
        ) : (
          <>
            <p className="dropzone-lead">Přetáhni PDF výpis sem</p>
            <p className="dropzone-sub">nebo klikni a vyber soubor — <b>PDF</b></p>
          </>
        )}
      </div>

      <label className="field">
        <span className="field-label">Pokyny k souboru</span>
        <textarea
          ref={instructionsRef}
          className="input"
          rows={2}
          placeholder="např. výpis z Fio, převody na spořicí účet ignoruj"
        />
      </label>

      {phase.name === "error" ? <p className="form-error">{phase.message}</p> : null}

      <div className="import-actions">
        <button type="button" className="btn btn-primary" disabled={!fileName || busy} onClick={() => void submit()}>
          {phase.name === "uploading"
            ? "Nahrávám…"
            : phase.name === "extracting"
              ? "Čtu výpis…"
              : phase.name === "committing"
                ? "Zapisuju…"
                : "Zpracovat PDF"}
        </button>
        {phase.name === "extracting" ? (
          <p className="import-progress">
            model přepisuje transakce — u delšího výpisu to trvá i minutu
          </p>
        ) : null}
      </div>
    </div>
  );
}
