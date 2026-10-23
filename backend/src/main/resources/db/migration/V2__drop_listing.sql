-- The example listing table from V1 is not part of the app. V1 has already run on staging and prod,
-- so it stays as it is and this migration removes the table.
drop table listing;
