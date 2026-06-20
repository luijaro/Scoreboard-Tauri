import os
import re

src_dir = r"c:\Users\Luijaro\Downloads\Scoreboard-main\Scoreboard-Tauri\src"

for root, _, files in os.walk(src_dir):
    for file in files:
        if file.endswith((".js", ".html")):
            path = os.path.join(root, file)
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            
            original_content = content
            
            # Remove const { ipcRenderer } = require('electron');
            content = re.sub(r"const\s+\{\s*ipcRenderer\s*\}\s*=\s*require\('electron'\);", "", content)
            
            # Remove window.ipcRenderer = require('electron').ipcRenderer;
            content = re.sub(r"window\.ipcRenderer\s*=\s*require\('electron'\)\.ipcRenderer;", "", content)
            
            # Reemplazar window.ipcRenderer.invoke y ipcRenderer.invoke por window.__TAURI__.core.invoke
            content = re.sub(r"(?:window\.)?ipcRenderer\.invoke", "window.__TAURI__.core.invoke", content)
            
            # Reemplazar ipcRenderer.on por window.__TAURI__.event.listen
            # En Electron: ipcRenderer.on('channel', (event, data) => { ... })
            # En Tauri: await window.__TAURI__.event.listen('channel', (event) => { const data = event.payload; ... })
            # Esto es mas dificil con Regex pero el patron usual es ipcRenderer.on('...', (event, data) => {
            def repl_on(match):
                channel = match.group(1)
                args = match.group(2)
                args_list = [a.strip() for a in args.split(",") if a.strip()]
                data_var = args_list[1] if len(args_list) > 1 else None
                
                res = f"window.__TAURI__.event.listen({channel}, (event) => {{\n"
                if data_var:
                    res += f"  const {data_var} = event.payload;\n"
                return res

            content = re.sub(r"(?:window\.)?ipcRenderer\.on\(([^,]+),\s*\(([^)]*)\)\s*=>\s*\{", repl_on, content)
            
            # Fix if(window && window.ipcRenderer) -> if(window && window.__TAURI__)
            content = content.replace("window.ipcRenderer", "window.__TAURI__")
            
            if content != original_content:
                with open(path, "w", encoding="utf-8") as f:
                    f.write(content)
                print(f"Refactored: {path}")

print("Done")
