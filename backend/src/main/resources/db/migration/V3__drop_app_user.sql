-- Login was removed from the app. V1 has already run on staging and prod, so it stays as it is
-- and this migration removes the table. The schema is empty after this.
drop table app_user;
