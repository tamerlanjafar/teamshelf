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
- Creating: the URL follows the name until typed itself; the URL keeps only a-z, 0-9 and dashes; a name is needed; reserved addresses (signup, login, open, organizations) are refused; one character is too short; a taken address is refused; creating opens the new organization.
- An organization without spaces offers to create one.

## The board (`board.spec.ts`)

- Org Admin: "Add link", and sees links restricted to admins (marked).
- Member: "Suggest link" instead, no admin-only links, no private spaces they aren't in.
- A private space opens for its people, with a lock in the sidebar.
- Only a space's admins see its settings link.
- Every group shows its links and count.
- An empty space says so.
- Quick find: "/" focuses it; typing lists matches with their group; matches name, group or address; no match says so; arrows move, Enter opens in a new tab; Escape closes; a recently opened link is offered before typing.
- Adding: an admin's link is on the board at once; a member's suggestion waits and isn't on the board; refused names with their reason (generic, group name in front, " - ", already in the group); an address is needed.
- Own view: hiding a link takes it off your board, the hidden view brings it back; copying a link's address.

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
- A new space starts from the + by the Spaces heading (no "New space" line under the spaces, except when there are none).
- A new space starts private, also for an Org Admin ("Only you see it until you add people or open it to everyone."), and opens; the sidebar shows its lock.
- With more spaces than fit (`many-spaces` screen), only the spaces scroll; Suggestions, Team and Organization settings stay at the bottom, in view.

## Not covered yet

- Uploading a file (the mock backend has no file storage).
- Dragging cards and links, and resizing cards and columns.
- Signing out of one organization and of all.
- The organization switcher's menu and theme switch.
