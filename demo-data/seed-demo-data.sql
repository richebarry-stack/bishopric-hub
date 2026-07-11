-- Fake demo data for the public bishopric-hub demo instance.
-- Every name, calling, and date below is invented for demonstration purposes only —
-- none of it corresponds to any real person, ward, or church record.
-- Safe to commit: contains no real personal information.

-- ── Login accounts ──────────────────────────────────────────────────────────
-- Password for the demo bishop account is "DemoPass2026" (SHA-256 hash below;
-- the app auto-upgrades it to a salted hash on first login). The two guest
-- accounts (guest_yc / guest_sac) already exist from migration 0053_guest_types.sql
-- and need no password — they're reached via the app's "Continue as guest" buttons.
INSERT INTO users (name, email, password_hash, role, church_role, hub) VALUES
  ('Demo Bishop', 'bishop@demo.example', 'cc15b267fe6b543d4ad6236567a5267be0e60bce787f92e7182c6cbd0bc3f46f', 'admin', 'Bishop', 'both');

-- ── Ward Members ─────────────────────────────────────────────────────────────
-- Adults
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date, recommend_type, recommend_expires) VALUES ('Mark', 'Ashworth', 1, 'M', '1978-03-14', 'Endowed', '2026-11');
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date, recommend_type, recommend_expires) VALUES ('Carla', 'Ashworth', 1, 'F', '1980-07-22', 'Endowed', '2026-11');
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date) VALUES ('Derek', 'Bellamy', 1, 'M', '1975-01-09');
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date, recommend_type, recommend_expires) VALUES ('Susan', 'Bellamy', 1, 'F', '1976-05-30', 'Limited', '2026-09');
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date) VALUES ('Paul', 'Caldwell', 1, 'M', '1965-11-02');
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date) VALUES ('Diane', 'Caldwell', 1, 'F', '1967-02-18');
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date, preferred_first_name) VALUES ('Nathaniel', 'Donnelly', 1, 'M', '1983-09-05', 'Nate');
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date) VALUES ('Rebecca', 'Donnelly', 1, 'F', '1984-12-11');
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date, recommend_type, recommend_expires) VALUES ('James', 'Ellsworth', 1, 'M', '1990-06-25', 'Endowed', '2026-08');
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date) VALUES ('Katherine', 'Ellsworth', 1, 'F', '1991-04-17');
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date, out_of_ward) VALUES ('Gregory', 'Fenwick', 1, 'M', '1970-08-30', 1);
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date) VALUES ('Linda', 'Fenwick', 1, 'F', '1972-10-14');
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date) VALUES ('Todd', 'Garrison', 1, 'M', '1988-01-27');
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date) VALUES ('Michelle', 'Garrison', 1, 'F', '1989-03-08');
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date) VALUES ('Robert', 'Halloway', 0, 'M', '1960-05-19');
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date) VALUES ('Patricia', 'Halloway', 0, 'F', '1962-07-23');
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date) VALUES ('Victor', 'Ibarra', 1, 'M', '1982-11-30');
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date, exclude_speakers) VALUES ('Elena', 'Ibarra', 1, 'F', '1985-02-14', 1);
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date) VALUES ('Curtis', 'Jorgensen', 1, 'M', '1979-09-21');
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date) VALUES ('Amanda', 'Jorgensen', 1, 'F', '1980-12-02');
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date, recommend_type, recommend_expires) VALUES ('Steven', 'Kingsley', 1, 'M', '1973-04-08', 'Endowed', '2026-10');
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date, recommend_type, recommend_expires) VALUES ('Julie', 'Kingsley', 1, 'F', '1974-06-16', 'Endowed', '2026-10');
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date, exclude_prayers) VALUES ('Adam', 'Larkin', 1, 'M', '1992-08-11', 1);
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date) VALUES ('Brianna', 'Larkin', 1, 'F', '1993-10-27');
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date) VALUES ('Douglas', 'Mercer', 1, 'M', '1968-01-05');
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date) VALUES ('Cynthia', 'Mercer', 1, 'F', '1969-03-19');
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date) VALUES ('Ryan', 'Osgood', 1, 'M', '1987-07-02');
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date) VALUES ('Natalie', 'Osgood', 1, 'F', '1988-09-13');
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date) VALUES ('Kevin', 'Pemberton', 1, 'M', '1981-12-24');
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date) VALUES ('Heather', 'Pemberton', 1, 'F', '1982-02-06');

-- Youth (ages 12-17)
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date, recommend_type, recommend_expires) VALUES ('Tyler', 'Ashworth', 1, 'M', '2010-05-12', 'Limited', '2026-12');
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date) VALUES ('Ella', 'Bellamy', 1, 'F', '2011-08-19');
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date) VALUES ('Jacob', 'Donnelly', 1, 'M', '2009-02-27');
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date) VALUES ('Sophie', 'Ellsworth', 1, 'F', '2012-11-03');
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date) VALUES ('Owen', 'Garrison', 1, 'M', '2013-04-16');
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date) VALUES ('Grace', 'Jorgensen', 1, 'F', '2010-09-29');
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date) VALUES ('Lucas', 'Kingsley', 1, 'M', '2011-01-08');

-- Children (under 12)
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date) VALUES ('Mia', 'Ashworth', 1, 'F', '2017-06-21');
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date) VALUES ('Noah', 'Bellamy', 1, 'M', '2018-10-05');
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date) VALUES ('Ava', 'Donnelly', 1, 'F', '2016-03-30');
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date) VALUES ('Liam', 'Garrison', 1, 'M', '2019-12-14');
INSERT INTO ward_members (first_name, last_name, active, gender, birth_date) VALUES ('Chloe', 'Kingsley', 1, 'F', '2015-07-09');

-- ── Calling Pipeline ─────────────────────────────────────────────────────────
INSERT INTO calling_pipeline (member, calling, status, assigned_to, type, organization) VALUES ('Todd Garrison', 'Elders Quorum President', '3. Approved and assigned', 'Demo Bishop', 'Calling', 'Elders Quorum');
INSERT INTO calling_pipeline (member, calling, status, assigned_to, type, organization) VALUES ('Michelle Garrison', 'Relief Society Teacher', '3. Approved and assigned', 'Demo Bishop', 'Calling', 'Relief Society');
INSERT INTO calling_pipeline (member, calling, status, assigned_to, type, organization) VALUES ('Victor Ibarra', 'Ward Mission Leader', '5. Sustained', 'Demo Bishop', 'Calling', 'Ward Mission');
INSERT INTO calling_pipeline (member, calling, status, assigned_to, type, organization) VALUES ('Elena Ibarra', 'Primary Chorister', '6. Set apart', 'Demo Bishop', 'Calling', 'Primary');
INSERT INTO calling_pipeline (member, calling, status, assigned_to, type, organization) VALUES ('Curtis Jorgensen', 'Sunday School Teacher', '4. Called & accepted', 'Demo Bishop', 'Calling', 'Sunday School');
INSERT INTO calling_pipeline (member, calling, status, assigned_to, type, organization) VALUES ('Amanda Jorgensen', 'Young Women Secretary', '2. Pray about', '', 'Calling', 'Young Women');
INSERT INTO calling_pipeline (member, calling, status, assigned_to, type, organization) VALUES ('Steven Kingsley', 'High Priests Group Leader', '1. Discussion', '', 'Calling', 'High Priests');
INSERT INTO calling_pipeline (member, calling, status, assigned_to, type, organization) VALUES ('Adam Larkin', 'Deacons Quorum Adviser', '9. Released', 'Demo Bishop', 'Calling', 'Young Men');
INSERT INTO calling_pipeline (member, calling, status, assigned_to, type, organization) VALUES ('Douglas Mercer', 'Ward Clerk', '7. Need to release', 'Demo Bishop', 'Calling', 'Ward');
INSERT INTO calling_pipeline (member, calling, status, assigned_to, type, organization) VALUES ('Ryan Osgood', 'Executive Secretary', '8. Need to thank at pulpit', 'Demo Bishop', 'Calling', 'Ward');

-- ── Interview Pipeline ───────────────────────────────────────────────────────
-- Youth interviews (linked to youth ward members by name match)
INSERT INTO interview_pipeline (member, type_of_interview, status, assigned_to, date_recommend_expires, ward_member_id)
  SELECT 'Ashworth, Tyler', 'Youth 16-17', 'Unassigned', '', '2026-12', id FROM ward_members WHERE first_name = 'Tyler' AND last_name = 'Ashworth';
INSERT INTO interview_pipeline (member, type_of_interview, status, assigned_to, ward_member_id)
  SELECT 'Bellamy, Ella', 'Youth 12-15', 'Assigned', 'Demo Bishop', id FROM ward_members WHERE first_name = 'Ella' AND last_name = 'Bellamy';
INSERT INTO interview_pipeline (member, type_of_interview, status, assigned_to, ward_member_id)
  SELECT 'Donnelly, Jacob', 'Youth 16-17', 'Scheduled for Interview', 'Demo Bishop', id FROM ward_members WHERE first_name = 'Jacob' AND last_name = 'Donnelly';
INSERT INTO interview_pipeline (member, type_of_interview, status, assigned_to, ward_member_id)
  SELECT 'Garrison, Owen', 'Youth 12-15', 'Unassigned', '', id FROM ward_members WHERE first_name = 'Owen' AND last_name = 'Garrison';

-- Adult temple interviews
INSERT INTO interview_pipeline (member, type_of_interview, status, assigned_to, date_recommend_expires, ward_member_id)
  SELECT 'Ashworth, Mark', 'Endowed Temple Rec', 'Unassigned', '', '2026-11', id FROM ward_members WHERE first_name = 'Mark' AND last_name = 'Ashworth';
INSERT INTO interview_pipeline (member, type_of_interview, status, assigned_to, date_recommend_expires, ward_member_id)
  SELECT 'Bellamy, Susan', 'Limited', 'Assigned', 'Demo Bishop', '2026-09', id FROM ward_members WHERE first_name = 'Susan' AND last_name = 'Bellamy';

-- Calling & Setting Apart (linked to calling_pipeline rows)
INSERT INTO interview_pipeline (member, type_of_interview, status, assigned_to, setup_status, calling_id)
  SELECT member, 'Calling', 'Assigned', assigned_to, 'Not started', id FROM calling_pipeline WHERE calling = 'Elders Quorum President';
INSERT INTO interview_pipeline (member, type_of_interview, status, assigned_to, setup_status, calling_id)
  SELECT member, 'Calling', 'Assigned', assigned_to, 'Scheduled', id FROM calling_pipeline WHERE calling = 'Relief Society Teacher';
INSERT INTO interview_pipeline (member, type_of_interview, status, assigned_to, setup_status, calling_id)
  SELECT member, 'Setting Apart', 'Unassigned', '', 'Not started', id FROM calling_pipeline WHERE calling = 'Ward Mission Leader';

-- Other interviews
INSERT INTO interview_pipeline (member, type_of_interview, status, assigned_to, comments) VALUES ('Halloway, Robert', 'Eccl Endorsement', 'Unassigned', '', 'BYU application endorsement');
INSERT INTO interview_pipeline (member, type_of_interview, status, assigned_to, comments) VALUES ('Larkin, Adam', 'Patriarchal Blessing', 'Assigned', 'Demo Bishop', 'Referral requested');
