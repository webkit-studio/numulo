import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Money is stored as an integer number of haléře (1 CZK = 100 haléřů).
 * Expenses are negative, income positive. Never use floats for money.
 *
 * Months are stored as `YYYY-MM`, dates as `YYYY-MM-DD` (ISO, lexicographically
 * sortable and comparable — the calculations rely on that).
 */

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

/* ------------------------------------------------------------------ users */

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull().default(now),
});

/* --------------------------------------------------------------- accounts */

export const accounts = sqliteTable("accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  /** 'personal' today; the column exists so a business space can be added later. */
  type: text("type", { enum: ["personal", "business"] })
    .notNull()
    .default("personal"),
  /** Monthly household spending ceiling, in haléře. Not a payout, not income. */
  monthlyBudget: integer("monthly_budget").notNull().default(0),
  /**
   * Cash on the tracked accounts on `initialBalanceDate`, in haléře.
   * Debts are NOT subtracted here — they live in `debts` and Rezerva nets them.
   * May be negative.
   */
  initialBalance: integer("initial_balance").notNull().default(0),
  /**
   * The cut-off date. Transactions dated after it move Rezerva; transactions
   * dated on or before it are history and only feed averages and trends.
   */
  initialBalanceDate: text("initial_balance_date"),
  createdAt: text("created_at").notNull().default(now),
});

export const accountMembers = sqliteTable(
  "account_members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "member", "viewer"] })
      .notNull()
      .default("member"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [uniqueIndex("account_members_unique").on(t.accountId, t.userId)],
);

/* ------------------------------------------------------------- categories */

export const categories = sqliteTable(
  "categories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull(),
    sort: integer("sort").notNull().default(0),
    /**
     * Monthly spending limit in haléře, or NULL for "no limit set" — the
     * envelope then shows "utraceno + nastavit limit ›" instead of a bar.
     */
    monthlyLimit: integer("monthly_limit"),
    /** Bydlení is tracked but never shown as an envelope. */
    inEnvelopes: integer("in_envelopes", { mode: "boolean" })
      .notNull()
      .default(true),
  },
  (t) => [uniqueIndex("categories_account_name").on(t.accountId, t.name)],
);

/* ----------------------------------------------------------- transactions */

export const transactions = sqliteTable(
  "transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    /** sha256 over the normalised row — the dedup key. */
    fingerprint: text("fingerprint").notNull(),
    date: text("date").notNull(),
    /** Haléře. Expenses negative. */
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("CZK"),
    merchant: text("merchant"),
    description: text("description"),
    categoryId: integer("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    ownerId: integer("owner_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** Excluded from EVERY household total (both income and expense sides). */
    isBusiness: integer("is_business", { mode: "boolean" })
      .notNull()
      .default(false),
    /** Air Bank ↔ Revolut moves. Excluded from income and expense metrics. */
    isTransfer: integer("is_transfer", { mode: "boolean" })
      .notNull()
      .default(false),
    source: text("source", { enum: ["import", "manual"] })
      .notNull()
      .default("import"),
    status: text("status", { enum: ["confirmed", "review"] })
      .notNull()
      .default("confirmed"),
    importBatchId: integer("import_batch_id"),
    /** The original CSV row, for auditing a mis-parse after the fact. */
    rawJson: text("raw_json"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [
    uniqueIndex("transactions_fingerprint").on(t.fingerprint),
    index("transactions_account_date").on(t.accountId, t.date),
    index("transactions_category").on(t.categoryId),
    index("transactions_batch").on(t.importBatchId),
  ],
);

/* ------------------------------------------------------------------ rules */

export const rules = sqliteTable(
  "rules",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    kind: text("kind", {
      enum: [
        "merchant->category",
        "pattern->owner",
        "pattern->business",
        "pattern->transfer",
      ],
    }).notNull(),
    pattern: text("pattern").notNull(),
    target: text("target").notNull(),
    /** Where the rule came from: 'transaction:123', 'import:4', 'manual', 'ai'. */
    createdFrom: text("created_from"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [uniqueIndex("rules_unique").on(t.accountId, t.kind, t.pattern)],
);

/* ---------------------------------------------------- recurring & planned */

export const subscriptions = sqliteTable("subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  amount: integer("amount").notNull(),
  day: integer("day"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  /** 'detected' rows are proposals from the detector until confirmed. */
  status: text("status", { enum: ["confirmed", "detected"] })
    .notNull()
    .default("confirmed"),
  createdAt: text("created_at").notNull().default(now),
});

export const recurringMonthly = sqliteTable("recurring_monthly", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  amount: integer("amount").notNull(),
  day: integer("day"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(now),
});

export const recurringYearly = sqliteTable("recurring_yearly", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  amount: integer("amount").notNull(),
  /** 1–12 */
  dueMonth: integer("due_month").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(now),
});

/**
 * "Paid this month" checklist state, shared by subscriptions, monthly and
 * yearly items. One row per (item, month) — the row's existence means paid.
 */
export const recurringPayments = sqliteTable(
  "recurring_payments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    itemType: text("item_type", {
      enum: ["subscription", "monthly", "yearly"],
    }).notNull(),
    itemId: integer("item_id").notNull(),
    /** YYYY-MM */
    month: text("month").notNull(),
    paidAt: text("paid_at").notNull().default(now),
  },
  (t) => [
    uniqueIndex("recurring_payments_unique").on(
      t.itemType,
      t.itemId,
      t.month,
    ),
  ],
);

export const plannedItems = sqliteTable("planned_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** Always positive; `direction` carries the sign. */
  amount: integer("amount").notNull(),
  direction: text("direction", { enum: ["income", "expense"] }).notNull(),
  interval: text("interval", { enum: ["once", "monthly"] }).notNull(),
  /** YYYY-MM. Required for 'once', ignored for 'monthly'. */
  month: text("month"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(now),
});

/* ------------------------------------------------------------------ debts */

export const debts = sqliteTable("debts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  creditor: text("creditor").notNull(),
  totalAmount: integer("total_amount").notNull(),
  remainingAmount: integer("remaining_amount").notNull(),
  installmentAmount: integer("installment_amount").notNull(),
  installmentDay: integer("installment_day"),
  /** Counterparty account number — used to auto-match incoming payments. */
  targetAccount: text("target_account"),
  /** Variabilní symbol — the second half of the auto-match key. */
  vs: text("vs"),
  note: text("note"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(now),
});

export const debtPayments = sqliteTable(
  "debt_payments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    debtId: integer("debt_id")
      .notNull()
      .references(() => debts.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    date: text("date").notNull(),
    /** Set when the payment was auto-matched from an imported transaction. */
    transactionId: integer("transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
    note: text("note"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [
    index("debt_payments_debt").on(t.debtId),
    uniqueIndex("debt_payments_transaction").on(t.transactionId),
  ],
);

/* --------------------------------------------------------------- settings */

export const settings = sqliteTable("settings", {
  accountId: integer("account_id")
    .primaryKey()
    .references(() => accounts.id, { onDelete: "cascade" }),
  savingsMode: text("savings_mode", { enum: ["amount", "percent"] })
    .notNull()
    .default("amount"),
  /** Haléře when mode is 'amount', percent when mode is 'percent'. */
  savingsValue: real("savings_value").notNull().default(0),
});

/* ----------------------------------------------------------------- import */

export const importBatches = sqliteTable("import_batches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  /** Object Storage key of the archived raw file: imports/{timestamp}-{filename} */
  storageKey: text("storage_key"),
  /** Free-text "Pokyny k souboru" kept with the batch. */
  instructionsText: text("instructions_text"),
  formatProfileId: integer("format_profile_id"),
  importedAt: text("imported_at").notNull().default(now),
  statsJson: text("stats_json"),
});

export const formatProfiles = sqliteTable(
  "format_profiles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    /** Hash of the header row — how a known format is recognised. */
    headerFingerprint: text("header_fingerprint"),
    delimiter: text("delimiter").notNull().default(";"),
    encoding: text("encoding").notNull().default("utf-8"),
    skipRows: integer("skip_rows").notNull().default(0),
    columnMapJson: text("column_map_json"),
    dateFormat: text("date_format"),
    ownerRulesJson: text("owner_rules_json"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [uniqueIndex("format_profiles_name").on(t.name)],
);

/* ------------------------------------------------------------------ types */

export type Account = typeof accounts.$inferSelect;
export type User = typeof users.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Rule = typeof rules.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type RecurringMonthly = typeof recurringMonthly.$inferSelect;
export type RecurringYearly = typeof recurringYearly.$inferSelect;
export type PlannedItem = typeof plannedItems.$inferSelect;
export type Debt = typeof debts.$inferSelect;
export type DebtPayment = typeof debtPayments.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type ImportBatch = typeof importBatches.$inferSelect;
export type FormatProfile = typeof formatProfiles.$inferSelect;
