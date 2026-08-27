CREATE TABLE `paymentRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`userId` int NOT NULL,
	`paymentNumber` varchar(48) NOT NULL,
	`kind` enum('deposit','invoice') NOT NULL,
	`title` varchar(220) NOT NULL,
	`description` text,
	`requestedAmountCents` int NOT NULL,
	`dueDate` timestamp,
	`stripeCheckoutSessionId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `paymentRequests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quoteAcceptances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quoteId` int NOT NULL,
	`userId` int NOT NULL,
	`publicToken` varchar(96) NOT NULL,
	`status` enum('pending','accepted','declined','revoked') NOT NULL DEFAULT 'pending',
	`recipientName` varchar(160),
	`recipientEmail` varchar(320),
	`quoteSnapshot` text NOT NULL,
	`acceptedName` varchar(160),
	`acceptedEmail` varchar(320),
	`acceptedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quoteAcceptances_id` PRIMARY KEY(`id`),
	CONSTRAINT `quoteAcceptances_publicToken_unique` UNIQUE(`publicToken`)
);
--> statement-breakpoint
CREATE TABLE `variationPhotos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`variationId` int NOT NULL,
	`storageKey` varchar(500) NOT NULL,
	`url` varchar(720) NOT NULL,
	`fileName` varchar(220) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `variationPhotos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `variations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`userId` int NOT NULL,
	`variationNumber` varchar(48) NOT NULL,
	`title` varchar(220) NOT NULL,
	`reason` text,
	`scopeOfWork` text NOT NULL,
	`status` enum('draft','sent','approved','declined') NOT NULL DEFAULT 'draft',
	`subtotal` decimal(14,2) NOT NULL,
	`gstAmount` decimal(14,2) NOT NULL,
	`total` decimal(14,2) NOT NULL,
	`customerResponse` text,
	`sentAt` timestamp,
	`respondedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `variations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `paymentRequests` ADD CONSTRAINT `paymentRequests_jobId_jobs_id_fk` FOREIGN KEY (`jobId`) REFERENCES `jobs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `paymentRequests` ADD CONSTRAINT `paymentRequests_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quoteAcceptances` ADD CONSTRAINT `quoteAcceptances_quoteId_quotes_id_fk` FOREIGN KEY (`quoteId`) REFERENCES `quotes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quoteAcceptances` ADD CONSTRAINT `quoteAcceptances_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `variationPhotos` ADD CONSTRAINT `variationPhotos_variationId_variations_id_fk` FOREIGN KEY (`variationId`) REFERENCES `variations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `variations` ADD CONSTRAINT `variations_jobId_jobs_id_fk` FOREIGN KEY (`jobId`) REFERENCES `jobs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `variations` ADD CONSTRAINT `variations_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `payment_requests_job_updated_idx` ON `paymentRequests` (`jobId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `payment_requests_session_idx` ON `paymentRequests` (`stripeCheckoutSessionId`);--> statement-breakpoint
CREATE INDEX `quote_acceptances_user_quote_idx` ON `quoteAcceptances` (`userId`,`quoteId`);--> statement-breakpoint
CREATE INDEX `quote_acceptances_quote_status_idx` ON `quoteAcceptances` (`quoteId`,`status`);--> statement-breakpoint
CREATE INDEX `variation_photos_variation_idx` ON `variationPhotos` (`variationId`);--> statement-breakpoint
CREATE INDEX `variations_job_status_idx` ON `variations` (`jobId`,`status`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `variations_user_updated_idx` ON `variations` (`userId`,`updatedAt`);