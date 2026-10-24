-- The older demo listings without photos (V4 contract demos 1–3, V6 1001–1020, V15 1201–1290) give way to the
-- V18–V20 demo data. Only rows that are still untouched demos go: no seller, no photo, no bid, no clearance item.
-- The V10 sold price evidence (1101–1111) and the V17 demo auctions stay.
delete from listing_attribute where listing_id in (
    select l.id from listing l
    where (l.id between 1 and 3 or l.id between 1001 and 1020 or l.id between 1201 and 1290)
      and l.seller_id is null
      and not exists (select 1 from photo p where p.listing_id = l.id)
      and not exists (select 1 from bid b where b.listing_id = l.id)
      and not exists (select 1 from clearance_item c where c.listing_id = l.id));

delete from listing
where (id between 1 and 3 or id between 1001 and 1020 or id between 1201 and 1290)
  and seller_id is null
  and not exists (select 1 from photo p where p.listing_id = listing.id)
  and not exists (select 1 from bid b where b.listing_id = listing.id)
  and not exists (select 1 from clearance_item c where c.listing_id = listing.id);
