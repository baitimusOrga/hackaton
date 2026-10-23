-- New photos live in object storage (S3); older rows keep their bytes in `data`.
alter table photo add column storage_key varchar(200);
alter table photo alter column data drop not null;
