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
