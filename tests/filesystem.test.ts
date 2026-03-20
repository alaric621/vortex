import { describe, expect, it, beforeEach } from "vitest";
import { 
  updateFile, 
  deleteNode, 
  renameNode, 
  createItem,
  getFileContent
} from "../src/core/filesystem/store";
import { Collections } from "../typings/filesystem";

describe("FileSystem Logic Integration Tests", () => {
  let testData: Collections[];

  // 每次测试前使用你提供的 sourceData 进行初始化
  beforeEach(() => {
    testData = [
      { "id": "req_mmtjmybx_fnqqjz", "type": "GET", "name": "hello", "folder": "/fsa", "url": "http://baidu.com", "ctime": 1710000000000, "mtime": 1710003600000, "headers": {}, "body": "", "scripts": { "pre": "", "post": "" } },
      { "id": "req_root_status", "type": "GET", "name": "status", "folder": "/", "url": "http://localhost:9501/status", "ctime": 1710100000000, "mtime": 1710107200000, "headers": {}, "body": "", "scripts": { "pre": "", "post": "" } },
      { "id": "req_fsa_list", "type": "GET", "name": "list", "folder": "/fsa", "url": "http://localhost:9501/fsa/list", "ctime": 1710200000000, "mtime": 1710201800000, "headers": {}, "body": "", "scripts": { "pre": "", "post": "" } },
      { "id": "req_team_users", "type": "GET", "name": "users", "folder": "/team", "url": "http://localhost:9501/team/users", "ctime": 1710300000000, "mtime": 1710305400000, "headers": {}, "body": "", "scripts": { "pre": "", "post": "" } },
      { "id": "req_backend_jobs", "type": "GET", "name": "jobs", "folder": "/team/backend", "url": "http://localhost:9501/team/backend/jobs", "ctime": 1710400000000, "mtime": 1710409000000, "headers": {}, "body": "", "scripts": { "pre": "", "post": "" } }
    ];
  });

  // --- 1. 更新测试 ---
  it("should update file URL and mtime", () => {
    const targetPath = "/fsa/hello";
    const newUrl = "https://new-api.com";
    
    const success = updateFile(testData, targetPath, { url: newUrl });
    
    expect(success).toBe(true);
    const updated = testData.find(i => i.id === "req_mmtjmybx_fnqqjz");
    expect(updated?.url).toBe(newUrl);
    expect(updated?.mtime).toBeGreaterThan(1710003600000); // 验证 mtime 已刷新
  });

  it("should update root file path correctly", () => {
    const targetPath = "/status";
    const newUrl = "https://root-api.com/status";

    const success = updateFile(testData, targetPath, { url: newUrl });

    expect(success).toBe(true);
    const updated = testData.find(i => i.id === "req_root_status");
    expect(updated?.url).toBe(newUrl);
  });

  // --- 2. 删除测试 ---
  it("should delete a specific file", () => {
    const updatedData = deleteNode(testData, "/fsa/list");
    expect(updatedData.length).toBe(4);
    expect(updatedData.some(i => i.id === "req_fsa_list")).toBe(false);
  });

  it("should delete a folder recursively (delete /team should remove /team/backend/jobs)", () => {
    // 删除 /team 目录
    const updatedData = deleteNode(testData, "/team");
    
    // 应该剩下的项：/fsa/hello, /status, /fsa/list (共3项)
    // 被删除的项：/team/users, /team/backend/jobs
    expect(updatedData.length).toBe(3);
    const hasBackendJob = updatedData.some(i => i.folder.startsWith("/team"));
    expect(hasBackendJob).toBe(false);
  });

  // --- 3. 重命名与移动测试 ---
  it("should rename a file (change name but keep folder)", () => {
    renameNode(testData, "/fsa/hello", "/fsa/hi");
    const item = testData.find(i => i.id === "req_mmtjmybx_fnqqjz");
    expect(item?.name).toBe("hi");
    expect(item?.folder).toBe("/fsa");
  });

  it("should move a folder and update its children's folders", () => {
    // 将 /team 移动到 /archive/team
    renameNode(testData, "/team", "/archive/team");
    
    const users = testData.find(i => i.id === "req_team_users");
    const jobs = testData.find(i => i.id === "req_backend_jobs");
    
    expect(users?.folder).toBe("/archive/team");
    expect(jobs?.folder).toBe("/archive/team/backend"); // 深度迁移路径
  });

  // --- 4. 创建测试 ---
  it("should create a new file in a specific folder", () => {
    createItem(testData, "/team/new_request", false);
    expect(testData.length).toBe(6);
    
    const newItem = testData.find(i => i.name === "new_request");
    expect(newItem?.folder).toBe("/team");
    expect(newItem?.id).toMatch(/^req_/);
  });

  it("should return a deep-cloned file content snapshot", () => {
    const file = getFileContent(testData, "/fsa/hello");

    expect(file).not.toBeNull();
    file!.headers!.Authorization = "Bearer changed";
    file!.scripts!.pre = "console.log('changed')";

    const original = testData.find(i => i.id === "req_mmtjmybx_fnqqjz");
    expect(original?.headers?.Authorization).toBeUndefined();
    expect(original?.scripts?.pre).toBe("");
  });
});
