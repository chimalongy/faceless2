"""Run with python3 tests/test_scene_renderer.py; requires ffmpeg/ffprobe.
Load pure functions from the deployed module without starting Modal services.
"""
import ast
import json
import math
from pathlib import Path
import subprocess
import tempfile
import unittest

source = Path(__file__).resolve().parents[1] / 'modal/scene_renderer.py'
tree = ast.parse(source.read_text())
names = {'allocate_image_frames', 'render_scene', 'normalize_direction',
         'normalize_transition', 'build_ken_burns_filter', 'build_transition_filter', 'get_audio_duration'}
namespace = dict(math=math, Path=Path, subprocess=subprocess, RenderInputError=ValueError)
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in names], type_ignores=[]), str(source), 'exec'), namespace)
allocate = namespace['allocate_image_frames']

class SceneRenderingTests(unittest.TestCase):
    def test_invalid_and_stale_plans(self):
        for plan in (None, [None]*3, [{'duration':30}, {'duration':10}, {'duration':10}],
                     [{'duration':1.67}, {'duration':1.67}, {'duration':1.66}]):
            self.assertEqual(allocate(plan, 3, 1800, 60), [600]*3)

    def test_exact_budget(self):
        for count in range(1, 41):
            for total in (count*2, count*2+1, 1801):
                frames = allocate([], count, total, 60)
                self.assertEqual(sum(frames), total)
                self.assertEqual(len(frames), count)
                self.assertTrue(all(f >= 2 for f in frames))
        with self.assertRaises(ValueError):
            allocate([], 3, 5, 60)

    def test_valid_numbered_plan(self):
        self.assertEqual(allocate([{'image_number':3,'duration':15}, {'image_number':1,'duration':5},
                                   {'image_number':2,'duration':10}], 3, 1800, 60), [300,600,900])

    def test_render_contains_every_image(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            paths = []
            for name, rgb in [('red',(255,0,0)), ('green',(0,255,0)), ('blue',(0,0,255))]:
                image = directory / f'{name}.ppm'
                image.write_bytes(b'P6\n64 64\n255\n' + bytes(rgb)*64*64)
                paths.append(image)
            audio = directory / 'audio.wav'
            subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i','sine=frequency=440:duration=6',str(audio)], check=True)
            output = directory / 'final.mp4'
            scene = dict(sceneIndex=1, duration=namespace['get_audio_duration'](audio),
                         imagePaths=paths,imagePath=paths[0], audioPath=audio, outputPath=output,
                         direction='zoom-in',transition='cut',imageTimings=[{'duration':6},{'duration':.2},{'duration':.2}])
            namespace['render_scene'](scene,.15,1.10,12,320,240,1)
            for time, expected in [(1,0),(3,1),(5,2)]:
                pixel = subprocess.run(['ffmpeg','-v','error','-ss',str(time),'-i',str(output),
                                        '-frames:v','1','-vf','scale=1:1','-pix_fmt','rgb24','-f','rawvideo','pipe:1'],
                                       capture_output=True,check=True).stdout
                self.assertEqual(max(range(3),key=lambda i:pixel[i]), expected)
            metadata = json.loads(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration',
                                                   '-of','json',str(output)],capture_output=True,text=True,check=True).stdout)
            self.assertLess(abs(float(metadata['format']['duration'])-6), .15)

if __name__ == '__main__':
    unittest.main()
