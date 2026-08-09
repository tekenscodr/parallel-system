CREATE TABLE `campaign_recipients` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`contact_id` text,
	`phone_number` text NOT NULL,
	`first_name` text DEFAULT '' NOT NULL,
	`polling_station_name` text,
	`personalized_message` text NOT NULL,
	`delivery_status` text DEFAULT 'queued' NOT NULL,
	`failure_reason` text,
	`delivered_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `campaign_recipients_campaign_phone_unique` ON `campaign_recipients` (`campaign_id`,`phone_number`);--> statement-breakpoint
CREATE INDEX `campaign_recipients_campaign_status_idx` ON `campaign_recipients` (`campaign_id`,`delivery_status`);--> statement-breakpoint
CREATE INDEX `campaign_recipients_contact_idx` ON `campaign_recipients` (`contact_id`);--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`audience_type` text NOT NULL,
	`contact_id` text,
	`group_id` text,
	`region_id` text,
	`constituency_id` text,
	`electoral_area_id` text,
	`polling_station_id` text,
	`scheduled_at` text,
	`started_at` text,
	`completed_at` text,
	`estimated_recipients` integer DEFAULT 0 NOT NULL,
	`sms_parts` integer DEFAULT 1 NOT NULL,
	`estimated_cost_pesewas` integer DEFAULT 0 NOT NULL,
	`created_by_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`group_id`) REFERENCES `contact_groups`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`region_id`) REFERENCES `regions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`constituency_id`) REFERENCES `constituencies`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`electoral_area_id`) REFERENCES `electoral_areas`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`polling_station_id`) REFERENCES `polling_stations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `campaigns_status_scheduled_idx` ON `campaigns` (`status`,`scheduled_at`);--> statement-breakpoint
CREATE INDEX `campaigns_created_by_idx` ON `campaigns` (`created_by_id`);--> statement-breakpoint
CREATE INDEX `campaigns_region_idx` ON `campaigns` (`region_id`);--> statement-breakpoint
CREATE INDEX `campaigns_constituency_idx` ON `campaigns` (`constituency_id`);--> statement-breakpoint
CREATE INDEX `campaigns_electoral_area_idx` ON `campaigns` (`electoral_area_id`);--> statement-breakpoint
CREATE INDEX `campaigns_polling_station_idx` ON `campaigns` (`polling_station_id`);--> statement-breakpoint
CREATE TABLE `constituencies` (
	`id` text PRIMARY KEY NOT NULL,
	`region_id` text NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`region_id`) REFERENCES `regions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `constituencies_region_name_unique` ON `constituencies` (`region_id`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `constituencies_code_unique` ON `constituencies` (`code`);--> statement-breakpoint
CREATE INDEX `constituencies_region_idx` ON `constituencies` (`region_id`);--> statement-breakpoint
CREATE TABLE `contact_group_members` (
	`group_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`added_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`group_id`, `contact_id`),
	FOREIGN KEY (`group_id`) REFERENCES `contact_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `contact_group_members_contact_idx` ON `contact_group_members` (`contact_id`);--> statement-breakpoint
CREATE TABLE `contact_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_by_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contact_groups_name_unique` ON `contact_groups` (`name`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`polling_station_id` text,
	`first_name` text NOT NULL,
	`last_name` text DEFAULT '' NOT NULL,
	`phone_number` text NOT NULL,
	`preferred_language` text DEFAULT 'en' NOT NULL,
	`consent_status` text DEFAULT 'pending' NOT NULL,
	`consent_source` text,
	`opted_in_at` text,
	`opted_out_at` text,
	`is_active` integer DEFAULT true NOT NULL,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`polling_station_id`) REFERENCES `polling_stations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contacts_phone_number_unique` ON `contacts` (`phone_number`);--> statement-breakpoint
CREATE INDEX `contacts_polling_station_idx` ON `contacts` (`polling_station_id`);--> statement-breakpoint
CREATE INDEX `contacts_consent_active_idx` ON `contacts` (`consent_status`,`is_active`);--> statement-breakpoint
CREATE INDEX `contacts_name_idx` ON `contacts` (`last_name`,`first_name`);--> statement-breakpoint
CREATE TABLE `delivery_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_recipient_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_message_id` text,
	`status` text NOT NULL,
	`response_code` text,
	`response_message` text,
	`attempted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`campaign_recipient_id`) REFERENCES `campaign_recipients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `delivery_attempts_recipient_idx` ON `delivery_attempts` (`campaign_recipient_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `delivery_attempts_provider_message_unique` ON `delivery_attempts` (`provider`,`provider_message_id`);--> statement-breakpoint
CREATE TABLE `electoral_areas` (
	`id` text PRIMARY KEY NOT NULL,
	`constituency_id` text NOT NULL,
	`name` text NOT NULL,
	`code` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`constituency_id`) REFERENCES `constituencies`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `electoral_areas_constituency_name_unique` ON `electoral_areas` (`constituency_id`,`name`);--> statement-breakpoint
CREATE INDEX `electoral_areas_constituency_idx` ON `electoral_areas` (`constituency_id`);--> statement-breakpoint
CREATE TABLE `polling_stations` (
	`id` text PRIMARY KEY NOT NULL,
	`electoral_area_id` text NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`address` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`electoral_area_id`) REFERENCES `electoral_areas`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `polling_stations_code_unique` ON `polling_stations` (`code`);--> statement-breakpoint
CREATE INDEX `polling_stations_electoral_area_idx` ON `polling_stations` (`electoral_area_id`);--> statement-breakpoint
CREATE TABLE `regions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `regions_name_unique` ON `regions` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `regions_code_unique` ON `regions` (`code`);--> statement-breakpoint
CREATE TABLE `sms_credit_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`balance_after` integer NOT NULL,
	`campaign_id` text,
	`description` text,
	`created_by_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `sms_credit_transactions_created_idx` ON `sms_credit_transactions` (`created_at`);--> statement-breakpoint
CREATE INDEX `sms_credit_transactions_campaign_idx` ON `sms_credit_transactions` (`campaign_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`full_name` text NOT NULL,
	`role` text DEFAULT 'campaign_manager' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`last_login_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);