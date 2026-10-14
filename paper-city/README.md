# Paper City 1.15

Your Citations library as a floating space colony, in 3D (isometric). Each paper is an astronaut. Each paper is a resident. Each section is a town.

## Install
1. Paper City is built into Overleaf Synced Library; you don't load it separately.
2. In the capture panel click **Open Paper City**, or right-click the extension icon and choose **Open Paper City**.
3. It connects to your library folder automatically. If it can't, click "Open library folder" and choose your library folder.

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

## Friends (new in 1.7)
Papers that share distinctive words become friends. Paper City compares each paper's keyword, title, sentence and notes; a pair needs two shared words, or one word that only those two papers use. Words found in most of your papers are ignored. Each paper keeps its 3 strongest friends.
- Lounge chats: friends who live in the same house meet in the lounge (or garden) in their free time.
- Visits: in free time, a resident walks along the walkways to visit a friend in another house, if that friend is also off work.
- Coffee breaks: friends on the same shift leave their desks to chat at the Work Hub's coffee counter.
- A chat is 3 turns: the first friend says its Notes (or sentence), the second answers with its own, then "We both cover …" with the shared words. A pink tag between them shows what they're talking about.
- Chats end when either friend's routine changes (e.g. bedtime, end of shift), or after about 13 seconds.
- Sidebar → Friends: turn chats on/off, and "Show friendship lines" to draw arcs between friends. Selecting a resident always shows its own lines with the shared words.
- A resident's card lists its friends; click one to jump to it.
- Friendships are worked out from your library each time it changes; nothing is saved to your library.
- The code is in friends.js. The 1.6 files are kept in backup-1.6/.

## Alien pets (1.15)
About 1 in 10 residents has a cute alien pet: a moon blob, three-eyed fuzzball, sky squidlet or star puff, each with its own name and colour. Pets float after their owner, sit beside them, nap at the foot of their bed, send little hearts, and bounce and look up during shooting stars. The owner's card shows the pet's name. Who has a pet stays the same each time you open Paper City.

## Shooting stars (1.14)
Sidebar → Sky → **🌠 Shooting stars**: a shower of shooting stars crosses the sky for a few seconds. Everyone stops what they're doing (sleepers get up at their bed), looks up toward the stars and says something like "Wow!" or "Make a wish!", then goes back to their routine.

## Same-name headings share a house (1.13)
- Headings with the same name (ignoring capitals and extra spaces) are one house; the papers under all of them live there together.
- Renaming that house renames every heading with that name. Dragging a resident in moves the paper under the first of those headings.
- The house's layout is saved on the first heading. Renaming a house to an existing house's name merges them.

## BibTeX and citation copy (1.12)
- Click a resident: under Notes there's a BibTeX box. Paste or edit the entry; it syncs with the viewer and the capture panel.
- The citation Last, F.M. et al., (year). PMID: n (e.g. Lu, Y. et al., (2016). PMID: 62524) appears below it. Click Copy citation.

## Guest rooms and sleepovers (1.11)
- Every house has a guest bedroom (gold floor, gold bed, suitcase) plus one spare dining chair, on top of one bed and one chair per resident.
- Friends from other houses come to stay over: in the evening they visit and chat, sleep in the guest bed, eat breakfast at the guest chair, then go to work and head home afterwards.
- Sleepovers happen on their own (sidebar: "Friends stay over in guest rooms"), one guest per house at a time.
- To invite someone yourself: click a resident, and in its Friends list click "Invite to stay over" next to a friend from another house.
- The guest's card says where it's staying; right-click a house to see who's in its guest room.

## Real floor plans (1.10)
Each house is built from its number of residents: exactly one bedroom with one bed per resident, and exactly one dining chair per resident.
- Bedrooms: bed, nightstand lamp, wardrobe and rug, each with its own door onto a hallway.
- Bathrooms: one for every 4 residents (toilet, sink, shower), spread through the house.
- A hallway runs from the front door to every corridor. Bigger houses get more corridors (wings) rather than one very long row.
- Front of the house: open-plan living room (TV, bookshelf, coffee table, sofas for everyone, lamp), a foyer, and a kitchen (sink, counter, stove, fridge) with dining tables.
- Leftover room slots become a study or a laundry room.
- When a resident moves in or out, the house is rebuilt to fit. If it grows into a neighbour, it moves to free space with its walls.
- Heading edits from the viewer no longer clash with Paper City saving its layout (Paper City re-reads the library just before every save, and sync.js now merges changes to different fields of the same entry).

## Each paper's sentence bank = its Notes (1.9)
- Click a resident. Its card has a Notes box: type one sentence per line. Those lines are what that paper says.
- This is the same Notes field as in your viewer. Edits save after a short pause and sync both ways.
- Speech bubbles cycle through the lines one at a time (hover or click to see all). In a chat, each friend says lines from its own Notes. If the Notes are one paragraph, they're split into sentences.
- Optional blanks in a line: {me} {friend} {topic} {year} {house}.
- A paper with no Notes says its captured sentence in chats.

## House lists (1.8)
- Right-click a house to list everyone who lives there, what each is doing, and who's visiting. Right-click the Work Hub to see who's there now. Click a name to jump to that resident. (Right-drag still pans.)

## Connected to your library
Paper City joins the same sync as your capture panel and viewer (it shows up as "Paper City").
- "Found town" adds a new town and a matching section heading at the bottom of your viewer.
- Renaming a town renames that section heading in your viewer, and the reverse.
- Renaming Outskirts (press Enter) adds a new section heading at the top.
- Dragging a resident to another town moves that paper under that heading.
- Each town's position, colour and walls are saved on its section row as "city", so they are in session.json and the change history with everything else.
- Only Outskirts' layout and walls in open space stay in city.json.
- It uses the extension's library.js, sync.js and bibtex.js (no copies).
