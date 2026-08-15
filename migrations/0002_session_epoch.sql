-- Sessions carry the epoch they were minted under. Bumping a user's epoch
-- invalidates every cookie already issued for them, which is what makes a
-- password change actually end other sessions instead of merely setting a new
-- password alongside them.
ALTER TABLE `users` ADD `session_epoch` integer DEFAULT 1 NOT NULL;
