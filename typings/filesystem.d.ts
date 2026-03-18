export interface Collections {
  id: string;
  type: string;
  name: string;
  folder: string;
  url: string;
  ctime?: number;
  mtime?: number;
  headers?: Record<string, string>;
  body?: string;
  scripts?: {
    pre?: string;
    post?: string;
  };
  [key: string]: unknown;
}

export type NodeType = "file" | "folder";

export interface DirNode extends Partial<Collections> {
  name: string;
  nodeType: NodeType;
  path?: string;
}

export interface FolderEntry {
  name: string;
  nodeType: "folder";
  path: string;
}

export interface FileEntry extends Collections {
  nodeType: "file";
  path: string;
}


export type ApiRequestItem = Collections;


