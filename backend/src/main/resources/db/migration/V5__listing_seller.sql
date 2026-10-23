-- Auth owns user identities; no foreign key across the auth/public schema boundary.
alter table listing add column seller_id varchar(255);
alter table listing add column seller_name varchar(255);
create index listing_seller_idx on listing(seller_id);
