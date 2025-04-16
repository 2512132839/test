/**
 * API 模块统一导出
 */

// 导出API配置
export * from "./config";

// 导出API客户端
export * from "./client";

// 导出服务模块
import * as pasteService from "./pasteService";
import * as adminService from "./adminService";
import * as fileService from "./fileService";
import * as testService from "./testService";
import * as mountService from "./mountService";
import * as fsService from "./fsService";

// 统一服务导出
export const api = {
  paste: pasteService,
  admin: adminService,
  file: fileService,
  test: testService,
  mount: mountService,
  fs: fsService,
  user: {
    // 添加API密钥用户的文本服务
    paste: {
      // 重新暴露API密钥用户的文本相关函数
      getPastes: pasteService.getUserPastes,
      getPasteById: pasteService.getUserPasteById,
      updatePaste: pasteService.updateUserPaste,
      deletePaste: pasteService.deleteUserPaste,
      deletePastes: pasteService.deleteUserPastes,
    },
    // 添加API密钥用户的挂载服务
    mount: {
      getMounts: mountService.getUserMountsList,
      getMountById: mountService.getUserMountById,
      createMount: mountService.createUserMount,
      updateMount: mountService.updateUserMount,
      deleteMount: mountService.deleteUserMount,
    },
    // 添加API密钥用户的文件系统服务
    fs: {
      getDirectoryList: fsService.getUserDirectoryList,
      getFileInfo: fsService.getUserFileInfo,
      getFileDownloadUrl: fsService.getUserFileDownloadUrl,
      createDirectory: fsService.createUserDirectory,
      uploadFile: fsService.uploadUserFile,
      deleteItem: fsService.deleteUserItem,
      batchDeleteItems: fsService.batchDeleteUserItems,
      renameItem: fsService.renameUserItem,
    },
  },
};

// 默认导出API服务对象
export default api;
