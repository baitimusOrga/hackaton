-- AI-generated photos for 12 more V18/V20 demo listings, served by the frontend from public/demo/<id>.jpg; fictional
update listing set image_url = '/demo/' || cast(id as varchar(10)) || '.jpg'
where id in (2341,2352,2353,2354,2360,2367,2423,2426,2430,2436,2441,2447);
