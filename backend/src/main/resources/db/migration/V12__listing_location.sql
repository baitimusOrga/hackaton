-- postcode centroid (swisstopo), never an address; demo listings get fixed values so tests need no network
alter table listing add column latitude double precision;
alter table listing add column longitude double precision;

update listing set latitude = 46.52001, longitude = 6.63010 where postcode = '1003';
update listing set latitude = 46.53193, longitude = 6.61620 where postcode = '1004';
update listing set latitude = 46.52310, longitude = 6.64130 where postcode = '1005';
update listing set latitude = 46.93935, longitude = 7.43417 where postcode = '3007';
update listing set latitude = 46.94715, longitude = 7.44795 where postcode = '3011';
update listing set latitude = 46.96088, longitude = 7.42554 where postcode = '3012';
update listing set latitude = 47.55421, longitude = 7.58671 where postcode = '4051';
update listing set latitude = 47.53820, longitude = 7.60110 where postcode = '4053';
update listing set latitude = 47.56769, longitude = 7.61351 where postcode = '4058';
update listing set latitude = 47.05001, longitude = 8.29705 where postcode = '6003';
update listing set latitude = 47.06020, longitude = 8.29814 where postcode = '6004';
update listing set latitude = 47.03934, longitude = 8.31959 where postcode = '6005';
update listing set latitude = 47.16698, longitude = 8.50488 where postcode = '6300';
update listing set latitude = 47.19746, longitude = 8.53105 where postcode = '6340';
update listing set latitude = 47.14500, longitude = 8.47395 where postcode = '6343';
update listing set latitude = 47.37295, longitude = 8.54161 where postcode = '8001';
update listing set latitude = 47.37257, longitude = 8.51615 where postcode = '8003';
update listing set latitude = 47.37801, longitude = 8.52337 where postcode = '8004';
update listing set latitude = 47.38683, longitude = 8.52050 where postcode = '8005';
update listing set latitude = 47.39659, longitude = 8.52373 where postcode = '8037';
update listing set latitude = 47.38668, longitude = 8.48382 where postcode = '8048';
