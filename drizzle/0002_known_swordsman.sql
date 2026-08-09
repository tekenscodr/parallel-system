PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_polling_stations` (
	`id` text PRIMARY KEY NOT NULL,
	`constituency_id` text,
	`electoral_area_id` text,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`address` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`constituency_id`) REFERENCES `constituencies`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`electoral_area_id`) REFERENCES `electoral_areas`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_polling_stations`("id", "constituency_id", "electoral_area_id", "name", "code", "address", "is_active", "created_at", "updated_at") SELECT "id", NULL, "electoral_area_id", "name", "code", "address", "is_active", "created_at", "updated_at" FROM `polling_stations`;--> statement-breakpoint
DROP TABLE `polling_stations`;--> statement-breakpoint
ALTER TABLE `__new_polling_stations` RENAME TO `polling_stations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `polling_stations_code_unique` ON `polling_stations` (`code`);--> statement-breakpoint
CREATE INDEX `polling_stations_constituency_idx` ON `polling_stations` (`constituency_id`);--> statement-breakpoint
CREATE INDEX `polling_stations_electoral_area_idx` ON `polling_stations` (`electoral_area_id`);
