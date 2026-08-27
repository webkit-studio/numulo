"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { runImport, type ImportResult } from "@/app/actions/import";
import { commitPdfImport, getAiJob, startPdfExtract } from "@/app/actions/ai";
import { useToast } from "@/components/toast";

type Phase =
  | { name: "idle" }
  | { name: "csv" }
  | { name: "uploading" }
  | { name: "extracting"; jobId: string }
  | { name: "committing" }
  | { name: "error"; message: string };

const isPdf = (file: File) =>
  file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

const isCsv = (file: File) =>
  file.type.startsWith("text/") || /\.(csv|txt)$/i.test(file.name);

/**
 * One window, whatever the bank exported.
 *
 * The person drops a file; the FORMAT is Numulo's problem. CSV goes through
 * the deterministic parser in one request. PDF goes to the model via the job
 * queue, and this component polls and narrates honestly, because reading a
 * statement takes tens of seconds. Both roads end at the same door — the same
 * fingerprints, the same duplicate rules, the same three tabs below.
 */
export function StatementUpload({ householdId }: { householdId: string }) {
  const toast = useToast();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [file, setFile] = useState<File | null>(null);
  const [lastResult, setLastResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const instructionsRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (phase.name !== "extracting") return;

    const timer = setInterval(async () => {
      const job = await getAiJob(phase.jobId);
      if (!job) return;

      if (job.status === "error") {
        setPhase({ name: "error", message: job.error ?? "Čtení výpisu selhalo." });
      } else if (job.status === "done") {
        setPhase({ name: "committing" });
        const result = await commitPdfImport(phase.jobId);
        if (result.error) {
          setPhase({ name: "error", message: result.error });
        } else {
          toast.show(
            `${result.filename ?? "PDF"}: přidáno ${result.added}, duplicitní ${result.duplicates}, ke schválení ${result.review}.`,
          );
          reset();
          router.refresh();
        }
      }
    }, 2500);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function reset() {
    setPhase({ name: "idle" });
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function pick(picked: File | null) {
    setFile(picked);
    setLastResult(null);
    if (phase.name === "error") setPhase({ name: "idle" });
  }

  async function submit() {
    if (!file) return;
    const instructions = instructionsRef.current?.value ?? "";

    if (isPdf(file)) {
      setPhase({ name: "uploading" });
      const form = new FormData();
      form.set("householdId", householdId);
      form.set("file", file);
      form.set("instructions", instructions);
      const started = await startPdfExtract(form);
      if (started.error || !started.jobId) {
        setPhase({ name: "error", message: started.error ?? "Nepovedlo se to." });
        return;
      }
      setPhase({ name: "extracting", jobId: started.jobId });
      return;
    }

    if (isCsv(file)) {
      setPhase({ name: "csv" });
      const form = new FormData();
      form.set("householdId", householdId);
      form.set("file", file);
      form.set("instructions", instructions);
      const result = await runImport({ error: null }, form);
      if (result.error) {
        setPhase({ name: "error", message: result.error });
        return;
      }
      setLastResult(result);
      toast.show(
        `${result.filename}: přidáno ${result.added}, duplicitní ${result.duplicates}, ke schválení ${result.review}.`,
      );
      reset();
      router.refresh();
      return;
    }

    setPhase({
      name: "error",
      message: `Tenhle formát zatím neumím (${file.name}). Nahraj CSV nebo PDF — ostatní formáty banka skoro vždycky umí vyexportovat taky.`,
    });
  }

  const busy = phase.name !== "idle" && phase.name !== "error";

  return (
    <div className="import-form">
      <div
        className={`dropzone${file ? " has-file" : ""}`}
        onClick={() => fileRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const dropped = event.dataTransfer.files[0];
          if (!dropped || !fileRef.current) return;
          const transfer = new DataTransfer();
          transfer.items.add(dropped);
          fileRef.current.files = transfer.files;
          pick(dropped);
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,.pdf,text/csv,text/plain,application/pdf"
          className="visually-hidden"
          onChange={(event) => pick(event.target.files?.[0] ?? null)}
        />
        {file ? (
          <p className="dropzone-file">
            {file.name}
            <span className="dropzone-kind">{isPdf(file) ? "PDF → přečte model" : "CSV → bez modelu"}</span>
          </p>
        ) : (
          <>
            <p className="dropzone-lead">Přetáhni výpis sem</p>
            <p className="dropzone-sub">nebo klikni a vyber soubor — <b>CSV nebo PDF</b>, jedno odkud</p>
          </>
        )}
      </div>

      <label className="field">
        <span className="field-label">Pokyny k souboru</span>
        <textarea
          ref={instructionsRef}
          className="input"
          rows={2}
          placeholder="např. Fio — společný účet. Převody na spořicí účet ignoruj."
        />
      </label>

      {phase.name === "error" ? <p className="form-error">{phase.message}</p> : null}

      <div className="import-actions">
        <button type="button" className="btn btn-primary" disabled={!file || busy} onClick={() => void submit()}>
          {phase.name === "csv"
            ? "Zpracovávám…"
            : phase.name === "uploading"
              ? "Nahrávám…"
              : phase.name === "extracting"
                ? "Čtu výpis…"
                : phase.name === "committing"
                  ? "Zapisuju…"
                  : "Zpracovat"}
        </button>
        {phase.name === "extracting" ? (
          <p className="import-progress">model přepisuje transakce — u delšího výpisu to trvá i minutu</p>
        ) : null}
        {phase.name === "csv" ? (
          <p className="import-progress">čtu řádky · páruju na pravidelné platby · hledám duplicity</p>
        ) : null}
      </div>
    </div>
  );
}
