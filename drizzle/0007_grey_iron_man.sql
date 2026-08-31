ALTER TABLE `jobs` ADD `organizationId` int NULL;
--> statement-breakpoint
ALTER TABLE `paymentRequests` ADD `organizationId` int NULL;
--> statement-breakpoint
ALTER TABLE `priceBookItems` ADD `organizationId` int NULL;
--> statement-breakpoint
ALTER TABLE `quoteAcceptances` ADD `organizationId` int NULL;
--> statement-breakpoint
ALTER TABLE `variations` ADD `organizationId` int NULL;
--> statement-breakpoint
UPDATE `jobs` j JOIN `organizations` o ON o.`ownerUserId` = j.`userId` SET j.`organizationId` = o.`id`;
--> statement-breakpoint
UPDATE `paymentRequests` p JOIN `organizations` o ON o.`ownerUserId` = p.`userId` SET p.`organizationId` = o.`id`;
--> statement-breakpoint
UPDATE `priceBookItems` p JOIN `organizations` o ON o.`ownerUserId` = p.`userId` SET p.`organizationId` = o.`id`;
--> statement-breakpoint
UPDATE `quoteAcceptances` a JOIN `organizations` o ON o.`ownerUserId` = a.`userId` SET a.`organizationId` = o.`id`;
--> statement-breakpoint
UPDATE `variations` v JOIN `organizations` o ON o.`ownerUserId` = v.`userId` SET v.`organizationId` = o.`id`;
--> statement-breakpoint
ALTER TABLE `jobs` MODIFY `organizationId` int NOT NULL;
--> statement-breakpoint
ALTER TABLE `paymentRequests` MODIFY `organizationId` int NOT NULL;
--> statement-breakpoint
ALTER TABLE `priceBookItems` MODIFY `organizationId` int NOT NULL;
--> statement-breakpoint
ALTER TABLE `quoteAcceptances` MODIFY `organizationId` int NOT NULL;
--> statement-breakpoint
ALTER TABLE `variations` MODIFY `organizationId` int NOT NULL;
--> statement-breakpoint
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `paymentRequests` ADD CONSTRAINT `paymentRequests_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `priceBookItems` ADD CONSTRAINT `priceBookItems_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `quoteAcceptances` ADD CONSTRAINT `quoteAcceptances_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `variations` ADD CONSTRAINT `variations_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `jobs_organization_status_updated_idx` ON `jobs` (`organizationId`,`status`,`updatedAt`);
--> statement-breakpoint
CREATE INDEX `payment_requests_organization_updated_idx` ON `paymentRequests` (`organizationId`,`updatedAt`);
--> statement-breakpoint
CREATE INDEX `price_book_organization_status_idx` ON `priceBookItems` (`organizationId`,`status`,`trade`);
--> statement-breakpoint
CREATE INDEX `quote_acceptances_organization_status_idx` ON `quoteAcceptances` (`organizationId`,`status`);
--> statement-breakpoint
CREATE INDEX `variations_organization_status_updated_idx` ON `variations` (`organizationId`,`status`,`updatedAt`);
