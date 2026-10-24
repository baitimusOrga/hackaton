# Buying assistant eval prompts

Hand-written cases to run against the real AI over the full demo data (V6, V15 clean listings 1201–1290,
V16 messy listings 1301–1600). "Top 5" means the first five matches; order inside the top 5 does not
matter. A refine step (`↳`) sends the follow-up as a refinement of the case above it. "Near me" cases
assume the stated postcode as the buyer's position.

| # | Prompt | Top 5 should include | Must NOT be in top 5 | Tests |
|---|---|---|---|---|
| 1 | iMac 27 Zoll 5K von 2019, max 600 Franken | 1203, 1301, 1342 | 1303, 1314, 1305, 1341, 1423 | year only in description (1301), iMac listed under Monitors (1342), empty box, keyboard and spare PSU must lose |
| 1a | ↳ doch lieber 2017, günstiger | 1201, 1209, 1312 | 1303, 1314, 1204 | refine to older + cheaper; 1312 states 2017 only in the description; 1302 (title 2017, text 2019) may appear but not above 1209 |
| 2 | Macbook air m1 or m2, budget 700 | 1213, 1317 | 1320, 1324, 1319 | typo "Macbok" (1317), charger and case are not the item, cracked M2 (1319) is defective |
| 2a | ↳ gerne mit 16 GB | 1214, 1318, 1426 | 1320, 1324 | refine adds RAM; over-budget 16 GB models may show as alternatives, accessories still out |
| 3 | Suche es MacBook Pro, Akku isch egal, bis 500 | 1215, 1321, 1430 | 1320, 1324, 1339 | Swiss German, "Akku schwach" accepted, laptop bag/case must lose |
| 4 | ThinkPad T14 mit 16GB für Homeoffice | 1325, 1218 | 1327, 1326 | dock under Laptops must not rank as a laptop; 1326 has 8gb, at most an alternative below 1325 |
| 5 | Dell 27" 4K USB-C Monitor in meiner Nähe (assume 8004) | 1343, 1229 | 1354, 1351, 1346, 1353, 1436 | near me within 25 km keeps Bern's 1354 out; cracked U2720Q, monitor arm, cables and a stand alone must lose |
| 5a | ↳ egal wo, darf auch Bern sein | 1343, 1354, 1229 | 1351, 1346, 1436 | near-duplicate in another city enters when distance is dropped |
| 6 | Bildschirm für Mac, 24 Zoll, nicht defekt | 1345 | 1344, 1351, 1352 | condition must-have excludes defects; 2× BenQ bundle is not a Mac monitor |
| 7 | iPhone 13 128GB, max 450 | 1355, 1368 | 1356, 1358, 1367, 1441 | "Iphone13" spelling; cases and charger must lose, cracked 1358 only as defective alternative |
| 7a | ↳ in meiner Nähe (assume 4051) | 1368 | 1355, 1356 | near me in Basel: 1368 stays, Zürich's 1355 drops; defective 1358 (also Basel) must rank below 1368 |
| 8 | Je cherche un iPhone pas cher, moins de 250 francs | 1363, 1360, 1244 | 1367, 1356, 1358 | French prompt, French listing (1363); accessories and defects must lose |
| 9 | iPad für Notizen mit Stift | 1371, 1248, 1447 | 1373, 1376, 1449 | pencil, folio case and keyboard case alone must not outrank an iPad that includes the pencil |
| 10 | günstiges iPad für die Schule, bis 200 | 1380, 1372, 1448 | 1373, 1376, 1379 | 1372 has a cracked but working display (USED); a kids' Fire tablet is not an iPad |
| 11 | Bürostuhl ergonomisch, Steelcase wenn möglich, bis 400 | 1382, 1255 | 1391, 1387 | typo "Bürostul" (1381) may appear; castors and the broken gas spring must lose |
| 12 | Sedia da ufficio vicino a Zugo (assume 6300) | 1389, 1382 | 1391, 1387 | Italian prompt and listing, near me around Zug/Baar (8048 is just inside 25 km, so 1381 may appear) |
| 13 | elektrischer Schreibtisch 160x80 | 1383, 1260 | 1384, 1390 | dimensions written as "160x80" vs "160 x 80 cm"; manual and small desks rank lower, 1454 (140x70) at most an alternative |
| 14 | Rennvelo Rahmen 56cm, max 900 | 1410, 1411 | 1412, 1420 | "Velo, super Zuestand" with the model only in the text; helmet and broken frame must lose |
| 14a | ↳ doch neuer als 2019 | 1416 | 1412, 1420, 1270 | refine raises the year; 1416 is 54cm, so it may be an alternative; vintage 1270 must drop |
| 15 | E-Bike zum Pendeln bis 1500 | 1406, 1273, 1531 | 1419, 1409, 1528 | e-bike listed under Household (1406), Italian listing (1531); battery only, child trailer and the e-bike whose battery no longer charges must lose |
| 16 | vélo électrique rapide 45 km/h | 1413, 1265 | 1419 | French prompt, all-caps title (1413), S-Pedelec near-duplicates; 1539 (ST1) may appear |
| 17 | Kamera für Anfänger mit Objektiv, max 500 | 1402, 1492, 1498 | 1405, 1494, 1502, 1505 | bag, tripod, lens alone, spare batteries and backpack must lose |
| 18 | AirPods oder gute Kopfhörer mit Noise Cancelling | 1399, 1276, 1475 | 1400, 1477, 1485 | AirPods case only, AirPods with an earbud missing and replacement ear pads must not outrank real headphones |
| 19 | PS5 mit Laufwerk, bis 450 | 1541, 1569 | 1542, 1543, 1544, 1545, 1564 | digital edition has no drive, the broken drive is defective; controller, games and covers are not a console |
| 19a | ↳ digital reicht auch, günstiger | 1542 | 1544, 1545, 1564 | refine drops the disc requirement and lowers the budget |
| 20 | Nintendo Switch OLED | 1546, 1565 | 1547, 1549, 1558, 1561 | Switch Lite is a different model; games, dock and joy-cons are accessories |
| 21 | Konsole mit 2 Controller für die Kinder, max 400 | 1550, 1541 | 1544, 1566, 1561 | "Konsole + 2 Controller" with the model only in the description (1550); single controllers must lose |
| 22 | PS4 pas cher | 1553, 1554 | 1545 | French prompt and listing; 1554 hints the games stay on the seller's account |
| 23 | OLED TV 55 Zoll | 1572, 1595 | 1574, 1575, 1576 | "55 Zoll" vs `55"`; 1595 has burn-in (USED); cracked panel, remote and wall mount must lose |
| 23a | ↳ lieber 65 Zoll, darf mehr kosten | 1588, 1582 | 1574, 1576 | refine changes the size; cracked 65" (1574) must stay out |
| 24 | Fernseher 139 cm 4K bis 500 | 1573, 1571, 1586 | 1575, 1576, 1592 | size in cm (1573) vs 55 inch; remote, wall mount and the striped TCL must lose |
| 25 | Beamer für Filmabende, Full HD oder 4K | 1578, 1598 | 1579, 1587 | screen alone and a dim mini projector rank lower; office beamer under Office equipment (1462) may appear |
| 26 | Soundbar zum Fernseher | 1577, 1589 | 1571, 1599 | soundbar vs TV; 1589 lacks the remote; an HDMI cable is not a soundbar |
| 27 | téléviseur près de Lausanne (assume 1003) | 1580 | 1593 | near me in Lausanne; a Chromecast nearby is not a TV |
| 28 | Kaffeemaschine Vollautomat Jura | 1407, 1513, 1285 | 1516 | French listing (1513); the Jura with error 8 is defective |
| 29 | Laserdrucker mit WLAN fürs Homeoffice | 1459, 1393 | 1467, 1395 | toner alone and a jamming printer must lose |
| 30 | Bluetooth Lautsprecher für draussen | 1478, 1487 | 1479, 1485 | Italian listing (1487); passive shelf speakers need an amplifier |
| 31 | Dyson Staubsauger mit gutem Akku | 1509, 1284 | 1521, 1408, 1518 | battery only and two "Akku schwach" listings must lose |

Not covered: photos (all `image_url` null), sold listings, descriptions longer than the 160 characters the
ranking prompt sends.
