-- Commit the enum addition before functions can use the new value.
alter type public.wallet_type add value if not exists 'pension';
