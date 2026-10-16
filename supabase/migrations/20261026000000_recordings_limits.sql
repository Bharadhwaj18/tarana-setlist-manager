-- Voice memo uploads: audio only, at most 50 MB each (about 55 minutes at the recorder's usual quality).
-- Before this the recordings bucket took any file of any size, and any signed-in account could upload
-- to its own folder there. The other buckets already had limits. Existing files are not affected.

update storage.buckets
   set file_size_limit = 52428800,
       allowed_mime_types = array['audio/*']
 where id = 'recordings';
