from pathlib import Path
import shutil,sys
root=Path(sys.argv[1]); source=Path(__file__).resolve().parent.parent
shutil.copy(source/'integration/SiseLadder.tsx',root/'src/app/SiseLadder.tsx')
(root/'public').mkdir(exist_ok=True)
shutil.copy(source/'converter-core.js',root/'public/sise-converter.js')
shutil.copy(source/'integration/ladder-flow.js',root/'public/sise-flow.js')
shutil.copy(source/'integration/auth-ladder.js',root/'public/auth-ladder.js')
shutil.copy(source/'auth.css',root/'public/auth-ladder.css')
index=root/'index.html'; text=index.read_text(); text=text.replace('</head>','<link rel="stylesheet" href="%BASE_URL%auth-ladder.css"><script src="%BASE_URL%auth-ladder.js"></script><script src="%BASE_URL%sise-converter.js"></script><script src="%BASE_URL%sise-flow.js"></script></head>'); index.write_text(text)
app=root/'src/app/App.tsx'; text=app.read_text(); text="import { SiseLadder } from './SiseLadder';\n"+text; text=text.replace('      <CommandPalette />','      <SiseLadder />\n      <CommandPalette />');app.write_text(text)
