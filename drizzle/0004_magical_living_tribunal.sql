CREATE TABLE `contact_access_purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`scope_type` text NOT NULL,
	`scope_id` text,
	`amount_pesewas` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`payment_provider` text,
	`provider_reference` text,
	`paid_at` text,
	`expires_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `contact_access_user_status_idx` ON `contact_access_purchases` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `contact_access_scope_idx` ON `contact_access_purchases` (`scope_type`,`scope_id`);--> statement-breakpoint
CREATE TABLE `contact_uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`uploaded_by_id` text NOT NULL,
	`file_name` text NOT NULL,
	`imported_count` integer DEFAULT 0 NOT NULL,
	`skipped_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `contact_uploads_user_idx` ON `contact_uploads` (`uploaded_by_id`);--> statement-breakpoint
ALTER TABLE `contacts` ADD `email` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `date_of_birth` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `voter_id` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `ghana_card_number` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `source` text DEFAULT 'platform' NOT NULL;--> statement-breakpoint
ALTER TABLE `contacts` ADD `uploaded_by_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `contacts` ADD `upload_batch_id` text;--> statement-breakpoint
CREATE INDEX `contacts_source_uploader_idx` ON `contacts` (`source`,`uploaded_by_id`);--> statement-breakpoint
CREATE INDEX `contacts_upload_batch_idx` ON `contacts` (`upload_batch_id`);