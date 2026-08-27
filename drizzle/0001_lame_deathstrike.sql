CREATE TABLE `quoteLineItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quoteId` int NOT NULL,
	`category` enum('labour','materials','callout','equipment','other') NOT NULL,
	`description` varchar(320) NOT NULL,
	`unit` varchar(32) NOT NULL DEFAULT 'each',
	`quantity` decimal(12,2) NOT NULL,
	`rate` decimal(12,2) NOT NULL,
	`markupPercent` decimal(7,2) NOT NULL DEFAULT '0.00',
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `quoteLineItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quotePhotos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quoteId` int NOT NULL,
	`storageKey` varchar(500) NOT NULL,
	`url` varchar(720) NOT NULL,
	`fileName` varchar(220) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quotePhotos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`quoteNumber` varchar(48) NOT NULL,
	`status` enum('draft','ready','sent') NOT NULL DEFAULT 'draft',
	`customerName` varchar(160) NOT NULL,
	`customerEmail` varchar(320),
	`customerPhone` varchar(48),
	`trade` varchar(100) NOT NULL,
	`jobTitle` varchar(220) NOT NULL,
	`jobAddress` text,
	`siteDetails` text,
	`scopeOfWork` text,
	`assumptions` text,
	`exclusions` text,
	`terms` text,
	`gstRate` decimal(5,2) NOT NULL DEFAULT '10.00',
	`validUntil` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `quoteLineItems` ADD CONSTRAINT `quoteLineItems_quoteId_quotes_id_fk` FOREIGN KEY (`quoteId`) REFERENCES `quotes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quotePhotos` ADD CONSTRAINT `quotePhotos_quoteId_quotes_id_fk` FOREIGN KEY (`quoteId`) REFERENCES `quotes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quotes` ADD CONSTRAINT `quotes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `quote_line_items_quote_idx` ON `quoteLineItems` (`quoteId`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `quote_photos_quote_idx` ON `quotePhotos` (`quoteId`);--> statement-breakpoint
CREATE INDEX `quotes_user_updated_idx` ON `quotes` (`userId`,`updatedAt`);