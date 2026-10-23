alter table listing add column status varchar(20) default 'AVAILABLE' not null;

-- Fictional demo listings, no real people's data.
-- shortcut: explicit ids far above the identity counter
insert into listing (id,title,description,price_chf,condition,category,postcode,locality,created_at) values
(1001,'Apple iMac 27 inch','Older iMac, runs fine for office work and browsing. Power cable included, no keyboard.',300.00,'USED','Computers','8001','Zürich','2026-10-01T08:10:00Z'),
(1002,'iMac 27" Retina 5K (2019)','Very good condition, always used with a screen protector. Original box, Magic Keyboard and Mouse.',720.00,'LIKE_NEW','Computers','3007','Bern','2026-10-02T10:20:00Z'),
(1003,'MacBook Pro 14" M1 Pro (2021)','Battery health 91 %, a few marks on the lid. Charger included.',1250.00,'GOOD','Laptops','6003','Luzern','2026-10-03T12:00:00Z'),
(1004,'Lenovo ThinkPad T480','Reliable business laptop from an office upgrade. Docking station available on request.',290.00,'USED','Laptops','4051','Basel','2026-10-04T09:45:00Z'),
(1005,'LG 27UL850 4K monitor','USB-C with power delivery, great for a laptop setup. No dead pixels.',220.00,'GOOD','Monitors','6300','Zug','2026-10-05T16:30:00Z'),
(1006,'Samsung 24" office monitor','Simple full HD monitor, HDMI cable included. Stand slightly wobbly.',70.00,'USED','Monitors','1003','Lausanne','2026-10-06T11:15:00Z'),
(1007,'iPhone 13 128 GB','Always in a case, battery health 88 %. Unlocked for all networks.',390.00,'GOOD','Phones','8005','Zürich','2026-10-07T18:05:00Z'),
(1008,'Height-adjustable office desk','Electric standing desk, two memory positions. Pickup only, disassembled.',260.00,'GOOD','Office furniture','3012','Bern','2026-10-08T07:50:00Z'),
(1009,'Steelcase Leap V2 office chair','Ergonomic chair with adjustable lumbar support. Fabric clean, no tears.',420.00,'GOOD','Office furniture','8048','Zürich','2026-10-09T13:40:00Z'),
(1010,'Sony WH-1000XM4 headphones','Noise cancelling, comes with case and cable. Ear pads replaced recently.',150.00,'LIKE_NEW','Audio','6004','Luzern','2026-10-10T19:25:00Z'),
(1011,'Fujifilm X-T3 camera body','Around 12000 shutter actuations. Two batteries and charger included.',650.00,'GOOD','Cameras','4053','Basel','2026-10-11T10:00:00Z'),
(1012,'City bike, 7 gears','Solid commuter bike with lights and rack. Tyres new this spring.',180.00,'USED','Bikes','3011','Bern','2026-10-12T15:35:00Z'),
(1013,'iPad Air (2022) 64 GB','Wi-Fi model, screen without scratches. Apple Pencil not included.',380.00,'LIKE_NEW','Tablets','6340','Baar','2026-10-13T08:30:00Z'),
(1014,'Dell Latitude 5420 laptop','Office laptop, Windows 11 freshly installed. Small dent on one corner.',340.00,'GOOD','Laptops','1004','Lausanne','2026-10-14T14:10:00Z'),
(1015,'Mac mini M1','Compact and quiet desktop, perfect for home office. Original box.',450.00,'LIKE_NEW','Computers','8003','Zürich','2026-10-15T17:55:00Z'),
(1016,'Bose SoundLink Flex speaker','Waterproof Bluetooth speaker, works perfectly.',90.00,'GOOD','Audio','4058','Basel','2026-10-16T12:45:00Z'),
(1017,'Nespresso Vertuo Next coffee machine','Unopened gift, still sealed in the box.',60.00,'NEW','Household','6005','Luzern','2026-10-17T09:05:00Z'),
(1018,'USM Haller sideboard','Classic office sideboard with two doors. Some scratches on top.',900.00,'USED','Office furniture','6300','Zug','2026-10-18T16:20:00Z'),
(1019,'Samsung Galaxy S21','Cracked back glass, screen and camera work fine. Sold as defective.',120.00,'DEFECTIVE','Phones','1005','Lausanne','2026-10-19T11:50:00Z'),
(1020,'Trek FX 2 hybrid bike','Ridden one season, serviced in September. Frame size M.',520.00,'LIKE_NEW','Bikes','8037','Zürich','2026-10-19T20:15:00Z');

insert into listing_attribute (listing_id,name,attribute_value) values
(1001,'Brand','Apple'),(1001,'Color','Silver'),
(1002,'Brand','Apple'),(1002,'Model','iMac 19,1'),(1002,'Year','2019'),(1002,'Display','27" 5K'),(1002,'CPU','Intel Core i5'),(1002,'RAM','16 GB'),(1002,'Storage','512 GB'),
(1003,'Brand','Apple'),(1003,'Model','MacBook Pro 14'),(1003,'Year','2021'),(1003,'Display','14"'),(1003,'CPU','Apple M1 Pro'),(1003,'RAM','16 GB'),(1003,'Storage','512 GB'),
(1004,'Brand','Lenovo'),(1004,'Model','ThinkPad T480'),(1004,'Year','2018'),(1004,'Display','14"'),(1004,'CPU','Intel Core i5'),(1004,'RAM','16 GB'),(1004,'Storage','256 GB'),
(1005,'Brand','LG'),(1005,'Model','27UL850'),(1005,'Size','27"'),(1005,'Resolution','3840x2160'),
(1006,'Brand','Samsung'),(1006,'Model','S24F350'),(1006,'Size','24"'),(1006,'Resolution','1920x1080'),
(1007,'Brand','Apple'),(1007,'Model','iPhone 13'),(1007,'Year','2021'),(1007,'Color','Blue'),(1007,'Storage','128 GB'),
(1008,'Material','Oak veneer'),(1008,'Dimensions','160x80 cm'),(1008,'Color','White'),
(1009,'Brand','Steelcase'),(1009,'Model','Leap V2'),(1009,'Color','Black'),
(1010,'Brand','Sony'),(1010,'Model','WH-1000XM4'),(1010,'Color','Black'),
(1011,'Brand','Fujifilm'),(1011,'Model','X-T3'),(1011,'Year','2018'),(1011,'Color','Silver'),
(1012,'Brand','Cresta'),(1012,'Size','54 cm'),(1012,'Color','Green'),
(1013,'Brand','Apple'),(1013,'Model','iPad Air 5'),(1013,'Year','2022'),(1013,'Storage','64 GB'),(1013,'Color','Grey'),
(1014,'Brand','Dell'),(1014,'Model','Latitude 5420'),(1014,'Year','2021'),(1014,'CPU','Intel Core i5'),(1014,'RAM','16 GB'),(1014,'Storage','256 GB'),
(1015,'Brand','Apple'),(1015,'Model','Mac mini'),(1015,'Year','2020'),(1015,'CPU','Apple M1'),(1015,'RAM','8 GB'),(1015,'Storage','256 GB'),
(1016,'Brand','Bose'),(1016,'Model','SoundLink Flex'),(1016,'Color','Blue'),
(1017,'Brand','Nespresso'),(1017,'Model','Vertuo Next'),(1017,'Color','Black'),
(1018,'Brand','USM'),(1018,'Model','Haller'),(1018,'Material','Steel'),(1018,'Dimensions','75x35x74 cm'),(1018,'Color','White'),
(1019,'Brand','Samsung'),(1019,'Model','Galaxy S21'),(1019,'Year','2021'),(1019,'Storage','128 GB'),
(1020,'Brand','Trek'),(1020,'Model','FX 2'),(1020,'Year','2022'),(1020,'Size','M'),(1020,'Color','Black');
