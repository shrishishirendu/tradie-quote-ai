CREATE TABLE `jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sourceQuoteId` int,
	`jobNumber` varchar(48) NOT NULL,
	`status` enum('planned','active','on_hold','complete') NOT NULL DEFAULT 'planned',
	`customerName` varchar(160) NOT NULL,
	`trade` varchar(100) NOT NULL,
	`title` varchar(220) NOT NULL,
	`address` text,
	`scopeOfWork` text,
	`quotedTotal` decimal(14,2) NOT NULL,
	`gstRate` decimal(5,2) NOT NULL DEFAULT '10.00',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `priceBookItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`category` enum('labour','materials','callout','equipment','other') NOT NULL,
	`name` varchar(180) NOT NULL,
	`description` text,
	`unit` varchar(32) NOT NULL DEFAULT 'each',
	`rate` decimal(12,2) NOT NULL,
	`markupPercent` decimal(7,2) NOT NULL DEFAULT '0.00',
	`trade` varchar(100) NOT NULL,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `priceBookItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_sourceQuoteId_quotes_id_fk` FOREIGN KEY (`sourceQuoteId`) REFERENCES `quotes`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `priceBookItems` ADD CONSTRAINT `priceBookItems_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `jobs_user_status_updated_idx` ON `jobs` (`userId`,`status`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `jobs_source_quote_idx` ON `jobs` (`sourceQuoteId`);--> statement-breakpoint
CREATE INDEX `price_book_user_status_idx` ON `priceBookItems` (`userId`,`status`,`trade`);