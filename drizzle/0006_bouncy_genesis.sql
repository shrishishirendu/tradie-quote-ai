CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`abn` varchar(32),
	`licence` varchar(80),
	`phone` varchar(48),
	`email` varchar(320),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `organizations_ownerUserId_unique` UNIQUE(`ownerUserId`)
);
--> statement-breakpoint
ALTER TABLE `organizations` ADD CONSTRAINT `organizations_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
INSERT INTO `organizations` (`ownerUserId`, `name`, `abn`, `licence`, `phone`, `email`)
SELECT u.`id`,
       COALESCE(NULLIF(MAX(q.`businessName`), ''), CONCAT('Business ', u.`id`)),
       NULLIF(MAX(q.`businessAbn`), ''),
       NULLIF(MAX(q.`businessLicence`), ''),
       NULLIF(MAX(q.`businessPhone`), ''),
       NULLIF(MAX(q.`businessEmail`), '')
FROM `users` u
LEFT JOIN `quotes` q ON q.`userId` = u.`id`
GROUP BY u.`id`;
--> statement-breakpoint
ALTER TABLE `quotes` ADD `organizationId` int NULL;
--> statement-breakpoint
UPDATE `quotes` q
JOIN `organizations` o ON o.`ownerUserId` = q.`userId`
SET q.`organizationId` = o.`id`;
--> statement-breakpoint
ALTER TABLE `quotes` MODIFY `organizationId` int NOT NULL;
--> statement-breakpoint
ALTER TABLE `quotes` ADD CONSTRAINT `quotes_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `quotes_organization_updated_idx` ON `quotes` (`organizationId`,`updatedAt`);
--> statement-breakpoint
ALTER TABLE `quotes` DROP COLUMN `businessName`;
--> statement-breakpoint
ALTER TABLE `quotes` DROP COLUMN `businessAbn`;
--> statement-breakpoint
ALTER TABLE `quotes` DROP COLUMN `businessLicence`;
--> statement-breakpoint
ALTER TABLE `quotes` DROP COLUMN `businessPhone`;
--> statement-breakpoint
ALTER TABLE `quotes` DROP COLUMN `businessEmail`;
