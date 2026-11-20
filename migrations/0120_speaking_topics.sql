-- Speaking Invitations (hub suggestion #42): a shared library of talk topics, each
-- with suggested scriptures and resources. Picking a topic on the Speaking
-- Invitations page fills those into the letter. Seeded with common topics and
-- scripture references only; the bishopric adds talks and links.
CREATE TABLE IF NOT EXISTS speaking_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic TEXT NOT NULL DEFAULT '',
  scriptures TEXT NOT NULL DEFAULT '',
  resources TEXT NOT NULL DEFAULT '',
  created_by TEXT,
  updated_by TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO speaking_topics (topic, scriptures) VALUES
  ('The Atonement of Jesus Christ', 'Isaiah 53:3–5; John 3:16; 2 Nephi 2:6–8; Alma 7:11–13; Doctrine and Covenants 19:16–19'),
  ('Faith in Jesus Christ', 'Hebrews 11:1, 6; Alma 32:21, 26–43; Ether 12:6; Moroni 7:33'),
  ('Repentance', 'Isaiah 1:18; Alma 34:31–33; Alma 36:17–21; Doctrine and Covenants 58:42–43'),
  ('The Sacrament', 'Luke 22:19–20; 3 Nephi 18:1–11; Moroni 4–5; Doctrine and Covenants 20:75–79'),
  ('The Holy Ghost', 'John 14:26; Galatians 5:22–23; 2 Nephi 32:5; Moroni 10:4–5; Doctrine and Covenants 8:2–3'),
  ('Prayer', 'James 1:5–6; Alma 34:17–27; Alma 37:37; 3 Nephi 18:15–21; Doctrine and Covenants 19:38'),
  ('Covenants', 'Ezekiel 37:26; Mosiah 5:5–7; Mosiah 18:8–10; Doctrine and Covenants 82:10'),
  ('The Sabbath Day', 'Exodus 20:8–11; Isaiah 58:13–14; Mark 2:27; Doctrine and Covenants 59:9–13'),
  ('Temples and Family History', 'Malachi 4:5–6; Doctrine and Covenants 109:8; Doctrine and Covenants 110:13–16; Doctrine and Covenants 128:15'),
  ('Ministering and Service', 'Matthew 25:35–40; John 13:34–35; Mosiah 2:17; Mosiah 18:8–10'),
  ('Scripture Study', 'John 5:39; 2 Timothy 3:15–17; 2 Nephi 32:3; Alma 37:44; Helaman 3:29–30'),
  ('Gratitude', 'Psalm 100:4; Luke 17:12–19; Alma 34:38; Doctrine and Covenants 59:7, 21'),
  ('Tithing', 'Malachi 3:8–10; Doctrine and Covenants 64:23; Doctrine and Covenants 119:4'),
  ('Missionary Work', 'Matthew 28:19–20; Mosiah 28:3; Doctrine and Covenants 4:1–7; Doctrine and Covenants 18:10, 15–16');
