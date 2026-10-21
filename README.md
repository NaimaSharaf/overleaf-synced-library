# Overleaf Synced Library 2.1

The HTML viewer is the main workspace. A lightweight extension reads Overleaf selections and source text. Both use the same local folder and automatically exchange changes while open.

## Set up
1. In your current extension, save a complete JSON backup before updating.
2. Copy this package's files into the folder used by your existing unpacked extension, replacing matching files. Keep that installation instead of uninstalling it so your old browser records remain available. Reload it at `chrome://extensions`, then refresh Overleaf.
3. Open the extension panel. Click **Choose library folder**. Use a new, empty folder for this project, or select your previous Local Capture 2.0 folder to upgrade it.
4. For a new folder, open **Import an existing session** and choose your old JSON. Alternatively, use **Import this extension's old working table** if this is the same extension installation. Imports preserve sentences, links, screenshots, headings and row order. They synchronize automatically after import.
5. Open `viewer.html` from that folder in Chrome or Edge. Click **Open library folder** and choose the SAME folder.
6. Keep the capture extension panel open for Overleaf actions. Use **Reconnect folder** in either interface after restarting. Chrome may ask you to renew folder access.

The extension writes the current viewer.html into the folder when it connects. After updating the extension again, reconnect it and refresh the viewer page to load the updated viewer.

## Everyday use
- Select a citation key in Overleaf and click **Capture selection** in the extension, or **Capture from Overleaf** in the viewer. The viewer's button sends a local request to the extension. Keep the project open in a single Overleaf tab, or capture once in the intended tab to establish it as the target.
- Edit sentences, links, section headings or row order in the viewer. Edits synchronize after a short typing pause. Changes on the other side are checked about every 2.5 seconds; inactive browser tabs can be throttled, so timing is not guaranteed.
- Paste/upload/replace screenshots from either side. Images stay in separate files and load only when you open them. The sentence stays above the expanded image. Search and pagination keep the viewer to 30 rendered rows at a time.
- Use **Refresh sentence** or **Find instances** in the viewer to request fresh source text from the extension. These actions search the open source file only. Refresh uses the first matching occurrence. No bibliography fetches are enabled.
- **Sync now** flushes pending edits. Wait for the synchronized message before closing either interface. If the extension panel is closed, the viewer can still edit local data, but Overleaf requests cannot be handled until the panel reconnects.

## How updates are protected
Each successful edit writes a new, uniquely named change file. Two windows cannot overwrite each other's change files. Changes to different entries merge automatically. When both sides change the same entry, or concurrently reorder rows, both versions are retained and a conflict panel asks which one to keep. Screenshot versions can be previewed there. Editing is paused until conflicts are resolved. Entries are the unit of conflict detection, so simultaneous changes to different fields of the same entry can still require a choice.

If you lose file permissions or a write fails, a visible message explains the problem. Unsynchronized drafts remain in that open page. Folder access must be restored before they can be saved. Requests to the extension expire after 30 seconds; the viewer reports when no response was confirmed.

## Folder contents

```
viewer.html       editable viewer
session.json      compatible, latest non-conflicting snapshot
sync-base.json    initial library used to replay changes
changes/          immutable synchronization history
images/           screenshot files
requests/         viewer requests for Overleaf actions
responses/        extension replies
```

**Back up and move the entire folder**, not just session.json. The synchronization history is authoritative. Both views read it even if simultaneous snapshot writes leave session.json briefly behind. The next successful sync refreshes that snapshot. During an unresolved conflict, session.json remains the last conflict-free snapshot.

Do not manually edit or delete sync-base.json or files in changes/. Renaming images or deleting screenshots referenced by history will break those versions. Old image versions and history are intentionally retained for conflict recovery and use disk space. This version does not compact history automatically. Do not open the folder in an older 2.0 editor, which does not understand synchronization history.

Original 1.x browser tables and exported JSON files are not deleted by the upgrade. To return to the old extension, use your original JSON backup; changes in this synced format are not imported automatically by version 1.x.

## Privacy, memory and limitations
All library files stay in the chosen folder. No desktop helper, cloud server, bibliography download or third-party account is used. Overleaf access uses the existing tab through the extension. File handles are remembered locally; browser permission rules still apply.

The extension holds text metadata, synchronization metadata, and unsaved image blobs rather than the full screenshot collection. The viewer loads only requested images and releases their object URLs when closed or when the page changes. Original JSON migration briefly needs memory for the legacy embedded images. History grows with edits and is cached as metadata; this reduces image-related memory use but does not eliminate browser memory use.

Automated checks cover independent writers, simultaneous conflicts, explicit resolution, restart replay, stale snapshots, screenshot files, in-flight typing, failed writes, and viewer capture/refresh/search requests. Live signed-in Overleaf operation and visual browser testing have not been verified in this environment, and performance has not been benchmarked on your library.

## Stable controls (2.1.1)
Background sync no longer dims and re-enables the controls on every check. Foreground operations and conflict resolution still protect edits. Reconnect the extension to your library folder, then refresh viewer.html to update both interfaces.

## Open viewer button (2.1.3)
Choose or reconnect your library folder, then click Open viewer in the top toolbar. A viewer tab opens connected to that exact folder. If Chrome asks for access, click Reconnect saved folder. The portable viewer.html remains in the library folder. Keep the capture panel open for Overleaf requests.

## Keyword shortcut (2.1.4)
The current keyword appears beside Capture selection. Click it to copy the keyword and show all instances with context and line numbers from the open Overleaf source file. The keyword within the entry has the same action. The shortcut waits for background sync and does not scroll the page.

## Websurfing (2.2.0)
Select Websurfing in the extension's Mode menu, then choose an empty folder to start a separate library (or open an existing Websurfing folder). Click Add entry, enter a title and weblink, and paste or upload a screenshot. Entries sync to the folder and can be organized in the same viewer. Websurfing does not need an Overleaf tab and has no sentence capture or refresh controls. Opening an existing library selects its mode automatically. Switching modes saves pending changes first; your previous folder remains on disk.

## Heading edits merge automatically (2.2.7)
If the viewer changes a section heading while Paper City saves that section's layout (or any two windows change different fields of the same entry at the same time), the changes are now combined automatically instead of stopping sync with a "Choose which version to keep" box. A real conflict (both windows changed the same field) still asks you. Reload the extension, reconnect the folder, and refresh viewer.html; Paper City needs its matching sync.js update too.

## BibTeX and citation copy (2.3.0)
Each entry has a BibTeX box: in the capture panel (current entry), in the viewer (under Notes) and in Paper City (click a resident). Paste or edit an entry anywhere; it syncs to the other two.
Below the box, the citation is built as  Last, F.M. et al., (year). PMID: n  (e.g. Lu, Y. et al., (2016). PMID: 62524; "et al." only when there is more than one author). Click Copy citation to put it on the clipboard.
- Author: the first author's last name, then first and middle initials. Handles "Last, First Middle" and "First Middle Last", particles (van der), hyphenated first names (Jean-Paul → JP) and LaTeX accents ({\"u} → ü).
- Year: the year field, or the year in date, or the entry's Year.
- PMID: a pmid field, eprint with eprinttype = pubmed, or "PMID: 12345678" / a PubMed link in note, annote, extra or url.
- Anything missing is listed next to the citation.

## Open Paper City (2.3.1)
Click **Open Paper City** in the panel's top bar. Paper City opens in a new tab, already connected to the library folder the panel is using. (Paper City lives in the paper-city folder inside this extension, so you don't need to install it separately. If Chrome asks, click Reconnect in Paper City to allow folder access.)

## Rename headings in the panel (2.3.2)
Under Current entry, the **Section heading** box shows the heading that entry is under. Type to rename it; it syncs to the viewer and renames the matching house in Paper City.

## Notes in the panel (2.3.3)
The current entry now has a **Notes** box (between Weblink and BibTeX). It's the same Notes as in the viewer and in Paper City, and syncs both ways. In Paper City each line is something that paper says.

## Headings in the panel (2.3.5)
One **Section heading** box:
- Type in it to rename the current entry's heading (and its Paper City house).
- Click **New heading**, type a name, press Enter: a new heading is added at the end of your library and becomes a new house in Paper City. Esc or Cancel goes back.
- For an entry above your first heading, type a name and press Enter (or Add heading): the heading is inserted above that entry, so it and the entries after it move into the new house.

## Viewer fix: Remove and edits (2.3.6)
Remove (for headings and entries) and edits in the viewer could silently do nothing if the library had synced in the background since the page was drawn. Fixed. Reconnect the extension and refresh viewer.html.

## Open PDF folder (2.3.7)
Next to Choose PDF folder, **Open PDF folder** opens a tab listing the PDFs saved there (newest first, with date and size, searchable). Click Open to read one. Chrome extensions can't open Finder at a folder you picked, so the list is shown in Chrome instead.

## Heading per entry (2.3.8)
The panel's **Heading for this entry** box now changes only the current entry: type a heading (or pick one from the list) and press Enter or Apply. The entry moves under that heading (an existing heading with that name, ignoring capitals and spaces, or a new heading added at the end). Other entries and the heading's name stay as they are. To rename a heading for everything under it, rename it in the viewer or in Paper City. Esc cancels.

## Paper City is built in (2.4.0)
Paper City is part of this extension now; you only load Overleaf Synced Library. Open it with **Open Paper City** in the panel, or right-click the extension icon → **Open Paper City**. It connects to your library folder automatically (the one the panel uses). If you had Paper City loaded as its own extension, remove it in chrome://extensions. It shares library.js, sync.js and bibtex.js with the extension instead of keeping copies.

## 2.5.0 — Several screenshots per paper, click to enlarge
Each entry can now hold as many screenshots as you like. In the side panel, every paste (⌘V on **Paste screenshot**) or file you choose adds another one (you can pick several files at once). The screenshots show in order: **↑ ↓** reorder them, **✕** removes one, **Remove all** clears them. The viewer works the same way under each sentence.
Click any screenshot (panel, viewer or a conflict comparison) to see it full screen: **← →** step through that paper's screenshots, click the image for actual size, **Esc** or click outside to close.
Older entries with one screenshot keep working. Paper City still shows the first screenshot. Reload the extension, reconnect the folder, and refresh viewer.html.

## 2.5.1 — Opens on your newest entry
When you connect, reconnect or reload a library, **Current entry** is now the entry you added most recently (it used to be the first one in the list). If an entry is added from the viewer or another window, the panel switches to it, unless you're typing in the panel at that moment. New entries record when they were added. For entries saved before this update, the one lowest in the list counts as the newest.
