-- PostgreSQL requires this enum value to commit before later statements can use it.
alter type public.order_status add value if not exists 'prepared' after 'preparing';
