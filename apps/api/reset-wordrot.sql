-- Reset Wordrot user words data
DELETE FROM wordrot_user_words;

-- Reset word discovery counts but keep words
UPDATE wordrot_words SET discovery_count = 0;
