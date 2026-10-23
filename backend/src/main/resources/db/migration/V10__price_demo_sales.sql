-- Fictional completed sales so price estimates have evidence. SOLD only: Discover and Find never show them.
-- shortcut: explicit ids far above the identity counter
insert into listing (id,title,description,price_chf,condition,category,postcode,locality,created_at,status) values
(1101,'Dell U2719D 27" QHD monitor','Sold after a week, clean panel with no dead pixels.',165.00,'GOOD','Monitors','8004','Zürich','2026-09-02T10:00:00Z','SOLD'),
(1102,'Dell UltraSharp U2719D','Barely used office monitor, sold with a DisplayPort cable.',175.00,'LIKE_NEW','Monitors','3008','Bern','2026-09-15T10:00:00Z','SOLD'),
(1103,'Dell U2719D monitor with stand','Height-adjustable stand included, sold quickly.',140.00,'GOOD','Monitors','4052','Basel','2026-09-28T10:00:00Z','SOLD'),
(1104,'Dell UltraSharp U2719D 27 inch','Some wear on the bezel, picture perfect.',120.00,'USED','Monitors','6005','Luzern','2026-10-06T10:00:00Z','SOLD'),
(1105,'Dell U2719D, box included','Original box and all cables, bought for home office.',185.00,'LIKE_NEW','Monitors','8400','Winterthur','2026-10-12T10:00:00Z','SOLD'),
(1106,'Dell U2719D (dead pixel)','One dead pixel near the corner, priced accordingly.',70.00,'DEFECTIVE','Monitors','1004','Lausanne','2026-10-16T10:00:00Z','SOLD'),
(1107,'Apple iMac 27" Retina 5K 2017 (A1419)','Runs smoothly, original keyboard and mouse included.',420.00,'GOOD','Computers','8032','Zürich','2026-08-30T10:00:00Z','SOLD'),
(1108,'iMac 27" Retina 5K 2017, 16 GB','Upgraded to 16 GB of memory, screen without marks.',480.00,'LIKE_NEW','Computers','3006','Bern','2026-09-10T10:00:00Z','SOLD'),
(1109,'Apple iMac 27" 2017 A1419 i5','Core i5 model, fresh macOS install.',390.00,'GOOD','Computers','9000','St. Gallen','2026-09-24T10:00:00Z','SOLD'),
(1110,'iMac 27" Retina 5K 2017 with keyboard','Visible wear on the stand, works without problems.',350.00,'USED','Computers','6003','Luzern','2026-10-08T10:00:00Z','SOLD'),
(1111,'Apple iMac 27" 2017, scratch on screen','A light scratch on the screen, otherwise fully working.',260.00,'USED','Computers','2502','Biel/Bienne','2026-10-14T10:00:00Z','SOLD');

insert into listing_attribute (listing_id,name,attribute_value) values
(1101,'Brand','Dell'),(1101,'Model','U2719D'),(1101,'Size','27"'),
(1102,'Brand','Dell'),(1102,'Model','U2719D'),(1102,'Size','27"'),
(1103,'Brand','Dell'),(1103,'Model','U2719D'),(1103,'Size','27"'),
(1104,'Brand','Dell'),(1104,'Model','U2719D'),(1104,'Size','27"'),
(1105,'Brand','Dell'),(1105,'Model','U2719D'),(1105,'Size','27"'),
(1106,'Brand','Dell'),(1106,'Model','U2719D'),(1106,'Size','27"'),
(1107,'Brand','Apple'),(1107,'Model','iMac 18,3 A1419'),(1107,'Year','2017'),
(1108,'Brand','Apple'),(1108,'Model','iMac 18,3 A1419'),(1108,'Year','2017'),
(1109,'Brand','Apple'),(1109,'Model','iMac 18,3 A1419'),(1109,'Year','2017'),
(1110,'Brand','Apple'),(1110,'Model','iMac 18,3 A1419'),(1110,'Year','2017'),
(1111,'Brand','Apple'),(1111,'Model','iMac 18,3 A1419'),(1111,'Year','2017');
