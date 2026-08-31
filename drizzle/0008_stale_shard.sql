CREATE TABLE `organizationMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('manager','supervisor','estimator','field_user') NOT NULL DEFAULT 'field_user',
	`status` enum('active','invited') NOT NULL DEFAULT 'active',
	`joinedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizationMembers_id` PRIMARY KEY(`id`),
	CONSTRAINT `organization_members_org_user_unique` UNIQUE(`organizationId`,`userId`)
);
--> statement-breakpoint
ALTER TABLE `jobs` ADD `assignedUserId` int;--> statement-breakpoint
ALTER TABLE `organizationMembers` ADD CONSTRAINT `organizationMembers_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organizationMembers` ADD CONSTRAINT `organizationMembers_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `organization_members_user_idx` ON `organizationMembers` (`userId`);--> statement-breakpoint
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_assignedUserId_users_id_fk` FOREIGN KEY (`assignedUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
INSERT INTO `organizationMembers` (`organizationId`, `userId`, `role`, `status`, `joinedAt`)
SELECT o.`id`, o.`ownerUserId`, 'manager', 'active', o.`createdAt`
FROM `organizations` o
LEFT JOIN `organizationMembers` m ON m.`organizationId` = o.`id` AND m.`userId` = o.`ownerUserId`
WHERE m.`id` IS NULL;
