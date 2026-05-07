import asyncio
import edge_tts
import json
import os

EN_VOICE = "en-IN-PrabhatNeural"
TE_VOICE = "te-IN-MohanNeural"

async def generate(script_file, prefix, voice):
    with open(script_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    os.makedirs('audio', exist_ok=True)

    for slide_num, text in data['slides'].items():
        filename = f'audio/{prefix}_{slide_num}.mp3'
        print(f'Generating {filename}...')
        tts = edge_tts.Communicate(text=text, voice=voice)
        await tts.save(filename)
        print(f'  Saved {filename}')

    print(f'\nDone! All {prefix} audio files generated.')

async def main():
    await generate('audio_scripts_en.json', 'en', EN_VOICE)
    await generate('audio_scripts_te.json', 'te', TE_VOICE)

asyncio.run(main())
