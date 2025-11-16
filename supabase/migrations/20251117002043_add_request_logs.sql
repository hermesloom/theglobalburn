create table request_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  method text not null,
  path text not null,
  user_id uuid references profiles,
  ip_address inet,
  country text,
  region text,
  city text,
  latitude numeric,
  longitude numeric,
  user_agent text,
  status_code integer,
  response_time_ms integer,
  error_message text
);

create index request_logs_created_at_idx on request_logs(created_at);
create index request_logs_user_id_idx on request_logs(user_id);
create index request_logs_path_idx on request_logs(path);
create index request_logs_method_idx on request_logs(method);

