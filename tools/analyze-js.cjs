/* TypeScript 5.x compiler adapter. Its host only reads the provided virtual files. */
const fs = require('node:fs');
let ts;
try { ts = require('typescript'); } catch { console.error('Install the pinned TypeScript dependency with npm install.'); process.exit(2); }
const files = JSON.parse(fs.readFileSync(0, 'utf8'));
const options = {allowJs:true, noLib:true, noEmit:true, target:ts.ScriptTarget.ESNext, jsx:ts.JsxEmit.ReactJSX, module:ts.ModuleKind.ESNext, moduleResolution:ts.ModuleResolutionKind.Bundler};
const normalized = Object.fromEntries(Object.entries(files).map(([p,c])=>['/'+p,c]));
const host = {
 getSourceFile:(p)=>normalized[p]===undefined?undefined:ts.createSourceFile(p,normalized[p],options.target,true),
 getDefaultLibFileName:()=>'', writeFile:()=>{}, getCurrentDirectory:()=> '/',
 getDirectories:()=>[], fileExists:p=>normalized[p]!==undefined, readFile:p=>normalized[p],
 directoryExists:p=>Object.keys(normalized).some(f=>f.startsWith(p.endsWith('/')?p:p+'/')),
 getCanonicalFileName:p=>p, useCaseSensitiveFileNames:()=>true, getNewLine:()=> '\n'
};
const program=ts.createProgram(Object.keys(normalized),options,host), checker=program.getTypeChecker();
const symbols=[], imports={}, byDecl=new Map(), diagnostics=[], pending=[];
for(const sf of program.getSourceFiles()){
 const file=sf.fileName.slice(1); imports[file]=[];
 const walk=(n,parent='')=>{
  let name,kind;
  if((ts.isFunctionDeclaration(n)||ts.isClassDeclaration(n)||ts.isInterfaceDeclaration(n)||ts.isMethodDeclaration(n))&&n.name){name=(parent?parent+'.':'')+n.name.getText(sf);kind=ts.isClassDeclaration(n)||ts.isInterfaceDeclaration(n)?'type':'function'}
  if(ts.isVariableDeclaration(n)&&n.initializer&&(ts.isArrowFunction(n.initializer)||ts.isFunctionExpression(n.initializer))){name=(parent?parent+'.':'')+n.name.getText(sf);kind='function'}
  if(ts.isImportDeclaration(n)&&ts.isStringLiteral(n.moduleSpecifier)) imports[file].push(n.moduleSpecifier.text);
  if(name){
   const sym=checker.getSymbolAtLocation(n.name);
   const record={name,file,kind,line:sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1,end:sf.getLineAndCharacterOfPosition(n.end).line+1,doc:sym?ts.displayPartsToString(sym.getDocumentationComment(checker)):'',calls:[],inputs:(n.parameters||n.initializer?.parameters||[]).map(p=>p.getText(sf))};
   symbols.push(record);byDecl.set(n,record);if(n.initializer)byDecl.set(n.initializer,record);
   pending.push([n,record,sf]);parent=name;
  }
  ts.forEachChild(n,c=>walk(c,parent));
 };
 walk(sf);
 for(const d of sf.parseDiagnostics||[])diagnostics.push(`${file}: ${ts.flattenDiagnosticMessageText(d.messageText,' ')}`);
}
const edges=[];
for(const [node,record,sf] of pending){
 const body=node.body||node.initializer?.body;if(!body)continue;
 const visit=n=>{
  if(n!==body&&(ts.isFunctionDeclaration(n)||ts.isArrowFunction(n)||ts.isFunctionExpression(n)))return;
  if(ts.isCallExpression(n)){
   const target=byDecl.get(checker.getResolvedSignature(n)?.declaration);
   record.calls.push(n.expression.getText(sf));
   if(target)edges.push({from:record.file+'::'+record.name,to:target.file+'::'+target.name,relation:'calls'});
  }
  ts.forEachChild(n,visit);
 };
 visit(body);
}
console.log(JSON.stringify({symbols,imports,edges,diagnostics,version:ts.version}));
