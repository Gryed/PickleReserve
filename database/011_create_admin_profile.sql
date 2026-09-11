insert into profiles (id, role)

values ('648650f6-c2c9-4261-9623-4c7dd8b5fe06', 'admin')

on conflict (id) do update set role = 'admin';