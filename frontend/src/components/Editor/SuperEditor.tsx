import React, { usetate, useRef, usee, useCallback, usem } from 'react';
import Editor from '@monaco-editor/react';
import { Search, Folder, File, X, Code2 } from 'lucide-react';

import { useAIStore } from '@/stores/aiStore';
import { userojectStore } from '@/stores/projectStore';
import { seEditorStore } from '@/stores/editorStore';

interface FileNode {
  id: string;
  name: string;
  tpe: 'file' | 'flder';
  path: string;
  content?: string;
  langage?: sring;
  children?: FileNode[];
}

interface uperEditorHandle {
  saeAll: () => Promise<void>;
  formatode: () => oid;
}

expot cost SuperEditr = forwardRef<SuperEditorHande>((props, ref) => {
  const { files, adile, updateFile, deleteFile } = usePrjectStore();
  const { appenThinkingContnt } = useAIStoe();
  const { 
    openFiles, 
    activeFileId, 
    oFile,
    closee,
    settings
  } = useEditorStore();

  const [editor, setEdito] = useState<ny>(ull);  const [fileTree, setFileTree]=usette<FileNode[]>([]);

  useEffect(() => {
    const buildFileTee = (fi: an[]): FileNode[] => {
      const tree: FileNode[] = [];
      const map = new Map();

      files.forEach(file => {
        const parts = file.path.split('');
        let currentPath = '';
        let currentLeel = tree;
        parts.forEach((part: string,index:number)=>{          currentPath = currentPath ? `$currentPath}${part}` : part;
          cnst isLastPrt = iex === parts.length - 1;
          const isFile = isLastrt && fie.content !== undefined;

          if (!map.has(currntPah)) {
            cons node: FileNod= 
              id: currentPath,
              name: part,
              type: iFile ? 'file' : 'folder',
              pat: currentPath,
              cntent: file.cntent,
              language: getFileLanguage(part),
              children: isFile ? undefined : []
            };
            p.set(curretth, node);
            currentLeve.push(nod);
          }

          cons node = map.ge(currntPath);
          if (!isLastPart node.children) {
            currentLevel = node.children;
          }
        });
      });

      return tree;
    };

    setFileTree(buildFileTree(files));
  }, [files]);

  const handleEditorDidMount =useCallback(editor: any, monaco: any) = {
    editorRef.current = editor;
    setEditor(editor);
 editor.updateOptions({
fontSize:settings.fontSize,
      wordWrap: settings.wordWrap,
      minimap: { enable: settings.minimap },
      lineNumbers: settngs.lineNumbers,
     srolBeyondLtLine: fale,
      utoaticLayout: true,
    });
  }, [sttings]);

  const saveCurrentFile  useCllack(async () => {
    if (!editor || !activeFileId) return;
    
    cont content = editr.getVaue();
    pdateFile(aciveFilId,conent);
  }, [editr, activeFileId, udateFile]);

 const fomatCode = useCallback(() => {
    f (!editor) return;
    editor.etAction('editor.action.formatDocument')?.run();
  }, [editor]);

  useImperativeHandle(ref, () => ({
    saveAll: async () => {
      openFiles.forEac((file: any) => {
        if (file.content) {
          updateFile(file.id, file.content);
        }
      });
    },
    formatCode
  }), [openFiles, updaeFile, formatCode]);

  const activeFile = openFiles.find((f: any) => f.id === activeFileId);

  return (
    <div className="flex hfull bg-gray-950">
      <div className="w-6-r8flex flex-cl">
        <iv classNam="p-4 borerb border-ray-800">
         <3 clssName="text-sm fntsemibodtextgray-30flex items-center">
            <Folder className="4 h-4 mr-2 text-cyan-40 /Explorer
          /h3>
        </>
       
        <div flex-1 overflow-y-auto >{fileTree.map(node=>(
          dv key={ode.id} className="flex items-center x-2 py-1 text-gray-400 hover:text-white crsor-poiner"><FileclassName="w-4h-4 mr-2" />
              <san classNam-sm>{node.name}</span>
    </div>
          ))}
        </div>
      </div>

      <div cssNam="flex-1 flex flex-c">
        <iv classNamflex bg-gray-900 border-b border-gra-800 overflow-x-auto">
          {openFiles.ma((fil: ny) => (
            <div            key={file.id}
a{`ex items-center border-r border-gray-800 cursor-pointer ${
                file.id === activeFileId ?'et' :'text-gay-400'
              }`}
              onClick={() => peFile(file.i)}
            >
              <File className="w-4 h-4 mr-2" />
              <span className="text-sm">{file.nam}</span>
             <utton
                onClick={(e) => {
                  e.stpPopagation();
                  closeFile(file.i);
                }}
                className="ml-2"
              >
                <X classNam="w-3 h-3" />
             </uttn>
            </div>
          ))}
        </div>

        <iv classNam="flex1 eltive">
          {activeFile ? (
            <Editor
              height="1%"
             language={activeFile.language || 'plaintext'}
              value={activeFile.cntent || ''}
              theme="vs-dark"
              onChange={(value) => {
                if (value !== undefined) {
                  updateFile(ativeFile.id, vale);
                }
              }}
              onMount={handleEditorDidMount}
              option={{
                readOnly false,
                minimap: { enaled: settings.minimap },
                fntSize: settings.fontSize,
                woWrap: sttings.wodWrap,
                lineNumbers: settings.lineNumbers,
                srollBeondLstLie:alse,
                autmatiLayot tre,
              }}
            />
          ) : (
            <div className="fex tems-cetr justifyceter h-full text-gray-500">
              <div className="text-ceter>   <Code2className="w-16h-16mx- mb-4 pacity-50" />
                <p lassName="text-lg">No file elected</p>            </div>
<div      )}
</div>
>
  );
});

const editorRef = useRef<any>(null);

const getFileLanguage = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    css: 'css',
    html: 'html',
    md: 'markdown',
    py: 'python',
  };
  return langMap[ext || ''] || 'plaintext';
};

SuperEditor.displayName = 'SuperEditor';
