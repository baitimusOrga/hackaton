# Buying assistant eval prompts

Hand-written cases to run against the real AI over the full demo data (V6, V15 clean listings 1201–1290,
V16 messy listings 1301–1420). "Top 5" means the first five matches; order inside the top 5 does not
matter. A refine step (`↳`) sends the follow-up as a refinement of the case above it. "Near me" cases
assume the stated postcode as the buyer's position.

| # | Prompt | Top 5 should include | Must NOT be in top 5 | Tests |
|---|---|---|---|---|
| 1 | iMac 27 Zoll 5K von 2019, max 600 Franken | 1203, 1301, 1342 | 1303, 1314, 1305, 1341 | year only in description (1301), iMac listed under Monitors (1342), empty box and keyboard must lose |
| 1a | ↳ doch lieber 2017, günstiger | 1201, 1209, 1312 | 1303, 1314, 1204 | refine to older + cheaper; 1312 states 2017 only in the description; 1302 (title 2017, text 2019) may appear but not above 1209 |
| 2 | Macbook air m1 or m2, budget 700 | 1213, 1317 | 1320, 1324, 1319 | typo "Macbok" (1317), charger and case are not the item, cracked M2 (1319) is defective |
| 2a | ↳ gerne mit 16 GB | 1214, 1318 | 1320, 1324 | refine adds RAM; over-budget 16 GB models may show as alternatives, accessories still out |
| 3 | Suche es MacBook Pro, Akku isch egal, bis 500 | 1215, 1321 | 1320, 1324, 1339 | Swiss German, "Akku schwach" accepted, laptop bag/case must lose |
| 4 | ThinkPad T14 mit 16GB für Homeoffice | 1325, 1218 | 1327, 1326 | dock under Laptops must not rank as a laptop; 1326 has 8gb, at most an alternative below 1325 |
| 5 | Dell 27" 4K USB-C Monitor in meiner Nähe (assume 8004) | 1343, 1229 | 1354, 1351, 1346, 1353 | near me within 25 km keeps Bern's 1354 out; cracked U2720Q, monitor arm and cables must lose |
| 5a | ↳ egal wo, darf auch Bern sein | 1343, 1354, 1229 | 1351, 1346 | near-duplicate in another city enters when distance is dropped |
| 6 | Bildschirm für Mac, 24 Zoll, nicht defekt | 1345 | 1344, 1351, 1352 | condition must-have excludes defects; 2× BenQ bundle is not a Mac monitor |
| 7 | iPhone 13 128GB, max 450 | 1355, 1368 | 1356, 1358, 1367 | "Iphone13" spelling, case and charger must lose, cracked 1358 only as defective alternative |
| 7a | ↳ in meiner Nähe (assume 4051) | 1368 | 1355, 1356 | near me in Basel: 1368 stays, Zürich's 1355 drops; defective 1358 (also Basel) must rank below 1368 |
| 8 | Je cherche un iPhone pas cher, moins de 250 francs | 1363, 1360, 1244 | 1367, 1356, 1358 | French prompt, French listing (1363); accessories and defects must lose |
| 9 | iPad für Notizen mit Stift | 1371, 1248 | 1373, 1376 | Pencil alone and folio case must not outrank an iPad that includes the pencil |
| 10 | günstiges iPad für die Schule, bis 200 | 1380, 1372 | 1373, 1376, 1379 | 1372 has a cracked but working display (USED); a kids' Fire tablet is not an iPad |
| 11 | Bürostuhl ergonomisch, Steelcase wenn möglich, bis 400 | 1382, 1255 | 1391, 1387 | typo "Bürostul" (1381) may appear; castors and the broken gas spring must lose |
| 12 | Sedia da ufficio vicino a Zugo (assume 6300) | 1389, 1382 | 1391, 1387 | Italian prompt and listing, near me around Zug/Baar (8048 is just inside 25 km, so 1381 may appear) |
| 13 | elektrischer Schreibtisch 160x80 | 1383, 1260 | 1384, 1390 | dimensions written as "160x80" vs "160 x 80 cm"; manual and small desks rank lower |
| 14 | Rennvelo Rahmen 56cm, max 900 | 1410, 1411 | 1412, 1420 | "Velo, super Zuestand" with the model only in the text; helmet and broken frame must lose |
| 14a | ↳ doch neuer als 2019 | 1416 | 1412, 1420, 1270 | refine raises the year; 1416 is 54cm, so it may be an alternative; vintage 1270 must drop |
| 15 | E-Bike zum Pendeln bis 1500 | 1406, 1273 | 1419, 1409 | e-bike listed under Household (1406); battery only and child trailer must lose |
| 16 | vélo électrique rapide 45 km/h | 1413, 1265 | 1419 | French prompt, all-caps title (1413), S-Pedelec near-duplicates |
| 17 | Kamera für Anfänger mit Objektiv, max 500 | 1402 | 1405 | bag and tripod without a camera must lose |
| 18 | AirPods oder gute Kopfhörer mit Noise Cancelling | 1399, 1276 | 1400 | AirPods case only (1400) must not outrank real headphones |

Not covered: photos (all `image_url` null), sold listings, descriptions longer than the 160 characters the
ranking prompt sends.
