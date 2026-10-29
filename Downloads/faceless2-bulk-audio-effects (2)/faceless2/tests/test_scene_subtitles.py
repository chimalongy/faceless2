"""Actual FFmpeg regression: captions survive image cuts and scene merging."""
import ast
import math
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def functions(path, names, namespace):
    tree = ast.parse(path.read_text())
    exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n, ast.FunctionDef)
                                 and n.name in names], type_ignores=[]), str(path), 'exec'), namespace)

class CaptionIntegration(unittest.TestCase):
    def test_scene_clock_and_merge(self):
        ns = dict(math=math, Path=Path, subprocess=subprocess, RenderInputError=ValueError)
        functions(ROOT/'modal/scene_renderer.py', {'render_scene', 'allocate_image_frames',
                  'build_ken_burns_filter', 'build_transition_filter', 'normalize_direction', 'normalize_transition'}, ns)
        functions(ROOT/'modal/scene_merger.py', {'run_ffmpeg_merge'}, ns)
        ns['output_dimensions'] = lambda resolution: (320, 240)
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            image = directory/'black.ppm'
            image.write_bytes(b'P6\n64 64\n255\n' + bytes(64*64*3))
            audio = directory/'voice.wav'
            subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i',
                            'sine=frequency=440:duration=2',str(audio)],check=True)
            js = """import {generateTikTokAss} from './src/lib/subtitle-generator.js';
            console.log(generateTikTokAss({width:320,height:240,fontSize:28,marginV:30,
              scenes:[{duration:2,transcription:{words:[{word:'CAPTION',start:.25,end:1.75}]}}]}));"""
            ass = subprocess.check_output(['node','--input-type=module','-e',js],cwd=ROOT,text=True)
            clips=[]
            # One image and multiple images exercise both renderer paths.
            for i, count in enumerate([1,2]):
                scene_dir=directory/str(i);scene_dir.mkdir()
                clip=scene_dir/'final.mp4';clips.append(clip)
                scene=dict(sceneIndex=i+1,duration=2,imagePaths=[image]*count,imagePath=image,
                           audioPath=audio,outputPath=clip,direction='zoom-in',transition='cut',
                           imageTimings=[],subtitlesAss=ass)
                ns['render_scene'](scene,.15,1.10,12,320,240,1)
                for t, visible in [(0,False),(.5,True),(1.5,True),(1.9,False)]:
                    self.assertEqual(self.has_caption(clip,t),visible)
            concat=directory/'list.txt'
            concat.write_text(''.join(f"file '{clip}'\n" for clip in clips))
            merged=directory/'master.mp4'
            ns['run_ffmpeg_merge'](concat,merged,directory/'merge.log','test',12,'ultrafast',18,'192k',1)
            for t,visible in [(.5,True),(1.9,False),(2.1,False),(2.5,True),(3.5,True),(3.9,False)]:
                self.assertEqual(self.has_caption(merged,t),visible)

    @staticmethod
    def has_caption(path,t):
        raw=subprocess.check_output(['ffmpeg','-v','error','-ss',str(t),'-i',str(path),
             '-frames:v','1','-pix_fmt','gray','-f','rawvideo','pipe:1'])
        return sum(v>160 for v in raw)>100

if __name__=='__main__': unittest.main()
