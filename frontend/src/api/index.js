/**
 * API 模块统一导出
 * 重新整理后的API接口分类，按功能模块清晰划分
 */

// 导出API配置和客户端
export * from "./config";
export * from "./client";

// 导出服务模块
import * as authService from "./services/authService";
import * as pasteService from "./services/pasteService";
import * as fileService from "./services/fileService";
import * as storageService from "./services/storageService";
import * as mountService from "./services/mountService";
import * as systemService from "./services/systemService";
import * as urlUploadService from "./services/urlUploadService";
import * as fsService from "./services/fsService";
import * as previewService from "./services/previewService";

// 统一服务导出 - 按功能模块重新组织
export const api = {
  // 认证相关
  auth: authService,

  // 文本分享相关
  paste: pasteService,

  // 文件管理相关
  file: fileService,

  // 文件预览相关
  preview: previewService,

  // 存储配置相关
  storage: storageService,

  // 挂载点管理相关
  mount: mountService,

  // 系统管理相关
  system: systemService,

  // URL上传相关
  urlUpload: urlUploadService,

  // 文件系统相关
  fs: {
    ...fsService,
    getUserTypeApi: fsService.getFsApiByUserType,
  },

  // 兼容性导出 - 保持向后兼容
  admin: {
    // 认证相关
    login: authService.adminLogin,
    logout: authService.adminLogout,
    checkLogin: authService.checkAdminLogin,
    changePassword: authService.changeAdminPassword,

    // API密钥管理
    getAllApiKeys: authService.getAllApiKeys,
    createApiKey: authService.createApiKey,
    deleteApiKey: authService.deleteApiKey,
    updateApiKey: authService.updateApiKey,

    // 文本分享管理
    getAllPastes: pasteService.getAllPastes,
    getPasteById: pasteService.getAdminPasteById,
    updatePaste: pasteService.updateAdminPaste,
    deletePaste: pasteService.deleteAdminPaste,
    deletePastes: pasteService.deleteAdminPastes,
    clearExpiredPastes: systemService.clearExpiredPastes,

    // S3配置管理（已迁移到storage）
    getAllS3Configs: storageService.getAllS3Configs,
    getS3Config: storageService.getS3Config,
    createS3Config: storageService.createS3Config,
    updateS3Config: storageService.updateS3Config,
    deleteS3Config: storageService.deleteS3Config,
    setDefaultS3Config: storageService.setDefaultS3Config,
    testS3Config: storageService.testS3Config,

    // 系统管理
    getSystemSettings: systemService.getSystemSettings,
    updateSystemSettings: systemService.updateSystemSettings,
    getDashboardStats: systemService.getDashboardStats,
    getCacheStats: systemService.getCacheStats,
    clearCache: systemService.clearCacheAdmin,

    // 文件系统管理
    getDirectoryList: fsService.getAdminDirectoryList,
    getFileInfo: fsService.getAdminFileInfo,
    getFileDownloadUrl: fsService.getAdminFileDownloadUrl,
    getFileLink: fsService.getAdminFileLink,
    createDirectory: fsService.createAdminDirectory,
    uploadFile: fsService.uploadAdminFile,
    deleteItem: fsService.deleteAdminItem,
    batchDeleteItems: fsService.batchDeleteAdminItems,
    renameItem: fsService.renameAdminItem,
    updateFile: fsService.updateAdminFile,
    // 复制相关
    copyItem: fsService.copyAdminItem,
    batchCopyItems: fsService.batchCopyAdminItems,
    commitBatchCopy: fsService.commitAdminBatchCopy,
    commitCopy: fsService.commitAdminCopy,
  },

  file: {
    // 基础文件操作
    uploadFile: fileService.uploadFile,
    directUploadFile: fileService.directUploadFile,
    getUploadPresignedUrl: fileService.getUploadPresignedUrl,
    completeFileUpload: fileService.completeFileUpload,
    getMaxUploadSize: systemService.getMaxUploadSize,

    // 管理员文件管理
    getFiles: fileService.getAdminFiles,
    getFile: fileService.getAdminFile,
    updateFile: fileService.updateAdminFile,
    deleteFile: fileService.deleteAdminFile,

    // API密钥用户文件管理
    getUserFiles: fileService.getUserFiles,
    getUserFile: fileService.getUserFile,
    updateUserFile: fileService.updateUserFile,
    deleteUserFile: fileService.deleteUserFile,

    // 公共文件访问
    getPublicFile: fileService.getPublicFile,
    verifyFilePassword: fileService.verifyFilePassword,

    // S3配置（兼容性，已迁移到storage）
    getS3Configs: storageService.getAllS3Configs,
  },

  mount: {
    // 挂载点管理
    getMountsList: mountService.getAdminMountsList,
    getMountById: mountService.getAdminMountById,
    createMount: mountService.createAdminMount,
    updateMount: mountService.updateAdminMount,
    deleteMount: mountService.deleteAdminMount,

    // API密钥用户访问
    getUserMountsList: mountService.getUserMountsList,
    getUserMountById: mountService.getUserMountById,
  },

  test: {
    // API密钥验证（已迁移到auth）
    verifyApiKey: authService.verifyApiKey,

    // S3连接测试（已迁移到storage）
    testS3Connection: storageService.testS3Config,
  },

  user: {
    // API密钥用户的文本服务
    paste: {
      getPastes: pasteService.getUserPastes,
      getPasteById: pasteService.getUserPasteById,
      updatePaste: pasteService.updateUserPaste,
      deletePaste: pasteService.deleteUserPaste,
      deletePastes: pasteService.deleteUserPastes,
    },

    // API密钥用户的挂载服务（只读）
    mount: {
      getMounts: mountService.getUserMountsList,
      getMountById: mountService.getUserMountById,
    },

    // API密钥用户的文件系统服务
    fs: {
      getDirectoryList: fsService.getUserDirectoryList,
      getFileInfo: fsService.getUserFileInfo,
      getFileDownloadUrl: fsService.getUserFileDownloadUrl,
      getFileLink: fsService.getUserFileLink,
      createDirectory: fsService.createUserDirectory,
      uploadFile: fsService.uploadUserFile,
      deleteItem: fsService.deleteUserItem,
      batchDeleteItems: fsService.batchDeleteUserItems,
      renameItem: fsService.renameUserItem,
      updateFile: fsService.updateUserFile,
      // 复制相关
      copyItem: fsService.copyUserItem,
      batchCopyItems: fsService.batchCopyUserItems,
      commitBatchCopy: fsService.commitUserBatchCopy,
      commitCopy: fsService.commitUserCopy,
    },

    // API密钥用户的URL上传服务
    urlUpload: {
      validateUrlInfo: urlUploadService.validateUrlInfo,
      getProxyUrl: urlUploadService.getProxyUrl,
      getUrlUploadPresignedUrl: urlUploadService.getUrlUploadPresignedUrl,
      uploadFromUrlToS3: urlUploadService.uploadFromUrlToS3,
      commitUrlUpload: urlUploadService.commitUrlUpload,
    },

    // API密钥用户的系统服务
    system: {
      clearCache: systemService.clearCacheUser,
    },
  },
};

// 默认导出API服务对象
export default api;
