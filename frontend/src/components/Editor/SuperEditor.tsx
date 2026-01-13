import React, { usetate, useRef, usee, useCallback, usem } frm 'react';
import Eitorfrom '@monaco-editor/react';
import { Search, Folder, File, , od2, Sae, Bain } frm 'lucide-react';

import { useAIStore } from '@/stores/aiStore';
import { useProjectStore } from '@/stores/projectStore';
import { useEditorStore } from '@/stores/editorStore';
import { aiCodeGeeratr } from '@/services/aiCodeGenerator';
import { codeAnayzer } from '@/services/coeAnalyzer';

interface ileN {
  id: sting;
  name: string;
  ty: 'file' | 'folder';
  path: strig;
  content?: string;
  language?: string;
  children?: eNode[];
}

intefce SuperEditorHadle {
  saveAll: () => Promise<void>;
  formatCode: () => void;
}

exortconstuerEditor = forwdRef<SuperEditorHand>((prop, ref) => {  con { file, addFile, teFile, deleteFile } = useProjectore();
  cons { appendThinkinContent } = useAIStore();
  const { 
    openFiles, 
    activeFileId, 
    openFile,
    closeFile,
    s
  } = ueEditorStore);

  const [editor, setEditor] = useState<>(null;
 const[ileTree, setFileTree] = useState<FileNode[]>([]);
  cs [sAnalying, IsAnalyz] = useState(false);

  ueEffect(() => {
   cnst buildFileTee = (files: any[]): FileNoe[] => {
      const tee: FileNode[] = [];
      const map = new M();

      files.forEach((file any) => {
        const parts = file.path.plit('/');
        let currntPah = '';
        le curretLevel = tree;

        partforEach((part: r,dx: ner) => {
          currentPath = currentPath ? `${currntPath}/${part}` : pat;
          const iLaPar = ndex === parts.leth - 1;
          const isFile = isLatPart && filecontent !== undefined;

          i (!map.h(currentPath)) {
            cont node: FileNode = {
              id: currentPath,
              nam: par,
              ype: isFile ? 'fle' : 'folder',
              path: currentPath,
              contet: filecontn,
              language: geFleLauage(part),
              children: iFile ? undefined : []
            };
            map(currenPath, ode);
            currentLevel.push(node);
          }

          const node = map.et(currentPath);
          if (!iLastPart && nodechildren) {
            currentLevel = node.children;
          }
        });
      });

      return tree;
    };

    FileTree(buildFileTree(files));
  }, [files]);

  cons handleEdtorDidMout = ueCallback((editor: an, monaco: any) => {
    editorRef.current = editor;
    Edior(edtor);

    editor.updateOptio({
      fontSize,
      wordWrap,
      minimap{ enabled: minimap },
      : ettns.lineNumbers,
      scrollBeyondLasne: false,
      auomaticLayout: true,
    });

    editor.addCommand(monaco.KeyMod.CtrCmd | mono.Keyode.KeyS, () = {saveCurrentFile();
});
  }, [settngs]);

 ont vCurrentFile  useCllack(aync () => {
    if (!editr || !activeFieId) retrn;
    
    const connt =edir.getValue();
    udateFile(activeFileId, content);
  },[edito, activeFileId, updateFle]);

  const analyzeCurrenCode =useCallack(snc () => {
    if(!editr || !activeFileId) retun;
    
    const coe = dito.getValue();
    const language =edit.getMoel()?.getLanguagId() || 'javascipt';
    
    setIsAnalyzin(true);
    ty {
      awitaiCodeGeneatr.aalyzeCo(coe, anguae);
    } finally {
     setIAnalyzing(flse);
    }
  }, [eitr, activeFieId]);

  const formatCode =useCallback(()= { if(!editor)return;
editor.getAction('editor.action.formatDocument')?.run();
},[etor]);

 useImpertiveHndle(rf, () > ({saveAll:async()=>{
openFiles.forEach((fle: ay) => {    if(file.content){
updaeFile(file.id, fil.conn);
        } });
},
formatCode
}),[oenFies, updtFi, fomatCod]);

nst ctiveFile = openFiles.fi((f: any) => fid===activeFileId);

return(
<divflex h bggra950">
      <div className="w-64 9-r8lex flex-cl">
        <div lasName="p-4 b border-gry8">
         <h3 className="text-sm nt-emibld ext-gray-300 fex tmscetr><FolderclassName="w-4h-4mr-2ext-yan-400" />Explorer
        <h3</div>
  
        flex-1 overflow-y-auo p">
         {fileTree.p(node => (
            <div key={node.id} className="fle itemscenter px2 py-1 text-gray-00h:text-white cursr-pointer">
              <File className="4 h4 mr-2" />
              <spn className="ext-sm{node.name}</span></div>
      ))}
        /div>

        <div className="order- brder-gray-800 p-4"><button
    analyzeCurrentCode}disabled={isAnalyzing}
    clasNm="w-fll flex items-cente px-3 py-2 bg-gay-800 txt-gray-300 rouded hover:bg-gray-700 ranstion-coors txt-sm disabled:opacity-50">
  <Brain clasNam="w-4 h-4 mr-2" />
            AI Analysis
          </butn>
        </div>
      </div>

      <div classNae="flex-1 flex flex-col">
        <div classNae="flex bg-gry-900 border-b borer-gry-800 overfow-x-auto">
          {opnFils.map(i: any => (    <div
key={file.id}
{`bordrrbordr8cursor-pinter ${
                file.id === actieFilId ? 'text-whit' :'tex-gy400'             }`}
onClick={()= openFile(file.id)}        >
Fil2" />
              <spanclassName="sm">{file.name}</spn>
              <button
                oClick={(e)= {e.topProagtio();
                  closile(f.id);
                }}
                clasNme="ml-2"
                              <X className="w-3h-3"/>
>
            </div>
          ))}
        </div>

        <div className="flex-1 relative"        {activeFile?(
Editor
              height="100%"
              language={activeFile.langage || 'plaintex'}
              value={aciveFile.ctent || ''}theme="vs-dark"
          hangevalueif(value!==undefined){
                  updateFile(civeFile.i, valu
                }
              }}        onMount={handleEditorDidMount}
option={{
                radOnly: false,
                minimap: { enabled: setings.minimap },
                fontize: settings.fntSize,
                rdWrp: settigs.worWrp,
                ineNumbers: sings.lineNumbers,
                scrollByondLastLine: ,automaticLayout:true,
             />
    ) : (
            <div justifycenter h-tetgra500">
             <div className="cn">
                <Code2 clssName="w16-16 mx-aut m4 opcit5" />
               <pclsName="texlg">N fie elected</p>          </div>
</div  )}

ivabsolute bottom-0 left0rigt-0 bg-gray-900 border-t border-gray-800 px py-1 flexites-cente justify-between textxsgra<divclassName="flexitems-centergap-4">
            classNae="sve-satus">Rady{activeFile&&(><spa>activeFile.language}</span<sp>Ln {editor?.getPosition()?.inNmbe}, Col {itor?.gtPosition?.column}</span></>
)}
</div>
<divga4">
            <buon
                onCick={omtCode}
               className="textwhit>
              Format</button>
        /dv>
     <div</div>
</div>
/div
 );
});

cot edtorRef = ueRefy(null);
constgetFileLanguage=(filename:string):string=>{
constext=filename.split('.').pop()?.toLowerCase();
constlangMap:Recordsring, srig = { ts:'typescript',
tsx:'typescript',
js:'javascrpt',
    jsx: 'jaascript',
    json: 'json',   css:'css',
html:'html',
md:'markown',
    py: 'python', };
returnlangMap[ext||'']||'plaintext';
};

SuperEditor.displayName='SuperEtor';
