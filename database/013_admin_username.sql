update profiles
set username = 'ADMIN-001'
where id = (select id from auth.users where email = 'jaredroyo.me@gmail.com');

