from gtts import gTTS
import json
import os

def generate(script_file, prefix):
    with open(script_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    lang = data['language']
    tld  = data.get('tld', 'com')

    os.makedirs('audio', exist_ok=True)

    for slide_num, text in data['slides'].items():
        filename = f'audio/{prefix}_{slide_num}.mp3'
        print(f'Generating {filename}...')
        tts = gTTS(text=text, lang=lang, tld=tld, slow=False)
        tts.save(filename)
        print(f'  Saved {filename}')

    print(f'\nDone! All {prefix} audio files generated.')

generate('audio_scripts_en.json', 'en')
generate('audio_scripts_te.json', 'te')
