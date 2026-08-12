CREATE TABLE `account_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_members_unique` ON `account_members` (`account_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'personal' NOT NULL,
	`monthly_budget` integer DEFAULT 0 NOT NULL,
	`initial_balance` integer DEFAULT 0 NOT NULL,
	`initial_balance_date` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`monthly_limit` integer,
	`in_envelopes` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_account_name` ON `categories` (`account_id`,`name`);--> statement-breakpoint
CREATE TABLE `debt_payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`debt_id` integer NOT NULL,
	`amount` integer NOT NULL,
	`date` text NOT NULL,
	`transaction_id` integer,
	`note` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`debt_id`) REFERENCES `debts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `debt_payments_debt` ON `debt_payments` (`debt_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `debt_payments_transaction` ON `debt_payments` (`transaction_id`);--> statement-breakpoint
CREATE TABLE `debts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`creditor` text NOT NULL,
	`total_amount` integer NOT NULL,
	`remaining_amount` integer NOT NULL,
	`installment_amount` integer NOT NULL,
	`installment_day` integer,
	`target_account` text,
	`vs` text,
	`note` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `format_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`header_fingerprint` text,
	`delimiter` text DEFAULT ';' NOT NULL,
	`encoding` text DEFAULT 'utf-8' NOT NULL,
	`skip_rows` integer DEFAULT 0 NOT NULL,
	`column_map_json` text,
	`date_format` text,
	`owner_rules_json` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `format_profiles_name` ON `format_profiles` (`name`);--> statement-breakpoint
CREATE TABLE `import_batches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`filename` text NOT NULL,
	`storage_key` text,
	`instructions_text` text,
	`format_profile_id` integer,
	`imported_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`stats_json` text,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `planned_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`name` text NOT NULL,
	`amount` integer NOT NULL,
	`direction` text NOT NULL,
	`interval` text NOT NULL,
	`month` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `recurring_monthly` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`name` text NOT NULL,
	`amount` integer NOT NULL,
	`day` integer,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `recurring_payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`item_type` text NOT NULL,
	`item_id` integer NOT NULL,
	`month` text NOT NULL,
	`paid_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recurring_payments_unique` ON `recurring_payments` (`item_type`,`item_id`,`month`);--> statement-breakpoint
CREATE TABLE `recurring_yearly` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`name` text NOT NULL,
	`amount` integer NOT NULL,
	`due_month` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`kind` text NOT NULL,
	`pattern` text NOT NULL,
	`target` text NOT NULL,
	`created_from` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rules_unique` ON `rules` (`account_id`,`kind`,`pattern`);--> statement-breakpoint
CREATE TABLE `settings` (
	`account_id` integer PRIMARY KEY NOT NULL,
	`savings_mode` text DEFAULT 'amount' NOT NULL,
	`savings_value` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`name` text NOT NULL,
	`amount` integer NOT NULL,
	`day` integer,
	`active` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`fingerprint` text NOT NULL,
	`date` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text DEFAULT 'CZK' NOT NULL,
	`merchant` text,
	`description` text,
	`category_id` integer,
	`owner_id` integer,
	`is_business` integer DEFAULT false NOT NULL,
	`is_transfer` integer DEFAULT false NOT NULL,
	`source` text DEFAULT 'import' NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`import_batch_id` integer,
	`raw_json` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_fingerprint` ON `transactions` (`fingerprint`);--> statement-breakpoint
CREATE INDEX `transactions_account_date` ON `transactions` (`account_id`,`date`);--> statement-breakpoint
CREATE INDEX `transactions_category` ON `transactions` (`category_id`);--> statement-breakpoint
CREATE INDEX `transactions_batch` ON `transactions` (`import_batch_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
-- ─────────────────────────────────────────────────────────────────────────────
-- Base seed. Not demo data: the household account, the two people who use numo,
-- and the category list. Written with fixed ids and INSERT OR IGNORE so the
-- migration is idempotent and safe to re-run.
--
-- Category names and colours are PROVISIONAL — spec §3.2 is the source of truth
-- and the palette comes from the design bundle. See docs/decisions.md.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO `accounts` (`id`, `name`, `type`, `monthly_budget`, `initial_balance`, `initial_balance_date`)
VALUES (1, 'Domácnost', 'personal', 6300000, 0, NULL);
--> statement-breakpoint
INSERT OR IGNORE INTO `users` (`id`, `name`) VALUES (1, 'Lukáš'), (2, 'Věrka');
--> statement-breakpoint
INSERT OR IGNORE INTO `account_members` (`account_id`, `user_id`, `role`)
VALUES (1, 1, 'owner'), (1, 2, 'member');
--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`account_id`, `savings_mode`, `savings_value`)
VALUES (1, 'amount', 0);
--> statement-breakpoint
INSERT OR IGNORE INTO `categories` (`account_id`, `name`, `color`, `sort`, `monthly_limit`, `in_envelopes`) VALUES
  (1, 'Jídlo',              '#3f8f5f', 10, NULL, 1),
  (1, 'Restaurace',         '#c2703d', 20, NULL, 1),
  (1, 'Doprava',            '#3d6fc2', 30, NULL, 1),
  (1, 'Domácnost',          '#8a6fc2', 40, NULL, 1),
  (1, 'Drogerie a zdraví',  '#3fa2a2', 50, NULL, 1),
  (1, 'Děti',               '#d1568f', 60, NULL, 1),
  (1, 'Zábava',             '#c2a13d', 70, NULL, 1),
  (1, 'Oblečení',           '#7f8b96', 80, NULL, 1),
  (1, 'Dárky',              '#b1553f', 90, NULL, 1),
  (1, 'Ostatní',            '#6b6f76', 100, NULL, 1),
  (1, 'Bydlení',            '#4a4f57', 110, NULL, 0);
