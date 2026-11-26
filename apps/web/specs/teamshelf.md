# Teamshelf: test plan

What the end-to-end tests cover, by area. Each line is a test in `e2e/<area>.spec.ts`, run against mock mode (`src/mock`). Every case starts from a fresh browser with a mock screen (`openScreen`). Add the cases for a feature here when building it (see CLAUDE.md), and keep this list and the tests in step.

## Public pages and search engines (`public.spec.ts`, plus `scripts/check-build.mjs` on the build)

- The front page says what Teamshelf is, with "Create an organization" (→ /signup) and "Sign in" (→ /login).
- The hero shows the app itself, loaded.
- Header section links glide to their section without changing the address.
- Every feature is named on the page.
- Someone signed in on this browser is offered "Open Teamshelf" instead, going straight to the organization used last (or /organizations).
- Both ways in are in the page as drawn on the server; a class set before the first paint shows the right one, so nothing moves.
- `/`, `/login`, `/signup`: own title, description, `index` robots, canonical address, Open Graph and Twitter tags.
- The front page has its structured data (WebSite, Organization, SoftwareApplication).
- The app's pages say `noindex, nofollow`.
- robots.txt is plain text and names the sitemap.
- Build: each public page is drawn with its text; one of each head tag; the shell is `noindex`; the sitemap lists exactly the public pages.

## Signing in and signing up (`auth.spec.ts`)

- Sign-in asks for an email only, no password.
- Sent to sign in by a page that needs it: the form shows (no waiting screen), and the address keeps where to go back.
- A way back that would lead to another site (`/login?redirect=/\evil.example`, which a browser reads as `//evil.example`) is ignored: after signing in, the person stays on Teamshelf.
- "Your organizations" isn't offered on a browser with no organizations; it is when signing in to another one, and goes there.
- Sign-in links to creating an organization ("New to Teamshelf?"), and creating links back to signing in ("Already use Teamshelf?").
- An address that isn't an email is refused under the field; typing again clears the message.
- An empty field is refused.
- Enter sends the link, like the button.
- After sending: the address (trimmed, lower case), a 0:SS countdown, no resend yet, and "Use another email" back.
- When the countdown ends, "Resend email" appears.
- A link that expired says so, and the address has no error in it.
- /signup asks for the email that will own the organization.
- /login?intent=create goes to /signup.
- An email already signed in on this browser skips the link (→ /new).
- An email that may not create organizations comes back to /signup with the reason, the email filled in.

## Organizations (`orgs.spec.ts`)

- No organization yet: a welcome, and the two ways in (create → /signup, sign in → /login?intent=join).
- Each organization signed in is listed with its email; "Sign out of all" with more than one.
- An organization the open email may join by domain is offered to join.
- Opening an organization goes to its address.
- Going to create one (or sign in to another) and back stays on the page: the list shows at once, without loading again.
- From creating one, "Sign in" is for another organization (→ /login?intent=join), with the way back.
- An email at an allowed domain joins with one click, and lands in the organization.
- An organization this email can't open offers another email (→ /login?intent=join&redirect=…), and a way back.
- Creating: the URL follows the name until typed itself; the URL keeps only a-z, 0-9 and dashes; a name is needed; reserved addresses (signup, login, open, organizations) are refused; one character is too short; a taken address is refused; creating opens the new organization, which starts without spaces and offers to create one.
- An organization without spaces offers to create one.

## The board (`board.spec.ts`)

- Org Admin: "Add link", and sees links restricted to admins (marked).
- Member: "Suggest link" instead, no admin-only links, no private spaces they aren't in.
- A private space opens for its people. Who sees a space is an icon after its name in the top bar: a lock in amber when private, a globe in green when open to the organization (named for screen readers); the sidebar shows neither. On the board the space's name isn't a link (it is the page itself).
- Only a space's admins see its settings link: in the top bar, and as a gear on the space's line in the sidebar (shown on the open space, and on another one pointed at); a space they don't run has none.
- Every group shows its links and count.
- An empty space says so.
- Quick find: "/" focuses it; typing lists matches with their group; matches name, group or address; no match says so; arrows move, Enter opens in a new tab; Escape closes; a recently opened link is offered before typing.
- Recent links (the search before typing): a link's × takes it off the list without opening it (shown on the line pointed at or chosen, always on a phone); Delete (⌘⌫ on a Mac) removes the chosen one and the next is chosen; removing the last one closes the list; "Clear" empties it and its toast's Undo brings it back; search results have no ×, no "Clear", and Delete does nothing to them.
- Adding: an admin's link is on the board at once; a member's suggestion waits and isn't on the board; refused names with their reason (generic, " - ", already in the group); a name may start with its group's name; an address is needed.
- Own view: hiding a link takes it off your board, the hidden view brings it back; copying a link's address.
- Your own changes to a space's layout (the layout button beside "Add"): someone who changed nothing sees it marked "Default", with nothing to reset; a board you changed is marked on the button and in its menu, resets to the default (which can be undone); the first change says only you see it (an admin's too, with the way to the editor); a space's admin can save their own changes as the default layout, after confirming, and someone who isn't can't; a resized card keeps its height when folders in it open or close; "Auto height" in its menu goes back to the space's height (or, while editing, to as tall as its links).
- Editing the default layout: only a space's admins are offered it, in the layout menu (not on a phone); the top bar steps back and a dock at the bottom says which space is edited, with nothing to save until something changes ("Close" leaves); a change is saved for everyone and isn't the admin's own; discarding asks first and leaves the layout as it was; while editing, hiding for yourself is off and a group's links can be sorted A to Z.

## Folders (`folders.spec.ts`)

Documentation in Data (screens `board-folders`, `board-folders-member`): folders inside folders, up to 6 deep.

- Folders come first in a card, A to Z, each with how many links it holds at any depth; they start closed, for everyone, a new one too (and the folders inside one stay closed until opened themselves); opening one shows what is in it, indented, and closing it folds that away (sliding); which folders a person opened is kept with their preferences, so they stay open when the page is opened again, on any device.
- An admin of the space: "New folder…" in the group's menu; "New folder inside…", "Rename…", "Move to…" and "Delete folder…" in a folder's menu; a name already used beside it is refused with the reason; an empty folder shows (and says it is empty).
- Adding into a folder: "Add to this folder…" opens the form with the folder chosen, and the link lands in it; the form's Folder is a combobox like Group: the group's folders as a tree, found by typing any part of their path, shown by their path once chosen; a group without folders has no Folder field.
- Moving: a link's menu moves it to another folder; a folder moves with everything in it, never into itself.
- Dragging (admins of the space): a link dropped on a folder (its line, or anywhere inside it when open; the innermost wins) goes into it; held over a closed folder, the folder opens; dropped on the card's header (or the card outside any folder) it goes to the top of the group; within its own folder it is reordered as before. A member's drag only reorders within the folder.
- Deleting a folder asks first, saying what goes with it (so many links and folders); the folders inside it and their links are deleted too, and the rest of the group stays; an empty folder says it is empty.
- A member: no empty folders, and a folder's menu only offers to suggest into it; the suggestion shows its folder on the Suggestions page (mock data: Late data runbook for Runbooks, Table owners for Pipelines / Warehouse); approving puts it in that folder, and editing it first opens the form with the folder chosen.
- Search finds a link in a folder, and shows its path (Documentation / Pipelines / Warehouse).
- "Sort links A to Z" in a group's or a folder's menu (a folder's: only its own links, not other folders'): on the board, for everyone, it is their own order (as dragging is), undone by "Use the space's order"; while editing the space's layout, it is the space's order.
- A card that stopped growing says there is more below (the fade and the "N more" button) as soon as its open folders run past its end, and stops when they close or their links move away; no reload needed.
- Saving a new folder, link or document never says its own name is taken (the lists reload before the dialog closes).
- Rules in plain code (`src/features/folders/folder-tree.test.ts`): paths, the order of the tree, what is inside a folder, where a folder may move (not into itself, not past 6 levels).

## Files (`files.spec.ts`)

- Opening: a document shows with its formatting (headings, a checklist, a table), for reading until "Edit" is pressed; a text file as it is written; a picture; a PDF in a frame of its own; a file that can't be shown offers its download; Escape and the X close the viewer; a file's menu opens it too.
- Taking a file out: a download is saved under the file's own name; text is copied as it is written; a picture can be copied, a file that can't be shown can't.
- Nothing in a file runs: a document with tags and a `javascript:` link is shown as text (no script, frame or picture made from it); a web page is its source, not a page; editing such a document is editing its text.
- Nothing in a document tells on its reader: a picture from another site is fetched only when asked for; a link opens in a new tab without saying where it came from; pasting a web page into a document keeps its words, not its scripts.
- Editing: a member opens files and can't edit them; an admin edits a text file and the change is there when it is opened again; an admin edits a document with its formatting, and the rest of it comes through unharmed; leaving with changes asks first.
- A new document: needs a name, a group and something written; an admin's is on the board as a Markdown file (signs like "#" typed into it stay text); it can be saved as plain text instead, and then opens as text; the file is named after the document, or given a name of its own; a member's is sent for review; closing with something written asks first.

## Suggestions (`requests.spec.ts`)

- A reviewer sees what waits (with space › group and sender) and what they sent; a new group is marked "(new)".
- Approving puts the link on the board; approving all at once; rejecting with a reason; editing before approving opens the link form.
- A member sees only what they sent: can remove a rejected one (with its reason shown) and withdraw a waiting one.

## Team (`team.spec.ts`)

- Who may join on their own, everyone listed with role and "Invited" for those who haven't signed in.
- An invitation from outside the allowed domains waits for approval: approve it; turning down asks first.
- Inviting by email (button disabled until an email is typed).
- Making someone an Org Admin and a member again; removing asks first and says what happens.
- Your own row has no menu; a space count opens their spaces with roles.
- The space count includes every open space (everyone is in them), and only the private spaces they were added to.

## Teams (`teams.spec.ts`)

Acme has Backend (Alex, Priya), On call (Sam, Mina) and Leads (Alex, Sam). On the `teams` screens, Leadership took in Backend, Development's Security group is shown only to On call, and Datadog only to Backend.

- Team page: the teams, each with who is in it; without teams, what they are for.
- Creating a team with people picked (Create disabled until named); a name already used (ignoring case) is refused under the name.
- Editing a team: renaming it and taking someone out; deleting asks first and says its people stay in the organization.
- The space count on the Team page includes a private space someone is in through a team.
- People who manage teams: an Org Admin lets someone manage teams and stops it (marked "Manages teams"); they get the Team page, see everyone without menus, no Invite and no invitations waiting; they see every team, "by" whoever created the ones they can't change, and change only their own; a team they create is theirs to change; a member who doesn't manage teams has no Team page.
- A private space: lists the teams it took in with how many people each has; adding a team (teams already in aren't offered) and removing it; opening it to everyone says its teams are taken off too; an open space has no teams; someone in a team it took in sees it.
- Groups and links: a member doesn't see a group shown to a team they aren't in (nor its links) and sees a link shown to their team; admins of the space see every group, a restricted one marked with a lock; showing a group only to a team ("People & teams"); choosing nobody is refused; editing a restricted group keeps its teams; showing a link only to a team.

## Settings (`settings.spec.ts`)

- Organization: rename; add and remove a join domain; a domain must look like one; changing the URL warns that old links stop working, and moves there; a taken URL is refused; members don't see organization settings.
- Space: rename (Save disabled until changed); a space admin who isn't an Org Admin can't open a private space to everyone, and is warned that making one private is one-way for them; deleting a space asks first and says what goes; members can't open a space's settings.
- Open space: lists only its Admins, saying everyone in the organization sees it; "Add admins" adds admins (no role choice); removing an admin; the last admin can't stop being one.
- Making a space private asks who else keeps it; the people picked are listed under People after.
- Opening a private space says its members are taken off the list; afterwards only its admins are listed (the database does the same, `001_open_spaces_keep_admins.sql`).
- Private space: adding a person; inviting a new email; the people list keeps its order while choosing; removing someone.

## Frame and layout (`layout.spec.ts`)

- At 1024, 1440 and 1920px, only the board has a top bar.
- Page titles beside the board start at the same height, near the top.
- A space's settings link back to its board.
- An Org Admin is marked next to the name.
- A hidden tab doesn't reload itself when nothing new was deployed.

## On a phone (`mobile.spec.ts`, Pixel 7)

- The front page fits, and its two actions are the same full width.
- Board, team, suggestions, space settings, organization settings, organizations and sign-in don't scroll sideways.
- The sidebar opens as a drawer from the menu button and closes after choosing a space.
- On a phone, Team, Suggestions and Organization settings show the wordmark next to the menu button, back to the board.
- A new space starts from the + by the Spaces heading (no "New space" line under the spaces, except when there are none).
- A new space starts private, also for an Org Admin ("Only you see it until you add people or open it to everyone."), and opens, marked private in the top bar.
- With more spaces than fit (`many-spaces` screen), only the spaces scroll; Suggestions, Team and Organization settings stay at the bottom, in view.

## Not covered yet

- Uploading a file (the mock backend has no file storage).
- Dragging cards and links, and resizing cards and columns.
- Signing out of one organization and of all.
- The organization switcher's menu and theme switch.
