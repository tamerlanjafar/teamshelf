-- Deleting a folder deletes what is in it: its folders, at any depth, and their links (the
-- suggestions waiting for one of them too), as deleting a group does. Until now it kept them
-- and moved them up to where the folder was (010_folders.sql), which left a pile to delete
-- line by line when the whole folder was meant to go.
--
-- The folders inside already went with their parent (folders.parent_id cascades); only the
-- trigger that moved them up first kept them. The links follow their folder now. Each deleted
-- link's file is listed for deletion from storage by links_trash_file, as for any deleted link.

drop trigger folders_keep_contents on public.folders;
drop function app.keep_folder_contents();

alter table public.links drop constraint links_folder_id_fkey;
alter table public.links add constraint links_folder_id_fkey foreign key (folder_id) references public.folders(id) on delete cascade;
