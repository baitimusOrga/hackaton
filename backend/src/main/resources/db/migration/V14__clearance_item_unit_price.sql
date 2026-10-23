-- The price per piece a company sets for a clearance item; null until it has looked at the estimate.
alter table clearance_item add column unit_price_chf numeric(12, 2);
