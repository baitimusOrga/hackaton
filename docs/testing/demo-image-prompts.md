# Demo image prompts (V16 messy listings)

For Nano Banana 2 Pro (Gemini image mode, aspect ratio 1:1). One image per listing, **square**, the
listing cards crop square. Images live in `frontend/public/demo/<id>.jpg` (1024 px JPEG);
`V17__demo_listing_images.sql` points `image_url` to `/demo/<id>.jpg`. Every prompt was prefixed with the style
block below plus "New, independent photo." so one chat could generate them in a row. The search ignores images; they only make the demo cards look real and
can be reused as test photos for the sell flow's photo detection.

All listings are fictional. Paste the **style block** once at the start of the chat (or prepend it to every
prompt if the model drifts), then send the prompts one by one.

## Style block

```
You generate photos for a fictional Swiss second-hand marketplace demo. Every image: square 1:1, looks like a
private seller took it with a smartphone at home — natural indoor light, slightly imperfect framing, ordinary
Swiss apartment background (parquet floor, white wall, wooden table, sofa, cellar or balcony), no studio
lighting, no people or faces, no text overlays, no watermarks, no price tags. Products look used unless the
prompt says new. Show defects exactly as described and clearly visible.
```

## Prompts

### Computers

| id | prompt |
|---|---|
| 1301 | A 27-inch silver iMac (2019 model, thin aluminium chin) on a wooden desk, screen on showing a plain macOS desktop, white Magic Keyboard in front, evening lamp light. |
| 1303 | An empty original iMac 27-inch cardboard box, opened, white styrofoam inserts visible inside, standing on a parquet floor in a hallway. No computer anywhere in the picture. |
| 1305 | A 27-inch silver iMac with a black, switched-off screen on a cluttered workbench in a cellar, power cable unplugged and lying next to it, dusty. |
| 1312 | A 27-inch iMac Retina 5K from 2017 on a white desk with a white Magic Keyboard and Magic Mouse, screen showing a colourful wallpaper, daylight from a window. |
| 1314 | Only an Apple Magic Keyboard with Swiss German key layout and a white Magic Mouse 2 lying on a wooden table. No computer. |
| 1342 | A 27-inch iMac 5K (2019) with keyboard and mouse on a dining table, photographed slightly from above, screen on. |

### Laptops

| id | prompt |
|---|---|
| 1317 | A silver MacBook Air M1 opened on a sofa cushion, screen on, white USB-C charger coiled next to it. |
| 1318 | A midnight-blue MacBook Air M2, almost new, closed, lying on top of its original white Apple box on a desk. |
| 1319 | A MacBook Air M2 opened on a table, screen on; a clearly visible spider-web crack in the lower-left corner of the display with a few dead pixel lines around it. |
| 1320 | Only a white Apple 67W USB-C power adapter (no cable) lying on a wooden table. No laptop. |
| 1321 | A 13-inch space-grey MacBook Pro 2019 with Touch Bar, opened, inside a slightly worn grey felt sleeve, on a desk. |
| 1324 | Only a transparent hard-shell case for a 13-inch MacBook Air, new, still with protective film, lying on a white table. No laptop. |
| 1325 | A black Lenovo ThinkPad T14 Gen 3 opened on an office desk, red TrackPoint visible, Windows login screen on, a company-style desk background. |
| 1327 | Only a black Lenovo USB-C docking station with its power brick and cable on a desk. No laptop. |

### Monitors

| id | prompt |
|---|---|
| 1343 | A 27-inch Dell UltraSharp 4K monitor with thin bezels on a height-adjustable stand, screen on, USB-C cable plugged in, on a home-office desk. |
| 1344 | A 27-inch black Samsung Full HD monitor, screen showing a white image; a small cluster of bright stuck pixels in the top-right area is clearly visible. |
| 1345 | A 24-inch LG UltraFine 4K monitor (black, simple stand) on a desk next to a closed MacBook, screen on. |
| 1346 | Only a double monitor arm with desk clamp, lying disassembled on a carpet. No monitors. |
| 1351 | A 27-inch Dell monitor, screen on with a bright image; a clear crack running from the top-left corner of the panel, picture otherwise intact. |

### Phones

| id | prompt |
|---|---|
| 1355 | A midnight-black iPhone 13 lying on a wooden table, screen on with lock screen, a clear case next to it, tiny scratch visible on the frame edge. |
| 1356 | Only a red Apple silicone case for iPhone 13, empty, lying on a white table. No phone. |
| 1358 | An iPhone 13 on a table, screen heavily cracked with a spider-web pattern across the whole display, screen on and partly flickering. |
| 1363 | An iPhone 11 (white) with its white charging cable, lying on a kitchen counter in a French-style apartment. |
| 1368 | A green iPhone 13 in almost new condition, photographed front and back side by side on a light-grey sofa. |

### Tablets

| id | prompt |
|---|---|
| 1371 | A blue iPad Air 5 with an Apple Pencil 2 attached magnetically to its side, lying on a desk with a notebook. |
| 1372 | A silver iPad 9th generation, screen on; a small but clearly visible crack near the top edge of the glass. |
| 1373 | Only a white Apple Pencil 2nd generation lying on a wooden table. No iPad. |
| 1379 | A small Amazon Fire HD 8 Kids tablet in a thick colourful foam protective case, lying on a children's room carpet. |

### Office furniture

| id | prompt |
|---|---|
| 1381 | A black ergonomic office chair with lumbar support and adjustable armrests, light wear on the seat, standing in a small apartment room. |
| 1382 | A black Steelcase Leap V2 office chair in good condition, standing in an empty office after a clearance. |
| 1383 | A white electric height-adjustable desk 160×80 cm, raised to standing height, memory control panel visible, empty room. |
| 1389 | A black swivel office chair with lumbar support in an Italian-style apartment with a tiled floor. |
| 1391 | Only five black carpet castor wheels for an office chair, new, lying in a row on a table. No chair. |

### Audio and cameras

| id | prompt |
|---|---|
| 1399 | Black Sony WH-1000XM5 headphones with their carrying case on a bed; the ear cushions show light wear. |
| 1400 | Only an empty white AirPods Pro 2 charging case, lid open and empty — no earbuds anywhere — on a table. |
| 1477 | An AirPods Pro charging case, lid open, only the right earbud inside, the left slot clearly empty. |
| 1402 | A Canon EOS 80D DSLR with an 18-135 mm lens, two batteries and a camera bag laid out on a table. |
| 1405 | Only a Manfrotto tripod (folded) and a grey camera bag on a floor. No camera. |

### Bikes and household

| id | prompt |
|---|---|
| 1406 | A women's 28-inch Flyer e-bike with a step-through frame and a frame battery, parked in a bike cellar. |
| 1410 | A road bike with a 56 cm frame and Shimano 105 groupset leaning against a cellar wall, good condition. |
| 1412 | Only a black Giro bike helmet size M on a bench. No bike. |
| 1413 | A Stromer ST3 speed-pedelec e-bike (dark grey) with a rear rack and integrated battery, parked on a balcony. |
| 1419 | Only a Bosch PowerPack 500 e-bike battery lying on a workbench. No bike. |
| 1420 | A close-up of an aluminium road-bike frame near the bottom bracket showing a clear crack in the tube, Shimano 105 crank visible. |

### Gaming

| id | prompt |
|---|---|
| 1541 | A PlayStation 5 Disc Edition (with the disc drive bulge) standing upright under a TV, two white DualSense controllers in front. |
| 1542 | A PlayStation 5 Digital Edition (slim, no disc drive) lying flat on a shelf with one controller. |
| 1543 | A PlayStation 5 Disc Edition on a table, the disc tray area visible, a game disc lying next to it. |
| 1544 | Only a single white DualSense controller on a sofa, light wear on the thumbsticks. No console. |
| 1546 | A white Nintendo Switch OLED in its dock, Joy-Cons attached, with a carrying case and the original box next to it. |

### TV and home cinema

| id | prompt |
|---|---|
| 1571 | A 55-inch Samsung QLED TV on its stand in a living room, screen showing a colourful nature scene, remote control on the TV bench. |
| 1574 | A 65-inch TV leaning against a wall after a move, screen switched on but with a large visible crack and ink-like blotches across the panel. |
| 1575 | Only a black Samsung smart TV remote control lying on a sofa. No TV. |
| 1576 | Only a black swivel TV wall mount (VESA 600×400) with a bag of screws on a parquet floor. No TV. |
