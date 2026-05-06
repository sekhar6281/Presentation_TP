from gtts import gTTS
import json
import os

with open('audio_scripts_te.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

os.makedirs('audio', exist_ok=True)

for slide_num, text in data['slides'].items():
    filename = f'audio/te_{slide_num}.mp3'
    print(f'Generating {filename}...')
    tts = gTTS(text=text, lang='te', slow=False)
    tts.save(filename)
    print(f'  Saved {filename}')

print('\nDone! All Telugu audio files generated.')
