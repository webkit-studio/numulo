import type { Metadata } from "next";
import { CrudList } from "@/components/crud/crud-list";
import type { CrudItem } from "@/components/crud/types";
import { formatDayMonth, MonthLabel } from "@/components/money";
import { estimatePayoff, summariseDebts } from "@/lib/calc/debts";
import { getDebtPayments, getDebts } from "@/lib/data/plan";
import { formatCzk, halereToCzk } from "@/lib/money";
import { LinkPayments } from "./link-payments";
import { MatchButton } from "./match-button";
import { RecordPayment } from "./record-payment";

export const metadata: Metadata = { title: "numo — dluhy" };
export const dynamic = "force-dynamic";

export default async function DebtsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);

  const [rows, payments] = await Promise.all([getDebts(), getDebtPayments()]);
  const summary = summariseDebts(rows, thisMonth);

  const paymentsByDebt = new Map<number, typeof payments>();
  for (const payment of payments) {
    const group = paymentsByDebt.get(payment.debtId) ?? [];
    group.push(payment);
    paymentsByDebt.set(payment.debtId, group);
  }

  const items: CrudItem[] = rows.map((debt) => {
    const payoff = estimatePayoff(debt, thisMonth);
    const paid = debt.totalAmount - debt.remainingAmount;

    return {
      id: debt.id,
      title: debt.creditor,
      meta: [
        `splátka ${formatCzk(debt.installmentAmount)}`,
        debt.installmentDay ? `${debt.installmentDay}. v měsíci` : null,
        debt.remainingAmount === 0
          ? "splaceno"
          : payoff.cleanBy
            ? `čistý ~${payoff.cleanBy}`
            : "bez splátky nelze odhadnout",
        paid > 0 ? `zaplaceno ${formatCzk(paid)} z ${formatCzk(debt.totalAmount)}` : null,
        debt.vs ? `VS ${debt.vs}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      amount: debt.remainingAmount,
      muted: !debt.active,
      flags: debt.active ? [] : ["vyřízeno"],
      values: {
        creditor: debt.creditor,
        totalAmount: halereToCzk(debt.totalAmount),
        remainingAmount: halereToCzk(debt.remainingAmount),
        installmentAmount: halereToCzk(debt.installmentAmount),
        installmentDay: debt.installmentDay ?? "",
        targetAccount: debt.targetAccount ?? "",
        vs: debt.vs ?? "",
        note: debt.note ?? "",
        active: debt.active,
      },
    };
  });

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Dluhy</h1>
          <p className="page-sub">
            {rows.length === 0
              ? "zatím žádné"
              : summary.cleanBy
                ? <>čistí v <MonthLabel month={summary.cleanBy} /> při současném tempu</>
                : "bez splátek to nelze odhadnout"}
          </p>
        </div>
      </header>

      <section className="tiles">
        <article className={`tile${summary.totalOwed > 0 ? " is-alert" : " is-good"}`}>
          <h2>Dlužíme</h2>
          <p className="tile-value numo-numeric">{formatCzk(summary.totalOwed)}</p>
          <p className="tile-note">
            {rows.filter((debt) => debt.active).length} aktivních dluhů
          </p>
        </article>
        <article className="tile">
          <h2>Splátky měsíčně</h2>
          <p className="tile-value numo-numeric">
            {formatCzk(summary.monthlyInstalments)}
          </p>
          <p className="tile-note">připočítává se k cíli měsíce</p>
        </article>
        <article className="tile">
          <h2>Čistí</h2>
          <p className="tile-value">
            {summary.cleanBy ? <MonthLabel month={summary.cleanBy} /> : "—"}
          </p>
          <p className="tile-note">
            {summary.cleanBy
              ? "odhad, když se tempo nezmění"
              : "chybí splátka, ze které počítat"}
          </p>
        </article>
      </section>

      <section className="card">
        <header className="card-head">
          <h2>Seznam</h2>
          <p className="card-sub">
            Číslo účtu a variabilní symbol nejsou navíc — podle nich numo pozná
            splátku ve výpisu a odepíše ji samo.
          </p>
        </header>
        <CrudList
          endpoint="/api/debts"
          describe="Dluh"
          addLabel="+ přidat dluh"
          emptyNote="Žádné dluhy. Když nějaký přibude, zapiš ho i s VS — pak se splátky páruji samy."
          items={items}
          fields={[
            { name: "creditor", label: "Komu dlužíme", type: "text", required: true },
            { name: "totalAmount", label: "Celkem (Kč)", type: "money", required: true, half: true },
            { name: "remainingAmount", label: "Zbývá (Kč)", type: "money", required: true, half: true },
            { name: "installmentAmount", label: "Splátka (Kč)", type: "money", required: true, half: true },
            { name: "installmentDay", label: "Den splátky", type: "int", half: true, hint: "1–31" },
            { name: "targetAccount", label: "Číslo účtu", type: "text", half: true, hint: "pro párování" },
            { name: "vs", label: "Variabilní symbol", type: "text", half: true, hint: "pro párování" },
            { name: "note", label: "Poznámka", type: "text" },
            { name: "active", label: "Aktivní", type: "bool" },
          ]}
        />
        <MatchButton />
      </section>

      {rows.some((debt) => debt.active) ? (
        <section className="card">
          <header className="card-head">
            <h2>Splátky z výpisu</h2>
            <p className="card-sub">
              Platby, které vypadají jako splátka, ale banka u nich netiskne VS
              ani protiúčet.
            </p>
          </header>
          <LinkPayments
            debts={rows
              .filter((debt) => debt.active)
              .map((debt) => ({ id: debt.id, creditor: debt.creditor }))}
          />
        </section>
      ) : null}

      {rows
        .filter((debt) => debt.active)
        .map((debt) => {
          const history = paymentsByDebt.get(debt.id) ?? [];
          return (
            <section key={debt.id} className="card">
              <header className="card-head">
                <h2>{debt.creditor}</h2>
                <p className="card-sub">
                  Zbývá {formatCzk(debt.remainingAmount)}
                  {history.length > 0
                    ? ` · ${history.length} zapsaných splátek`
                    : " · zatím bez zapsané splátky"}
                </p>
              </header>

              {history.length > 0 ? (
                <ul className="crud-list">
                  {[...history].reverse().map((payment) => (
                    <li key={payment.id} className="crud-row">
                      <span className="crud-main">
                        <span className="crud-title">
                          {formatDayMonth(payment.date)}
                        </span>
                        {payment.note ? (
                          <span className="crud-meta">{payment.note}</span>
                        ) : null}
                      </span>
                      <span className="numo-numeric crud-amount">
                        {formatCzk(payment.amount)}
                      </span>
                      <span className="crud-actions crud-actions-empty" />
                    </li>
                  ))}
                </ul>
              ) : null}

              <RecordPayment
                debtId={debt.id}
                creditor={debt.creditor}
                installment={debt.installmentAmount}
                today={today}
              />
            </section>
          );
        })}
    </>
  );
}
