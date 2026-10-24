# Buying assistant eval prompts

Hand-written cases to run against the real AI over the demo data (V18 messy listings 2301–2600, V20 another 2601–2800; SOLD listings never show). "Top 5" means the first five matches; order inside the top 5 does not
matter. A refine step (`↳`) sends the follow-up as a refinement of the case above it. "Near me" cases
assume the stated postcode as the buyer's position.

| # | Prompt | Top 5 should include | Must NOT be in top 5 | Tests |
|---|---|---|---|---|
| 1 | iMac 27 Zoll 5K von 2019, max 600 Franken | 2301, 2342 | 2303, 2314, 2305, 2341, 2423 | year only in description (2301), iMac listed under Monitors (2342), empty box, keyboard and spare PSU must lose |
| 1a | ↳ doch lieber 2017, günstiger | 2312 | 2303, 2314 | refine to older + cheaper; 2312 states 2017 only in the description; 2302 (title 2017, text 2019) may appear but not above 2312 |
| 2 | Macbook air m1 or m2, budget 700 | 2317 | 2320, 2324, 2319 | typo "Macbok" (2317), charger and case are not the item, cracked M2 (2319) is defective |
| 2a | ↳ gerne mit 16 GB | 2318, 2426 | 2320, 2324 | refine adds RAM; over-budget 16 GB models may show as alternatives, accessories still out |
| 3 | Suche es MacBook Pro, Akku isch egal, bis 500 | 2321, 2430 | 2320, 2324, 2339 | Swiss German, "Akku schwach" accepted, laptop bag/case must lose |
| 4 | ThinkPad T14 mit 16GB für Homeoffice | 2325 | 2327, 2326 | dock under Laptops must not rank as a laptop; 2326 has 8gb, at most an alternative below 2325 |
| 5 | Dell 27" 4K USB-C Monitor in meiner Nähe (assume 8004) | 2343 | 2354, 2351, 2346, 2353, 2436 | near me within 25 km keeps Bern's 2354 out; cracked U2720Q, monitor arm, cables and a stand alone must lose |
| 5a | ↳ egal wo, darf auch Bern sein | 2343, 2354 | 2351, 2346, 2436 | near-duplicate in another city enters when distance is dropped |
| 6 | Bildschirm für Mac, 24 Zoll, nicht defekt | 2345 | 2344, 2351, 2352 | condition must-have excludes defects; 2× BenQ bundle is not a Mac monitor |
| 7 | iPhone 13 128GB, max 450 | 2355, 2368 | 2356, 2358, 2367, 2441 | "Iphone13" spelling; cases and charger must lose, cracked 2358 only as defective alternative |
| 7a | ↳ in meiner Nähe (assume 4051) | 2368 | 2355, 2356 | near me in Basel: 2368 stays, Zürich's 2355 drops; defective 2358 (also Basel) must rank below 2368 |
| 8 | Je cherche un iPhone pas cher, moins de 250 francs | 2363, 2360 | 2367, 2356, 2358 | French prompt, French listing (2363); accessories and defects must lose |
| 9 | iPad für Notizen mit Stift | 2371, 2447 | 2373, 2376, 2449 | pencil, folio case and keyboard case alone must not outrank an iPad that includes the pencil |
| 10 | günstiges iPad für die Schule, bis 200 | 2380, 2372, 2448 | 2373, 2376, 2379 | 2372 has a cracked but working display (USED); a kids' Fire tablet is not an iPad |
| 11 | Bürostuhl ergonomisch, Steelcase wenn möglich, bis 400 | 2382 | 2391, 2387 | typo "Bürostul" (2381) may appear; castors and the broken gas spring must lose |
| 12 | Sedia da ufficio vicino a Zugo (assume 6300) | 2389, 2382 | 2391, 2387 | Italian prompt and listing, near me around Zug/Baar (8048 is just inside 25 km, so 2381 may appear) |
| 13 | elektrischer Schreibtisch 160x80 | 2383 | 2384, 2390 | dimensions written as "160x80" vs "160 x 80 cm"; manual and small desks rank lower, 2454 (140x70) at most an alternative |
| 14 | Rennvelo Rahmen 56cm, max 900 | 2410, 2411 | 2412, 2420 | "Velo, super Zuestand" with the model only in the text; helmet and broken frame must lose |
| 14a | ↳ doch neuer als 2019 | 2416 | 2412, 2420 | refine raises the year; 2416 is 54cm, so it may be an alternative |
| 15 | E-Bike zum Pendeln bis 1500 | 2406, 2531 | 2419, 2409, 2528 | e-bike listed under Household (2406), Italian listing (2531); battery only, child trailer and the e-bike whose battery no longer charges must lose |
| 16 | vélo électrique rapide 45 km/h | 2413 | 2419 | French prompt, all-caps title (2413), S-Pedelec near-duplicates; 2539 (ST1) may appear |
| 17 | Kamera für Anfänger mit Objektiv, max 500 | 2402, 2492, 2498 | 2405, 2494, 2502, 2505 | bag, tripod, lens alone, spare batteries and backpack must lose |
| 18 | AirPods oder gute Kopfhörer mit Noise Cancelling | 2399, 2475 | 2400, 2477, 2485 | AirPods case only, AirPods with an earbud missing and replacement ear pads must not outrank real headphones |
| 19 | PS5 mit Laufwerk, bis 450 | 2541, 2569 | 2542, 2543, 2544, 2545, 2564 | digital edition has no drive, the broken drive is defective; controller, games and covers are not a console |
| 19a | ↳ digital reicht auch, günstiger | 2542 | 2544, 2545, 2564 | refine drops the disc requirement and lowers the budget |
| 20 | Nintendo Switch OLED | 2546, 2565 | 2547, 2549, 2558, 2561 | Switch Lite is a different model; games, dock and joy-cons are accessories |
| 21 | Konsole mit 2 Controller für die Kinder, max 400 | 2550, 2541 | 2544, 2566, 2561 | "Konsole + 2 Controller" with the model only in the description (2550); single controllers must lose |
| 22 | PS4 pas cher | 2553, 2554 | 2545 | French prompt and listing; 2554 hints the games stay on the seller's account |
| 23 | OLED TV 55 Zoll | 2572, 2595 | 2574, 2575, 2576 | "55 Zoll" vs `55"`; 2595 has burn-in (USED); cracked panel, remote and wall mount must lose |
| 23a | ↳ lieber 65 Zoll, darf mehr kosten | 2588, 2582 | 2574, 2576 | refine changes the size; cracked 65" (2574) must stay out |
| 24 | Fernseher 139 cm 4K bis 500 | 2573, 2571, 2586 | 2575, 2576, 2592 | size in cm (2573) vs 55 inch; remote, wall mount and the striped TCL must lose |
| 25 | Beamer für Filmabende, Full HD oder 4K | 2578, 2598 | 2579, 2587 | screen alone and a dim mini projector rank lower; office beamer under Office equipment (2462) may appear |
| 26 | Soundbar zum Fernseher | 2577, 2589 | 2571, 2599 | soundbar vs TV; 2589 lacks the remote; an HDMI cable is not a soundbar |
| 27 | téléviseur près de Lausanne (assume 1003) | 2580 | 2593 | near me in Lausanne; a Chromecast nearby is not a TV |
| 28 | Kaffeemaschine Vollautomat Jura | 2407, 2513 | 2516 | French listing (2513); the Jura with error 8 is defective |
| 29 | Laserdrucker mit WLAN fürs Homeoffice | 2459, 2393 | 2467, 2395 | toner alone and a jamming printer must lose |
| 30 | Bluetooth Lautsprecher für draussen | 2478, 2487 | 2479, 2485 | Italian listing (2487); passive shelf speakers need an amplifier |
| 31 | Dyson Staubsauger mit gutem Akku | 2509 | 2521, 2408, 2518 | battery only and two "Akku schwach" listings must lose |
| 32 | Steelcase Leap V2, max 400 | 2703, 2704, 2707 | 2706, 2717 | near-duplicates in three cities, French listing (2707); broken gas spring and headrest alone must lose |
| 32a | ↳ in meiner Nähe (assume 3011) | 2704 | 2703, 2707, 2717 | near me in Bern keeps only the Bern Leap |
| 33 | Herman Miller Bürostuhl bis 500 | 2711, 2712 | 2715 | all-caps title (2712); Embody with a loose armrest is defective and over budget |
| 34 | Stromer ST3 in der Nähe (assume 3007) | 2747 | 2769, 2748, 2749 | near me in Bern; the spare battery is not a bike, Zürich and Luzern ST3s drop |
| 34a | ↳ egal wo, max 3000 | 2747, 2749 | 2769 | distance dropped; 2749 has a weak battery (USED) but fits the budget |
| 35 | Rennvelo 56 bis 1500 (assume 8004, in meiner Nähe) | 2758, 2763, 2410 | 2764, 2765, 2412 | broken fork, frame set without parts and a helmet must lose |
| 36 | iPhone 15 Pro, 128 oder 256 GB | 2675, 2691 | 2683, 2692 | case and MagSafe charger are not the phone |
| 36a | ↳ günstiger, iPhone 14 geht auch | 2673, 2679, 2693 | 2682, 2683 | refine widens the model; French listing (2679); cracked 14 (2682) is defective |
| 37 | LG OLED C1 55 Zoll | 2787, 2572 | 2797, 2795 | model written as OLED55C1 vs "C1"; the stand alone and a broken LG panel must lose |
| 38 | ThinkPad T14 Gen 2 mit 16GB, max 500 | 2634, 2650 | 2640, 2641 | spare battery and a flickering Gen 3 must lose |
| 39 | MacBook Air M1 in meiner Nähe (assume 1003) | 2628 | 2632, 2649 | near me in Lausanne, French listing; charger and case must lose |
| 40 | Switch mit Mario Kart für die Kinder, max 250 | 2785, 2548 | 2784, 2783, 2782 | console bundles vs games only, a controller alone and a broken display |

Not covered: photos, sold listings (only price evidence), descriptions longer than the 160 characters the
ranking prompt sends.
