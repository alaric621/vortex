import type { Collections  } from "../../../typings/filesystem";
import { normalizePath } from "./path-utils";

export const collections: Collections[] = [
     {
                  "id": "req_mmtjmybx_fnqqjz",
                  "type": "GET",
                  "name": "hello",
                  "folder": "/fsa",
                  "url": "http://baidu.com",
                  "ctime": 1710000000000,
                  "mtime": 1710003600000,
                  "headers": {},
                  "body": "",
                  "scripts": {
                        "pre": "",
                        "post": ""
                  }
            },
            {
                  "id": "req_root_status",
                  "type": "GET",
                  "name": "status",
                  "folder": "/",
                  "url": "http://localhost:9501/status",
                  "ctime": 1710100000000,
                  "mtime": 1710107200000,
                  "headers": {},
                  "body": "",
                  "scripts": {
                        "pre": "",
                        "post": ""
                  }
            },
            {
                  "id": "req_fsa_list",
                  "type": "GET",
                  "name": "list",
                  "folder": "/fsa",
                  "url": "http://localhost:9501/fsa/list",
                  "ctime": 1710200000000,
                  "mtime": 1710201800000,
                  "headers": {},
                  "body": "",
                  "scripts": {
                        "pre": "",
                        "post": ""
                  }
            },
            {
                  "id": "req_team_users",
                  "type": "GET",
                  "name": "users",
                  "folder": "/team",
                  "url": "http://localhost:9501/team/users",
                  "ctime": 1710300000000,
                  "mtime": 1710305400000,
                  "headers": {},
                  "body": "",
                  "scripts": {
                        "pre": "",
                        "post": ""
                  }
            },
            {
                  "id": "req_backend_jobs",
                  "type": "GET",
                  "name": "jobs",
                  "folder": "/team/backend",
                  "url": "http://localhost:9501/team/backend/jobs",
                  "ctime": 1710400000000,
                  "mtime": 1710409000000,
                  "headers": {},
                  "body": "",
                  "scripts": {
                        "pre": "",
                        "post": ""
                  }
            }
];

// 保存显式创建的空目录路径
export const virtualFolders = new Set<string>();


/**
 * 定义返回节点的统一结构
 * 1: File, 2: Directory
 */
type FileType = 1 | 2;

export interface DirNode extends Partial<Collections> {
  name: string;
  nodeType: FileType;
  path?: string; // 仅目录节点必备，指向下一级路径
}

export function getDirContent(data: Collections[], targetPath: string): DirNode[] {
  const normalizedTarget = normalizePath(targetPath);
  const folderNames = new Set<string>();
  const fileNodes: DirNode[] = [];

  data.forEach((item) => {
    const itemFolder = normalizePath(item.folder);

    // 情况 A：该项就在当前目录下（作为文件节点）
    if (itemFolder === normalizedTarget) {
      fileNodes.push({
        ...item,
        name: item.name || itemFolder.split('/').pop() || '',
        nodeType: 1
      });
    } 
    // 情况 B：该项在当前目录的子孙目录下（提取直接子文件夹名）
    else {
      // 确保是真正的子路径关系：
      // 如果 target 是 /，则匹配所有
      // 如果 target 是 /a，则 itemFolder 必须以 /a/ 开头
      const isSubPath = normalizedTarget === '/' 
        ? itemFolder.startsWith('/') 
        : itemFolder.startsWith(normalizedTarget + '/');

      if (isSubPath) {
        const relativePath = normalizedTarget === '/' 
          ? itemFolder.slice(1) 
          : itemFolder.slice(normalizedTarget.length + 1);
        
        const subFolderName = relativePath.split('/')[0];
        if (subFolderName) {
          folderNames.add(subFolderName);
        }
      }
    }
  });

  // 额外合并显式创建的虚拟目录
  virtualFolders.forEach((folderPath) => {
    const normalizedFolder = normalizePath(folderPath);
    if (normalizedFolder === "/") return;

    const isSubPath = normalizedTarget === "/"
      ? normalizedFolder.startsWith("/")
      : normalizedFolder.startsWith(normalizedTarget + "/");

    if (!isSubPath) return;

    const relativePath = normalizedTarget === "/"
      ? normalizedFolder.slice(1)
      : normalizedFolder.slice(normalizedTarget.length + 1);

    const subFolderName = relativePath.split("/")[0];
    if (subFolderName) {
      folderNames.add(subFolderName);
    }
  });

  // 2. 将 Set 转换为文件夹节点对象
  const folderNodes: DirNode[] = Array.from(folderNames).map((name) => {
    const fullPath = normalizedTarget === '/' ? `/${name}` : `${normalizedTarget}/${name}`;
    return {
      name: name,
      nodeType: 2, // 修正：统一使用 nodeType 而非 isDir
      path: fullPath
    };
  });

  return [...folderNodes, ...fileNodes];
}

export function getStat(data: Collections[], targetPath: string): DirNode | null {
  
  const normalized = normalizePath(targetPath);

  // 1. 特殊处理根目录
  if (normalized === '/' || normalized === '') {
    return { name: '/', nodeType: 2, path: '/' };
  }

  // 2. 检查是否为文件 (判断依据：folder + "/" + name === normalized)
  const fileEntry = data.find(item => {
    const folder = normalizePath(item.folder);
    // 拼接出文件的逻辑全路径
    const fullFilePath = folder === '/' ? `/${item.name}` : `${folder}/${item.name}`;
    return fullFilePath === normalized;
  });

  if (fileEntry) {
    return {
      ...fileEntry,
      name: fileEntry.name,
      nodeType: 1 // 文件
    };
  }

  // 3. 检查是否为目录 (判断依据：targetPath 是数据中某个 folder 的前缀)
  // 或者直接就是某个 item 的 folder
  const isDirectory = data.some(item => {
    const itemFolder = normalizePath(item.folder);
    return itemFolder === normalized || itemFolder.startsWith(normalized + '/');
  }) || Array.from(virtualFolders).some(folder => {
    const normalizedFolder = normalizePath(folder);
    return normalizedFolder === normalized || normalizedFolder.startsWith(normalized + "/");
  });

  if (isDirectory) {
    return {
      name: normalized.split('/').pop() || '',
      nodeType: 2, // 目录
      path: normalized
    };
  }

  return null;
}




/**
 * 1. 更新文件内容
 */
export function updateFile(data: Collections[], path: string, updates: Partial<Collections>): boolean {
  const normalized = normalizePath(path);
  const index = data.findIndex(item => {
    const folder = normalizePath(item.folder);
    const itemPath = folder === "/" ? `/${item.name}` : `${folder}/${item.name}`;
    return itemPath === normalized;
  });

  if (index !== -1) {
    data[index] = { ...data[index], ...updates, mtime: Date.now() };
    return true;
  }
  return false;
}

/**
 * 2. 删除文件或目录（递归删除）
 */
export function deleteNode(data: Collections[], path: string): Collections[] {
  const normalized = normalizePath(path);

  virtualFolders.forEach((folder) => {
    const normalizedFolder = normalizePath(folder);
    if (normalizedFolder === normalized || normalizedFolder.startsWith(normalized + "/")) {
      virtualFolders.delete(folder);
    }
  });
  
  // 过滤掉：
  // 1. 逻辑路径等于该路径的文件
  // 2. folder 路径等于该路径或以该路径为前缀的所有项（递归删除目录内容）
  return data.filter(item => {
    const itemFullPath = normalizePath(`${item.folder}/${item.name}`);
    const itemFolder = normalizePath(item.folder);
    
    const isExactFile = itemFullPath === normalized;
    const isInsideFolder = itemFolder === normalized || itemFolder.startsWith(normalized + '/');
    
    return !isExactFile && !isInsideFolder;
  });
}

/**
 * 3. 重命名或移动
 * 支持文件重命名和目录重命名（自动迁移子文件）
 */
export function renameNode(data: Collections[], oldPath: string, newPath: string): void {
  const normalizedOld = normalizePath(oldPath);
  const normalizedNew = normalizePath(newPath);

  data.forEach((item, index) => {
    const itemFullPath = normalizePath(`${item.folder}/${item.name}`);
    const itemFolder = normalizePath(item.folder);

    // 情况 A: 重命名的是文件本身
    if (itemFullPath === normalizedOld) {
      const pathParts = normalizedNew.split('/');
      const newName = pathParts.pop() || '';
      const newFolder = pathParts.join('/') || '/';
      data[index] = { ...item, name: newName, folder: newFolder, mtime: Date.now() };
    } 
    // 情况 B: 重命名的是父目录（需要批量修改子文件的 folder）
    else if (itemFolder === normalizedOld || itemFolder.startsWith(normalizedOld + '/')) {
      const relativePart = itemFolder.slice(normalizedOld.length);
      data[index].folder = normalizePath(normalizedNew + relativePart);
    }
  });

  // 目录重命名时同步迁移显式目录节点
  const migratedFolders = new Set<string>();
  virtualFolders.forEach((folder) => {
    const normalizedFolder = normalizePath(folder);
    if (normalizedFolder === normalizedOld || normalizedFolder.startsWith(normalizedOld + "/")) {
      const suffix = normalizedFolder.slice(normalizedOld.length);
      migratedFolders.add(normalizePath(normalizedNew + suffix));
    } else {
      migratedFolders.add(normalizedFolder);
    }
  });
  virtualFolders.clear();
  migratedFolders.forEach(folder => virtualFolders.add(folder));
}

/**
 * 4. 创建新项
 */
export function createItem(data: Collections[], path: string, isDir: boolean): void {
  const normalized = normalizePath(path);
  const pathParts = normalized.split('/');
  const name = pathParts.pop() || '';
  const folder = pathParts.join('/') || '/';

  if (!isDir) {
    data.push({
      id: `req_${Math.random().toString(36).slice(2, 9)}`,
      type: "GET",
      name: name,
      folder: folder,
      url: "https://",
      ctime: Date.now(),
      mtime: Date.now(),
      headers: {},
      body: "",
      scripts: { pre: "", post: "" }
    });
    return;
  }

  virtualFolders.add(normalized);
}



/**
 * 5. 判断路径是文件、目录还是不存在
 * 返回值: 'file' | 'dir' | null
 */
export function getPathType(data: Collections[], path: string): 'file' | 'dir' | null {
  const normalized = normalizePath(path);

  // 根目录特殊处理
  if (normalized === '/' || normalized === '') return 'dir';

  // 检查是否匹配文件全路径
  const isFile = data.some(item => {
    const folder = normalizePath(item.folder);
    const fullPath = folder === '/' ? `/${item.name}` : `${folder}/${item.name}`;
    return fullPath === normalized;
  });
  if (isFile) return 'file';

  // 检查是否匹配目录（即它是某些项的父级 folder）
  const isDir = data.some(item => {
    const itemFolder = normalizePath(item.folder);
    return itemFolder === normalized || itemFolder.startsWith(normalized + '/');
  }) || Array.from(virtualFolders).some(folder => {
    const normalizedFolder = normalizePath(folder);
    return normalizedFolder === normalized || normalizedFolder.startsWith(normalized + "/");
  });
  if (isDir) return 'dir';

  return null;
}

/**
 * 6. 读取文件内容
 * 根据路径获取 Collections 对象
 */
export function getFileContent(data: Collections[], path: string): Collections | null {
  const normalized = normalizePath(path);

  const found = data.find(item => {
    const folder = normalizePath(item.folder);
    const fullPath = folder === '/' ? `/${item.name}` : `${folder}/${item.name}`;
    return fullPath === normalized;
  });
  return found ? { ...found } : null;
}
