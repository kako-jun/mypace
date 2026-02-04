-- Check Wordrot image generation status
SELECT text, image_status, image_url, discovery_count 
FROM wordrot_words 
ORDER BY id DESC 
LIMIT 20;
