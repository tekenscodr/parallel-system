DROP INDEX `contacts_phone_number_unique`;--> statement-breakpoint
CREATE INDEX `contacts_phone_number_idx` ON `contacts` (`phone_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `contacts_owner_phone_unique` ON `contacts` (`source`,`uploaded_by_id`,`phone_number`);