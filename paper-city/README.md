# Paper City 1.6

Your Citations library as a floating space colony, in 3D (isometric). Each paper is an astronaut. Each paper is a resident. Each section is a town.

## Install
1. Go to chrome://extensions, turn on Developer mode, click "Load unpacked", and choose this paper-city folder.
2. Click the Paper City icon. A city tab opens.
3. Click "Open library folder" and choose the same Citations folder your Overleaf Synced Library uses.

## Use
- Towns: every section heading in your library is a town. Papers above the first heading live in "Outskirts". Rename a town in the sidebar; the city name does not change your section heading.
- Residents: click one to see its year, sentence, notes, link and screenshot. Drag one into another town to move it there (city only).
- Speech bubbles: each resident says its Notes. Choose in the sidebar: take turns, always, or only on hover/click.
- Walls (glowing force-field blocks): "Build wall" (W) to draw, "Erase wall" (E) to remove, or "Build town wall" to wall a town with a gate. Residents can't walk through walls.
- "Move town" (M) drags a town with its residents and walls.
- Scroll to zoom. Drag empty ground, right-drag, or hold Space to pan.

## Houses and daily routine
Each section is a house with a kitchen, garden, bedroom and lounge. Furniture is added automatically, and the house grows so every resident has a bed and a kitchen chair.

There is one shared Work Hub with a desk for everyone. Glowing walkways connect every house's front door to it. The hub is placed in the middle of your houses; use Move house to drag it anywhere, and the walkways re-route themselves.
- Shifts: each house works the Day (9:00–17:30), Evening (17:00–01:30) or Night (01:00–09:30) shift, set in its sidebar card. The whole day (breakfast, lounge, bed) moves with the shift. The shift is saved on the section heading.
- Call home: "Call everyone home" (or "Call home" on one house) sends residents to their lounge until you click "Back to schedule".
- Right-click a resident to choose a new home, or type a name to build a new house and move it in.
- Day shift: 6:30 breakfast at the kitchen table, 9:00 walk to the Work Hub and work at their desk, then come home, 17:30 sofa and TV in the lounge, 22:30 sleep in their own bed.
- Each resident's times are shifted by up to half an hour so they don't all move at once.
- The clock in the sidebar can play, pause, run fast, skip to the next part of the day, or follow your real time.
- Lights come on at night.

## Connected to your library
Paper City joins the same sync as your capture panel and viewer (it shows up as "Paper City").
- "Found town" adds a new town and a matching section heading at the bottom of your viewer.
- Renaming a town renames that section heading in your viewer, and the reverse.
- Renaming Outskirts (press Enter) adds a new section heading at the top.
- Dragging a resident to another town moves that paper under that heading.
- Each town's position, colour and walls are saved on its section row as "city", so they are in session.json and the change history with everything else.
- Only Outskirts' layout and walls in open space stay in city.json.
- library.js and sync.js are copies from the capture extension. If you update those there, copy them here too.
