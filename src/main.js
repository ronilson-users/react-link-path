import plugin from '../plugin.json';
var Range = ace.require("ace/range").Range;

class AcodePlugin {
 constructor() {
  this.editor = null;
  this.markerId = null;
 }

 async init($page, cacheFile, cacheFileUrl) {
  this.editor = editorManager.editor;
  this.convertImportsToClickable();
  this.editor.on("click", this.handleEditorClick.bind(this));
 }

 convertImportsToClickable() {
  const session = this.editor.getSession();
  const lines = session.getDocument().getAllLines();
  const importRegex = /^import\s+.*\s+from\s+['"](.+?)['"]/;

  lines.forEach((line, row) => {
   const match = line.match(importRegex);
   if (match) {
    const importPath = match[1];
    const range = new Range(row, line.indexOf(importPath), row, line.indexOf(importPath) + importPath.length);
    session.removeMarker(this.markerId);
    this.markerId = session.addMarker(range, 'clickable-import', 'text', false);
   }
  });
 }

 handleEditorClick(e) {
  const editor = e.editor;
  const pos = editor.getCursorPosition();
  const token = editor.session.getTokenAt(pos.row, pos.column);

  if (/\bclickable-import\b/.test(token.type)) {
   const importPath = token.value;
   this.openFile(importPath);
  }
 }

 async openFile(importPath) {
  const pathRegex = /^([a-zA-Z]|\.\/|\.\.\/|\/|.)([^\s]+\/)*[^\s]+\.[a-zA-Z0-9]{1,}$/g;
  const fileName = importPath.match(pathRegex);
  if (!fileName) return;

  let { location } = editorManager.activeFile;
  let newLocation;

  if (!location.endsWith("/")) {
   location = location + "/";
  }

  const reg = /^[a-zA-Z.][a-zA-Z0-9]*/g;
  if (fileName[0].startsWith("../")) {
   let parts = location.split("/");
   parts = parts.slice(0, -2);
   newLocation = parts.join("/");
   newLocation = newLocation + "/" + fileName[0].replace(/^(\.\.?\/|\/)/, '');
  } else if (fileName[0].startsWith("./") || fileName[0].startsWith("/")) {
   newLocation = location + fileName[0].replace(/^(\.\.?\/|\/)/, '');
  } else if (reg.test(fileName[0])) {
   newLocation = location + fileName[0];
  } else {
   window.toast("Not supported", 4000);
   return;
  }

  const fs = await fsOperation(newLocation);
  const isExists = await fs.exists();
  if (!isExists) {
   window.toast("File not found!", 4000);
   return;
  }

  const binData = await fs.readFile();
  const fileContent = await encodings.decode(binData, "utf-8");

  const existingFile = editorManager.getFile(newLocation, 'uri');
  if (existingFile) {
   existingFile.makeActive();
   return;
  }

  try {
   loader.showTitleLoader();
   new EditorFile(fileName[0].replace(/.*\//, ""), {
    uri: newLocation,
   });
  } catch (e) {
   window.toast(e, 4000);
  } finally {
   loader.removeTitleLoader();
  }
 }

 async destroy() {
  this.editor.off("click", this.handleEditorClick.bind(this));
 }
}

if (window.acode) {
 const acodePlugin = new AcodePlugin();
 acode.setPluginInit(plugin.id, async (baseUrl, $page, { cacheFileUrl, cacheFile }) => {
  if (!baseUrl.endsWith('/')) {
   baseUrl += '/';
  }
  acodePlugin.baseUrl = baseUrl;
  await acodePlugin.init($page, cacheFile, cacheFileUrl);
 });
 acode.setPluginUnmount(plugin.id, () => {
  acodePlugin.destroy();
 });
}

// Estilo para os imports clicáveis
const style = document.createElement('style');
style.type = 'text/css';
style.innerHTML = '.ace_bracket.red { text-decoration: underline; color: blue; cursor: pointer; }';
document.getElementsByTagName('head')[0].appendChild(style);