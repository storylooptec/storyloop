revoke all on public.audit_logs from anon;
revoke truncate, references, trigger on public.audit_logs from authenticated;
