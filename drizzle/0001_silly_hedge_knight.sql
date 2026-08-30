CREATE TABLE `orders` (
	`id` varchar(64) NOT NULL,
	`buyerEmail` varchar(320) NOT NULL,
	`totalAmount` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` varchar(64) NOT NULL,
	`orderId` varchar(64) NOT NULL,
	`status` enum('valid','used') NOT NULL DEFAULT 'valid',
	CONSTRAINT `tickets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_orderId_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action;