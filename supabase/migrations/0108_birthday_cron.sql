-- Ευχές γενεθλίων (Ρυθμίσεις → Ειδοποιήσεις): ελέγχει κάθε ώρα και στέλνει μετά την ώρα που ορίστηκε.
select cron.unschedule('oramira:birthdays') where exists (select 1 from cron.job where jobname = 'oramira:birthdays');
select cron.schedule('oramira:birthdays', '20 * * * *', $$select public.call_app_cron('birthdays')$$);
