import type { Collections  } from "../../../typings/filesystem";
import { normalizePath } from "../../utils/path";

// 变量：collections，内存中的请求集合，作为虚拟文件系统数据源。
export const collections: Collections[] = [
  {
    id: "req_get_health",
    type: "GET",
    name: "GET-健康检查",
    folder: "/",
    url: "https://postman-echo.com/get?source=vortex",
    ctime: 1711000000000,
    mtime: 1711000000000,
    headers: {
      Accept: "application/json"
    },
    body: "",
    scripts: {
      pre: "console.log(`Preparing ${request.type} ${request.url}`);",
      post: "console.log(`Finished with status ${response.status}`);"
    }
  },
  {
    id: "req_post_create_user",
    type: "POST",
    name: "POST-创建用户",
    folder: "/",
    url: "https://postman-echo.com/post",
    ctime: 1711000100000,
    mtime: 1711000100000,
    headers: {
      "Content-Type": "application/json"
    },
    body: "{\n  \"name\": \"{{name}}\"\n}",
    scripts: {
      pre: "request.headers = { ...request.headers, 'X-Debug-User': String(variables.name) }; console.log(`Creating user for ${variables.name}`);",
      post: "console.log(`Create user status: ${response.status}`); console.log(response.body ?? '');"
    }
  },
  {
    id: "req_put_replace_user",
    type: "PUT",
    name: "PUT-更新用户",
    folder: "/",
    url: "https://postman-echo.com/put",
    ctime: 1711000200000,
    mtime: 1711000200000,
    headers: {
      "Content-Type": "application/json"
    },
    body: "{\n  \"name\": \"updated-user\"\n}",
    scripts: {
      pre: "request.headers = { ...request.headers, 'X-Replace-Mode': 'full' }; console.log(`Replacing payload for ${request.name}`);",
      post: "console.log(`Replace user completed with ${response.status}`);"
    }
  },
  {
    id: "req_delete_user",
    type: "DELETE",
    name: "DELETE-删除用户",
    folder: "/",
    url: "https://postman-echo.com/delete",
    ctime: 1711000300000,
    mtime: 1711000300000,
    headers: {},
    body: "",
    scripts: {
      pre: "request.headers = { ...request.headers, 'X-Delete-Reason': 'cleanup' }; console.log(`Deleting resource via ${request.url}`);",
      post: "console.log(`Delete response status: ${response.status}`);"
    }
  },
  {
    id: "req_patch_user_status",
    type: "PATCH",
    name: "PATCH-修改状态",
    folder: "/",
    url: "https://postman-echo.com/patch",
    ctime: 1711000400000,
    mtime: 1711000400000,
    headers: {
      "Content-Type": "application/json"
    },
    body: "{\n  \"enabled\": true\n}",
    scripts: {
      pre: "request.headers = { ...request.headers, 'X-Patch-Trace': 'status-toggle' }; console.log('Patching user status');",
      post: "console.log(`Patched status, response code ${response.status}`);"
    }
  },
  {
    id: "req_head_status",
    type: "HEAD",
    name: "HEAD-仅头信息",
    folder: "/",
    url: "https://postman-echo.com/get",
    ctime: 1711000500000,
    mtime: 1711000500000,
    headers: {},
    body: "",
    scripts: {
      pre: "request.headers = { ...request.headers, 'X-Head-Check': 'true' }; console.log('Checking headers only');",
      post: "console.log(`HEAD finished with ${response.status}`);"
    }
  },
  {
    id: "req_options_api",
    type: "OPTIONS",
    name: "OPTIONS-预检请求",
    folder: "/",
    url: "https://postman-echo.com/get",
    ctime: 1711000600000,
    mtime: 1711000600000,
    headers: {
      Origin: "http://localhost:3000"
    },
    body: "",
    scripts: {
      pre: "request.headers = { ...request.headers, 'Access-Control-Request-Method': 'GET' }; console.log('Preparing preflight request');",
      post: "console.log(`OPTIONS allow headers: ${JSON.stringify(response.headers ?? {})}`);"
    }
  },
  {
    id: "req_connect_tunnel",
    type: "CONNECT",
    name: "CONNECT-隧道测试",
    folder: "/",
    url: "http://httpbingo.org/anything/vortex",
    ctime: 1711000700000,
    mtime: 1711000700000,
    headers: {},
    body: "",
    scripts: {
      pre: "request.headers = { ...request.headers, Host: 'httpbingo.org' }; console.log('Opening CONNECT tunnel');",
      post: "console.log(`CONNECT meta: ${JSON.stringify(response.meta ?? {})}`);"
    }
  },
  {
    id: "req_trace_echo",
    type: "TRACE",
    name: "TRACE-回显测试",
    folder: "/",
    url: "https://httpbingo.org/anything/vortex",
    ctime: 1711000800000,
    mtime: 1711000800000,
    headers: {
      "Max-Forwards": "5"
    },
    body: "",
    scripts: {
      pre: "request.headers = { ...request.headers, 'X-Trace-Request': 'echo' }; console.log('Tracing upstream request');",
      post: "console.log(`TRACE response length: ${(response.body ?? '').length}`);"
    }
  },
  {
    id: "req_websocket_feed",
    type: "WEBSOCKET",
    name: "WEBSOCKET-实时通道",
    folder: "/",
    url: "wss://ws.postman-echo.com/raw",
    ctime: 1711000900000,
    mtime: 1711000900000,
    headers: {},
    body: "{\"action\":\"subscribe\",\"channel\":\"prices\"}",
    scripts: {
      pre: "console.log('Opening WebSocket echo stream');",
      post: "console.log(`Received ${response.events.length} websocket messages`);"
    }
  },
  {
    id: "req_sse_events",
    type: "SSE",
    name: "SSE-事件流",
    folder: "/",
    url: "https://httpbingo.org/sse?count=5&duration=20s&delay=1s",
    ctime: 1711001000000,
    mtime: 1711001000000,
    headers: {
      Accept: "text/event-stream"
    },
    body: "",
    scripts: {
      pre: "request.headers = { ...request.headers, 'Last-Event-ID': 'seed-1' }; console.log('Starting SSE capture');",
      post: "console.log(`Captured ${response.events.length} SSE events`);"
    }
  },
  {
    id: "req_eventsource_notifications",
    type: "EVENTSOURCE",
    name: "EVENTSOURCE-通知流",
    folder: "/",
    url: "https://httpbingo.org/sse?count=5&duration=20s&delay=1s",
    ctime: 1711001100000,
    mtime: 1711001100000,
    headers: {
      Accept: "text/event-stream"
    },
    body: "",
    scripts: {
      pre: "request.headers = { ...request.headers, 'X-Stream-Client': 'vortex' }; console.log('Connecting to EventSource stream');",
      post: "console.log(`Recentchange events: ${response.events.length}`);"
    }
  },
  {
    id: "req_subscribe_topic",
    type: "SUBSCRIBE",
    name: "SUBSCRIBE-订阅主题",
    folder: "/",
    url: "https://httpbingo.org/anything/vortex",
    ctime: 1711001200000,
    mtime: 1711001200000,
    headers: {
      Prefer: "wait=30"
    },
    body: "",
    scripts: {
      pre: "request.headers = { ...request.headers, 'X-Subscription-Mode': 'subscribe' }; console.log('Subscribing to topic orders');",
      post: "console.log(`Subscribe status: ${response.status}`);"
    }
  },
  {
    id: "req_unsubscribe_topic",
    type: "UNSUBSCRIBE",
    name: "UNSUBSCRIBE-取消订阅",
    folder: "/",
    url: "https://httpbingo.org/anything/vortex",
    ctime: 1711001300000,
    mtime: 1711001300000,
    headers: {},
    body: "",
    scripts: {
      pre: "request.headers = { ...request.headers, 'X-Subscription-Mode': 'unsubscribe' }; console.log('Unsubscribing from topic orders');",
      post: "console.log(`Unsubscribe status: ${response.status}`);"
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

interface PathParts {
  name: string;
  folder: string;
}

/**
 * 方法：getCollectionPath
 * 说明：计算请求项在虚拟文件系统中的完整路径。
 * @param item 参数 item。
 * @returns 返回 string 类型结果。
 * 返回值示例：const text = getCollectionPath(item); // 'demo-value'
 */
function getCollectionPath(item: Collections): string {
  // 变量：folder，用于保存当前流程中的中间状态。
  const folder = normalizePath(item.folder);
  return folder === "/" ? `/${item.name}` : `${folder}/${item.name}`;
}

/**
 * 方法：createRequest
 * 说明：按默认模板创建新的请求对象。
 * @param name 参数 name。
 * @param folder 参数 folder。
 * @returns 返回 Collections 类型结果。
 * 返回值示例：const result = createRequest('demo-value', 'demo-value'); // { id: 'req_demo', type: 'GET', name: 'users', folder: '/', url: 'https://example.com' }
 */
function createRequest(name: string, folder: string): Collections {
  // 变量：now，用于保存当前流程中的中间状态。
  const now = Date.now();
  return {
    id: `req_${Math.random().toString(36).slice(2, 9)}`,
    type: "GET",
    name,
    folder,
    url: "https://",
    ctime: now,
    mtime: now,
    headers: {},
    body: "",
    scripts: { pre: "", post: "" }
  };
}

/**
 * 方法：cloneCollection
 * 说明：克隆请求对象，避免外部直接改写源数据。
 * @param item 参数 item。
 * @returns 返回 Collections 类型结果。
 * 返回值示例：const result = cloneCollection(item); // { id: 'req_demo', type: 'GET', name: 'users', folder: '/', url: 'https://example.com' }
 */
function cloneCollection(item: Collections): Collections {
  return {
    ...item,
    headers: item.headers ? { ...item.headers } : {},
    scripts: {
      pre: item.scripts?.pre ?? "",
      post: item.scripts?.post ?? ""
    }
  };
}

/**
 * 方法：splitPath
 * 说明：将完整路径拆分为父目录与末级名称。
 * @param path 参数 path。
 * @returns 返回 PathParts 类型结果。
 * 返回值示例：const result = splitPath('demo-value'); // { name: 'users', folder: '/team' }
 */
function splitPath(path: string): PathParts {
  // 变量：parts，用于保存当前流程中的中间状态。
  const parts = normalizePath(path).split("/");
  // 变量：name，用于保存当前流程中的中间状态。
  const name = parts.pop() || "";
  return {
    name,
    folder: parts.join("/") || "/"
  };
}

/**
 * 方法：isDirectChildPath
 * 说明：判断候选路径是否为父路径的直接子级。
 * @param parent 参数 parent。
 * @param candidate 参数 candidate。
 * @returns 返回布尔值；true 表示条件成立，false 表示条件不成立。
 * 返回值示例：const ok = isDirectChildPath('demo-value', 'demo-value'); // true
 */
function isDirectChildPath(parent: string, candidate: string): boolean {
  if (parent === "/") {
    return candidate.startsWith("/");
  }

  return candidate.startsWith(parent + "/");
}

/**
 * 方法：getRelativeChildName
 * 说明：提取相对父路径的首级子目录名。
 * @param parent 参数 parent。
 * @param candidate 参数 candidate。
 * @returns 返回 string 类型结果。
 * 返回值示例：const text = getRelativeChildName('demo-value', 'demo-value'); // 'demo-value'
 */
function getRelativeChildName(parent: string, candidate: string): string {
  // 变量：relativePath，用于保存当前流程中的中间状态。
  const relativePath = parent === "/" ? candidate.slice(1) : candidate.slice(parent.length + 1);
  return relativePath.split("/")[0] ?? "";
}

/**
 * 方法：isNestedPath
 * 说明：判断路径是否处于目标路径下（含自身）。
 * @param parent 参数 parent。
 * @param candidate 参数 candidate。
 * @returns 返回布尔值；true 表示条件成立，false 表示条件不成立。
 * 返回值示例：const ok = isNestedPath('demo-value', 'demo-value'); // true
 */
function isNestedPath(parent: string, candidate: string): boolean {
  return candidate === parent || candidate.startsWith(parent + "/");
}

/**
 * 方法：hasDirectoryAtPath
 * 说明：判断路径是否存在真实目录或虚拟目录。
 * @param path 参数 path。
 * @param data 参数 data。
 * @returns 返回布尔值；true 表示条件成立，false 表示条件不成立。
 * 返回值示例：const ok = hasDirectoryAtPath('demo-value', data); // true
 */
function hasDirectoryAtPath(path: string, data: Collections[]): boolean {
  return data.some(item => {
    // 变量：itemFolder，用于保存当前流程中的中间状态。
    const itemFolder = normalizePath(item.folder);
    return isNestedPath(path, itemFolder);
  }) || Array.from(virtualFolders).some(folder => {
    // 变量：normalizedFolder，用于保存当前流程中的中间状态。
    const normalizedFolder = normalizePath(folder);
    return isNestedPath(path, normalizedFolder);
  });
}

/**
 * 方法：findCollectionIndex
 * 说明：按路径查找请求项索引。
 * @param data 参数 data。
 * @param path 参数 path。
 * @returns 返回 number 类型结果。
 * 返回值示例：const count = findCollectionIndex(data, 'demo-value'); // 1
 */
function findCollectionIndex(data: Collections[], path: string): number {
  // 变量：normalized，用于保存当前流程中的中间状态。
  const normalized = normalizePath(path);
  return data.findIndex(item => getCollectionPath(item) === normalized);
}

/**
 * 方法：findCollection
 * 说明：按路径查找请求项对象。
 * @param data 参数 data。
 * @param path 参数 path。
 * @returns 命中时返回 Collections，未命中返回 undefined。
 * 返回值示例：const result = findCollection(data, 'demo-value'); // { id: 'req_demo', type: 'GET', name: 'users', folder: '/', url: 'https://example.com' } 或 undefined
 */
function findCollection(data: Collections[], path: string): Collections | undefined {
  // 变量：index，用于保存当前流程中的中间状态。
  const index = findCollectionIndex(data, path);
  return index === -1 ? undefined : data[index];
}

/**
 * 方法：createFolderNode
 * 说明：构建目录节点数据。
 * @param basePath 参数 basePath。
 * @param name 参数 name。
 * @returns 返回 DirNode 类型结果。
 * 返回值示例：const result = createFolderNode('demo-value', 'demo-value'); // { name: 'users', nodeType: 1, path: '/team/users' }
 */
function createFolderNode(basePath: string, name: string): DirNode {
  return {
    name,
    nodeType: 2,
    path: basePath === '/' ? `/${name}` : `${basePath}/${name}`
  };
}

/**
 * 方法：createFileNode
 * 说明：构建文件节点数据。
 * @param item 参数 item。
 * @returns 返回 DirNode 类型结果。
 * 返回值示例：const result = createFileNode(item); // { name: 'users', nodeType: 1, path: '/team/users' }
 */
function createFileNode(item: Collections): DirNode {
  return {
    ...item,
    name: item.name || normalizePath(item.folder).split("/").pop() || "",
    nodeType: 1
  };
}

/**
 * 方法：getDirectoryName
 * 说明：获取路径末级目录名称。
 * @param path 参数 path。
 * @returns 返回 string 类型结果。
 * 返回值示例：const text = getDirectoryName('demo-value'); // 'demo-value'
 */
function getDirectoryName(path: string): string {
  return normalizePath(path).split("/").pop() || "";
}

/**
 * 方法：getDirContent
 * 说明：读取目录下直接子项（目录与文件）。
 * @param data 参数 data。
 * @param targetPath 参数 targetPath。
 * @returns 返回 DirNode[] 列表。
 * 返回值示例：const list = getDirContent(data, 'demo-value'); // [{ id: 'demo' }]
 */
export function getDirContent(data: Collections[], targetPath: string): DirNode[] {
  // 变量：normalizedTarget，用于保存当前流程中的中间状态。
  const normalizedTarget = normalizePath(targetPath);
  // 变量：folderNames，用于保存当前流程中的中间状态。
  const folderNames = new Set<string>();
  // 变量：fileNodes，用于保存当前流程中的中间状态。
  const fileNodes: DirNode[] = [];

  data.forEach((item) => {
    // 变量：itemFolder，用于保存当前流程中的中间状态。
    const itemFolder = normalizePath(item.folder);

    if (itemFolder === normalizedTarget) {
      fileNodes.push(createFileNode(item));
      return;
    }

    if (isDirectChildPath(normalizedTarget, itemFolder)) {
      // 变量：subFolderName，用于保存当前流程中的中间状态。
      const subFolderName = getRelativeChildName(normalizedTarget, itemFolder);
      if (subFolderName) {
        folderNames.add(subFolderName);
      }
    }
  });

  virtualFolders.forEach((folderPath) => {
    // 变量：normalizedFolder，用于保存当前流程中的中间状态。
    const normalizedFolder = normalizePath(folderPath);
    if (normalizedFolder === "/") return;
    if (!isDirectChildPath(normalizedTarget, normalizedFolder)) return;

    // 变量：subFolderName，用于保存当前流程中的中间状态。
    const subFolderName = getRelativeChildName(normalizedTarget, normalizedFolder);
    if (subFolderName) {
      folderNames.add(subFolderName);
    }
  });

  // 变量：folderNodes，用于保存当前流程中的中间状态。
  const folderNodes: DirNode[] = Array.from(folderNames).map(name => createFolderNode(normalizedTarget, name));

  return [...folderNodes, ...fileNodes];
}

/**
 * 方法：getStat
 * 说明：获取路径对应的节点元信息。
 * @param data 参数 data。
 * @param targetPath 参数 targetPath。
 * @returns 命中时返回 DirNode，不存在返回 null。
 * 返回值示例：const result = getStat(data, 'demo-value'); // { name: 'users', nodeType: 1, path: '/team/users' } 或 null
 */
export function getStat(data: Collections[], targetPath: string): DirNode | null {
  // 变量：normalized，用于保存当前流程中的中间状态。
  const normalized = normalizePath(targetPath);
  if (normalized === '/' || normalized === '') {
    return { name: '/', nodeType: 2, path: '/' };
  }

  // 变量：fileEntry，用于保存当前流程中的中间状态。
  const fileEntry = findCollection(data, normalized);
  if (fileEntry) {
    return createFileNode(fileEntry);
  }

  if (hasDirectoryAtPath(normalized, data)) {
    return {
      name: getDirectoryName(normalized),
      nodeType: 2,
      path: normalized
    };
  }

  return null;
}




/**
 * 1. 更新文件内容
 */
/**
 * 方法：updateFile
 * 说明：按路径更新请求内容并刷新修改时间。
 * @param data 参数 data。
 * @param path 参数 path。
 * @param updates 参数 updates。
 * @returns 返回布尔值；true 表示条件成立，false 表示条件不成立。
 * 返回值示例：const ok = updateFile(data, 'demo-value', { ... }); // true
 */
export function updateFile(data: Collections[], path: string, updates: Partial<Collections>): boolean {
  // 变量：index，用于保存当前流程中的中间状态。
  const index = findCollectionIndex(data, path);
  if (index !== -1) {
    data[index] = { ...data[index], ...updates, mtime: Date.now() };
    return true;
  }
  return false;
}

/**
 * 2. 删除文件或目录（递归删除）
 */
/**
 * 方法：deleteNode
 * 说明：删除文件或目录并递归清理子项。
 * @param data 参数 data。
 * @param path 参数 path。
 * @returns 返回 Collections[] 列表。
 * 返回值示例：const list = deleteNode(data, 'demo-value'); // [{ id: 'demo' }]
 */
export function deleteNode(data: Collections[], path: string): Collections[] {
  // 变量：normalized，用于保存当前流程中的中间状态。
  const normalized = normalizePath(path);

  virtualFolders.forEach((folder) => {
    // 变量：normalizedFolder，用于保存当前流程中的中间状态。
    const normalizedFolder = normalizePath(folder);
    if (isNestedPath(normalized, normalizedFolder)) {
      virtualFolders.delete(folder);
    }
  });
  
  return data.filter(item => {
    // 变量：itemFullPath，用于保存当前流程中的中间状态。
    const itemFullPath = getCollectionPath(item);
    // 变量：itemFolder，用于保存当前流程中的中间状态。
    const itemFolder = normalizePath(item.folder);
    
    // 变量：isExactFile，用于保存当前流程中的中间状态。
    const isExactFile = itemFullPath === normalized;
    // 变量：isInsideFolder，用于保存当前流程中的中间状态。
    const isInsideFolder = isNestedPath(normalized, itemFolder);
    
    return !isExactFile && !isInsideFolder;
  });
}

/**
 * 3. 重命名或移动
 * 支持文件重命名和目录重命名（自动迁移子文件）
 */
/**
 * 方法：renameNode
 * 说明：重命名或移动节点并迁移子路径。
 * @param data 参数 data。
 * @param oldPath 参数 oldPath。
 * @param newPath 参数 newPath。
 * @returns 无返回值，通过副作用完成处理。
 * 返回值示例：renameNode(data, 'demo-value', 'demo-value'); // undefined
 */
export function renameNode(data: Collections[], oldPath: string, newPath: string): void {
  // 变量：normalizedOld，用于保存当前流程中的中间状态。
  const normalizedOld = normalizePath(oldPath);
  // 变量：normalizedNew，用于保存当前流程中的中间状态。
  const normalizedNew = normalizePath(newPath);
  // 变量：target，用于保存当前流程中的中间状态。
  const target = splitPath(normalizedNew);

  data.forEach((item, index) => {
    // 变量：itemFullPath，用于保存当前流程中的中间状态。
    const itemFullPath = getCollectionPath(item);
    // 变量：itemFolder，用于保存当前流程中的中间状态。
    const itemFolder = normalizePath(item.folder);

    if (itemFullPath === normalizedOld) {
      data[index] = { ...item, name: target.name, folder: target.folder, mtime: Date.now() };
      return;
    }

    if (isNestedPath(normalizedOld, itemFolder)) {
      // 变量：relativePart，用于保存当前流程中的中间状态。
      const relativePart = itemFolder.slice(normalizedOld.length);
      data[index].folder = normalizePath(normalizedNew + relativePart);
    }
  });

  // 变量：migratedFolders，用于保存当前流程中的中间状态。
  const migratedFolders = new Set<string>();
  virtualFolders.forEach((folder) => {
    // 变量：normalizedFolder，用于保存当前流程中的中间状态。
    const normalizedFolder = normalizePath(folder);
    if (isNestedPath(normalizedOld, normalizedFolder)) {
      // 变量：suffix，用于保存当前流程中的中间状态。
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
/**
 * 方法：createItem
 * 说明：创建请求文件或虚拟目录。
 * @param data 参数 data。
 * @param path 参数 path。
 * @param isDir 参数 isDir。
 * @returns 无返回值，通过副作用完成处理。
 * 返回值示例：createItem(data, 'demo-value', true); // undefined
 */
export function createItem(data: Collections[], path: string, isDir: boolean): void {
  // 变量：normalized，用于保存当前流程中的中间状态。
  const normalized = normalizePath(path);
  const { name, folder } = splitPath(normalized);

  if (!isDir) {
    data.push(createRequest(name, folder));
    return;
  }

  virtualFolders.add(normalized);
}



/**
 * 5. 判断路径是文件、目录还是不存在
 * 返回值: 'file' | 'dir' | null
 */
/**
 * 方法：getPathType
 * 说明：判断路径类型：文件、目录或不存在。
 * @param data 参数 data。
 * @param path 参数 path。
 * @returns 命中时返回 'file' | 'dir'，不存在返回 null。
 * 返回值示例：const result = getPathType(data, 'demo-value'); // { ok: true } 或 null
 */
export function getPathType(data: Collections[], path: string): 'file' | 'dir' | null {
  // 变量：normalized，用于保存当前流程中的中间状态。
  const normalized = normalizePath(path);
  if (normalized === '/' || normalized === '') return 'dir';

  if (data.some(item => getCollectionPath(item) === normalized)) return 'file';
  if (hasDirectoryAtPath(normalized, data)) return 'dir';

  return null;
}

/**
 * 6. 读取文件内容
 * 根据路径获取 Collections 对象
 */
/**
 * 方法：getFileContent
 * 说明：按路径读取请求副本。
 * @param data 参数 data。
 * @param path 参数 path。
 * @returns 命中时返回 Collections，不存在返回 null。
 * 返回值示例：const result = getFileContent(data, 'demo-value'); // { id: 'req_demo', type: 'GET', name: 'users', folder: '/', url: 'https://example.com' } 或 null
 */
export function getFileContent(data: Collections[], path: string): Collections | null {
  // 变量：found，用于保存当前流程中的中间状态。
  const found = findCollection(data, path);
  return found ? cloneCollection(found) : null;
}
