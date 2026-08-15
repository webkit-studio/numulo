import type { Metadata } from "next";
import Link from "next/link";
import { SortWorkbench } from "./workbench";
import {
  getCategories,
  getUncategorisedCount,
  getUncategorisedMerchants,
} from "@/lib/data/queries";
import { hasAiKey } from "@/lib/env";

export const metadata: Metadata = { title: "numo — roztřídit" };
export const dynamic = "force-dynamic";

export default async function SortPage() {
  const [merchants, categories] = await Promise.all([
    getUncategorisedMerchants(),
    getCategories(),
  ]);

  const remaining = merchants.reduce((sum, group) => sum + group.count, 0);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Roztřídit</h1>
          <p className="page-sub">
            {remaining > 0
              ? `${remaining} útrat bez kategorie u ${merchants.length} obchodníků, největší nahoře`
              : "Všechno je roztříděné."}
          </p>
        </div>
        <Link href="/transakce" className="chip">
          zpět na transakce
        </Link>
      </header>

      <SortWorkbench
        merchants={merchants}
        categories={categories}
        aiAvailable={hasAiKey()}
      />
    </>
  );
}
