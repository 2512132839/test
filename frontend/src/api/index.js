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

// 统一服务导出
export const api = {
  paste: pasteService,
  admin: adminService,
  file: fileService,
  test: testService,
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
  },
};

// 默认导出API服务对象
export default api;
