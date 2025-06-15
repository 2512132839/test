export default {
  // 通用
  common: {
    unknown: "未知",
    loading: "加载中...",
    confirm: "确认",

    // 分页组件
    pagination: {
      // 移动端
      previousPage: "上一页",
      nextPage: "下一页",
      pageInfo: "{current}/{total}",

      // 桌面端
      showingRange: "显示第 {start} 至 {end} 条，共 {total} 条",
      firstPage: "第一页",
      lastPage: "最后一页",

      // 无障碍文本
      ariaLabel: "分页导航",
      srFirstPage: "第一页",
      srPreviousPage: "上一页",
      srNextPage: "下一页",
      srLastPage: "最后一页",
    },

    // 错误提示组件
    errorToast: {
      defaultTitle: "操作失败",
      close: "关闭",
      srClose: "关闭",
    },
  },

  // 应用标题
  app: {
    title: "CloudPaste",
  },

  // 页面标题
  pageTitle: {
    home: "CloudPaste - 在线剪贴板",
    upload: "文件上传 - CloudPaste",
    admin: "管理面板 - CloudPaste",
    pasteView: "查看分享 - CloudPaste",
    fileView: "文件预览 - CloudPaste",
    mountExplorer: "挂载浏览 - CloudPaste",
    notFound: "页面未找到 - CloudPaste",
    // 管理模块标题
    adminModules: {
      dashboard: "仪表板",
      textManagement: "文本管理",
      fileManagement: "文件管理",
      storageConfig: "S3存储配置",
      mountManagement: "挂载管理",
      keyManagement: "密钥管理",
      settings: "系统设置",
    },
  },

  // 导航栏
  nav: {
    home: "首页",
    upload: "文件上传",
    mountExplorer: "挂载浏览",
    admin: "管理面板",
    menu: "主菜单",
  },

  // 主题切换
  theme: {
    toggle: "切换主题",
    light: "浅色模式",
    dark: "深色模式",
    auto: "自动模式",
  },

  // 底部版权
  footer: {
    copyright: "© {year} CloudPaste. 保留所有权利。",
  },

  // 面包屑导航
  breadcrumb: {
    navigation: "面包屑导航",
    root: "根目录",
    batchOperations: "批量操作",
    enableSelection: "启用勾选",
    exitSelection: "退出勾选",
    copySelected: "复制选中项",
    deleteSelected: "删除选中项",
    selectedCount: "({count})",
  },

  // 管理面板
  admin: {
    title: {
      admin: "管理面板",
      user: "用户面板",
    },
    sidebar: {
      dashboard: "仪表板",
      textManagement: "文本管理",
      fileManagement: "文件管理",
      storageConfig: "S3存储配置",
      mountManagement: "挂载管理",
      keyManagement: "密钥管理",
      settings: "系统设置",
      logout: "退出登录",
      logoutAuth: "退出认证",
      openMenu: "打开菜单",
      closeMenu: "关闭菜单",
      menuTitle: {
        admin: "管理面板",
        user: "用户面板",
      },
    },
    permissionDenied: {
      title: "权限不足",
      message: "您没有访问此功能的权限。",
      suggestion: "请联系管理员获取相应权限。",
    },

    // 登录面板
    login: {
      // 标题
      adminLogin: "管理员登录",
      apiKeyAuth: "API密钥认证",

      // 表单字段
      username: "用户名",
      password: "密码",
      apiKey: "API密钥",

      // 按钮
      loginButton: "登录",
      loggingIn: "登录中...",
      useApiKey: "使用API密钥登录",
      useAdminAccount: "使用管理员账户登录",

      // 输入验证
      inputRequired: {
        usernamePassword: "请输入用户名和密码",
        apiKey: "请输入API密钥",
      },

      // 错误消息
      errors: {
        invalidToken: "无效的登录令牌",
        invalidCredentials: "用户名或密码错误",
        loginFailed: "登录失败",
        invalidResponse: "服务器响应格式错误",
        serverError: "服务器错误",
        keyValidationFailed: "API密钥验证失败",
        permissionInfo: "无法获取权限信息",
        invalidApiKey: "API密钥无效或未授权",
        insufficientPermissions: "API密钥权限不足",
      },
    },

    // 系统设置
    settings: {
      title: "系统设置",
      description: "管理系统配置和管理员账户信息",

      // 上传设置
      uploadSettings: {
        title: "上传限制设置",
        description: "配置文件上传的大小限制和WebDAV上传模式",
        maxUploadSizeLabel: "最大上传文件大小",
        maxUploadSizePlaceholder: "输入数字",
        maxUploadSizeHint: "设置单个文件的最大上传大小限制",
        unitKB: "KB",
        unitMB: "MB",
        unitGB: "GB",
        footerHint: "修改后将立即生效，影响所有用户的文件上传",
      },

      // WebDAV设置
      webdavSettings: {
        uploadModeLabel: "WebDAV上传模式",
        uploadModeHint: "选择WebDAV客户端的上传处理方式",
        modes: {
          auto: "自动模式（推荐）",
          proxy: "预签名上传",
          multipart: "分片上传",
          direct: "直接上传",
        },
      },

      // 管理员设置
      adminSettings: {
        title: "管理员信息修改",
        description: "修改管理员用户名和密码",
        newUsernameLabel: "新用户名",
        newUsernamePlaceholder: "输入新的用户名",
        newUsernameHint: "留空则不修改用户名",
        currentPasswordLabel: "当前密码",
        currentPasswordPlaceholder: "输入当前密码",
        currentPasswordHint: "验证身份需要输入当前密码",
        newPasswordLabel: "新密码",
        newPasswordPlaceholder: "输入新密码",
        newPasswordHint: "留空则不修改密码",
        footerHint: "修改后将自动退出登录，需要重新登录",
      },

      // 状态消息
      status: {
        success: "设置更新成功",
        processing: "处理中...",
        updateSettings: "更新设置",
        updateAccount: "更新账户",
        adminUpdateSuccess: "管理员信息更新成功，即将自动退出登录",

        // 错误消息
        errors: {
          maxUploadSizeError: "最大上传大小必须大于0",
          updateSettingsError: "更新系统设置失败",
          currentPasswordRequired: "请输入当前密码",
          newFieldRequired: "请至少填写新用户名或新密码中的一项",
          passwordSame: "新密码不能与当前密码相同",
          updateInfoError: "更新管理员信息失败",
        },
      },
    },

    // 密钥管理
    keyManagement: {
      title: "API密钥管理",
      refresh: "刷新",
      bulkDelete: "批量删除",
      delete: "删除",
      create: "创建新密钥",
      createShort: "创建",
      lastRefreshed: "最后刷新",

      // 表格列标题
      table: {
        select: "选择",
        name: "名称",
        key: "密钥",
        permissions: "权限",
        basicPath: "基础路径",
        expires: "过期时间",
        lastUsed: "最后使用",
        actions: "操作",
        noData: "暂无API密钥",
        loading: "加载中...",
      },

      // 表格字段名称（用于兼容）
      keyName: "名称",
      key: "密钥",
      permissions: "权限",
      permissionsColumn: "权限",
      basicPath: "基础路径",
      createdAt: "创建时间",
      expiresAt: "过期时间",
      lastUsed: "最后使用",
      actions: "操作",
      loading: "加载中...",
      loadingKeys: "加载密钥中...",
      neverUsed: "从未使用",

      // 空状态
      noKeysTitle: "暂无API密钥",
      noKeysDescription: "您还没有创建任何API密钥，点击上方按钮创建第一个密钥",

      // 权限标签
      textPermissionFull: "文本",
      filePermissionFull: "文件",
      mountPermissionFull: "挂载",
      noPermission: "无权限",

      // 权限显示
      permissions: {
        text: "文本",
        file: "文件",
        mount: "挂载",
        readOnly: "只读",
        none: "无",
      },

      // 操作按钮
      copyKey: "复制",
      copyKeyFull: "复制完整密钥",
      edit: "编辑",
      deleteKey: "删除",
      neverExpires: "永不过期",

      // 创建密钥模态框
      createModal: {
        title: "创建新API密钥",
        tabs: {
          basic: "基本信息",
          path: "路径选择",
        },
        keyName: "密钥名称",
        keyNamePlaceholder: "输入密钥名称",
        keyNameHelp: "为您的API密钥设置一个易于识别的名称",
        useCustomKey: "使用自定义密钥",
        customKey: "自定义密钥",
        customKeyPlaceholder: "输入自定义密钥（可选）",
        customKeyHelp: "只能包含字母、数字、下划线和短横线",
        expiration: "过期时间",
        expirationOptions: {
          "1d": "1天",
          "7d": "7天",
          "30d": "30天",
          never: "永不过期",
          custom: "自定义",
        },
        customExpiration: "自定义过期时间",
        customExpirationPlaceholder: "请输入天数",
        permissions: "权限设置",
        permissions: {
          text: "文本权限",
          file: "文件权限",
          mount: "挂载权限",
        },
        textPermission: "文本权限",
        filePermission: "文件权限",
        mountPermission: "挂载权限",
        readOnlyMount: "只读挂载",
        basicPath: "基本路径",
        basicPathPlaceholder: "/",
        basicPathHelp: "设置API密钥可访问的基本路径，默认为根路径",
        selectPath: "选择路径",
        securityTip: "安全提示",
        securityMessage: "请妥善保管您的API密钥，不要在公共场所或不安全的环境中使用。",
        pathSelector: {
          title: "选择基础路径",
          rootDirectory: "根目录",
          selectDirectory: "选择目录",
          currentPath: "当前选择",
          confirm: "确认路径",
          cancel: "取消",
          loading: "加载中...",
          loadError: "加载失败",
          noDirectories: "此目录下没有子目录",
        },
        create: "创建",
        creating: "创建中...",
        processing: "创建中...",
        cancel: "取消",

        // 错误消息
        errors: {
          nameRequired: "密钥名称不能为空",
          customKeyRequired: "自定义密钥不能为空",
          customKeyFormat: "自定义密钥格式不正确，只能包含字母、数字、下划线和短横线",
          expirationRequired: "自定义过期时间不能为空",
          invalidExpiration: "无效的过期时间",
          createFailed: "创建密钥失败",
        },
      },

      // 编辑密钥模态框
      editModal: {
        title: "编辑API密钥",
        tabs: {
          basic: "基本信息",
          path: "路径选择",
        },
        keyName: "密钥名称",
        keyNamePlaceholder: "请输入密钥名称",
        keyNameHelp: "为您的API密钥设置一个易于识别的名称",
        expiration: "过期时间",
        expirationOptions: {
          "1d": "1天",
          "7d": "7天",
          "30d": "30天",
          never: "永不过期",
          custom: "自定义",
        },
        customExpiration: "自定义过期时间",
        customExpirationPlaceholder: "请输入天数",
        permissions: "权限设置",
        permissions: {
          text: "文本权限",
          file: "文件权限",
          mount: "挂载权限",
        },
        textPermission: "文本权限",
        filePermission: "文件权限",
        mountPermission: "挂载权限",
        basicPath: "基本路径",
        basicPathPlaceholder: "/",
        basicPathHelp: "设置API密钥可访问的基本路径，默认为根路径",
        selectPath: "选择路径",
        securityTip: "安全提示",
        securityMessage: "请妥善保管您的API密钥，不要在公共场所或不安全的环境中使用。",
        pathSelector: {
          title: "选择基础路径",
          rootDirectory: "根目录",
          selectDirectory: "选择目录",
          currentPath: "当前选择",
          confirm: "确认路径",
          cancel: "取消",
          loading: "加载中...",
          loadError: "加载失败",
          noDirectories: "此目录下没有子目录",
        },
        update: "更新",
        updating: "更新中...",
        processing: "更新中...",
        cancel: "取消",

        // 错误消息
        errors: {
          nameRequired: "密钥名称不能为空",
          expirationRequired: "自定义过期时间不能为空",
          invalidExpiration: "无效的过期时间",
          updateFailed: "更新密钥失败",
        },
      },

      // 成功消息
      success: {
        created: "API密钥创建成功",
        createdAndCopied: "密钥已创建并复制到剪贴板",
        updated: "API密钥更新成功",
        deleted: "API密钥删除成功",
        bulkDeleted: "批量删除成功，共删除 {count} 个密钥",
        copied: "密钥已复制到剪贴板",
      },

      // 错误消息
      error: {
        cannotLoadList: "无法加载密钥列表",
        loadFailed: "加载API密钥失败",
        copyFailed: "复制到剪贴板失败",
        deleteFailed: "删除密钥失败",
        bulkDeleteFailed: "批量删除失败",
        noKeysSelected: "请选择要删除的密钥",
      },

      // 确认对话框
      confirmDelete: '确定要删除密钥 "{name}" 吗？此操作不可撤销。',
      confirmBulkDelete: "确定要删除选中的 {count} 个密钥吗？此操作不可撤销。",
      selectKeysFirst: "请先选择要删除的密钥",
      bulkDeleteConfirm: "确定要删除选中的 {count} 个密钥吗？此操作不可撤销。",
    },

    // 挂载管理
    mount: {
      // 页面标题和操作
      title: "挂载管理",
      accessibleMounts: "可访问的挂载点",
      createMount: "新建挂载点",
      editMount: "编辑挂载点",
      refresh: "刷新",
      refreshing: "刷新中...",
      search: "搜索挂载点...",

      // 挂载点状态
      status: {
        active: "启用",
        inactive: "禁用",
        enabled: "已启用",
        disabled: "已禁用",
      },

      // 挂载点信息
      info: {
        name: "挂载点名称",
        path: "挂载路径",
        storageType: "存储类型",
        storageConfig: "存储配置",
        remark: "备注",
        sortOrder: "排序",
        cacheTtl: "缓存时间",
        createdBy: "创建者",
        createdAt: "创建时间",
        updatedAt: "更新时间",
        lastRefresh: "最后刷新",
      },

      // 表单字段
      form: {
        name: "挂载点名称",
        namePlaceholder: "请输入挂载点名称",
        nameHint: "用于标识挂载点的名称",

        storageType: "存储类型",
        storageTypeHint: "选择存储后端类型",

        storageConfig: "存储配置",
        storageConfigPlaceholder: "请选择存储配置",
        storageConfigHint: "选择要使用的S3存储配置",

        mountPath: "挂载路径",
        mountPathPlaceholder: "请输入挂载路径",
        mountPathHint: "在存储中的路径，留空表示根目录",

        remark: "备注",
        remarkPlaceholder: "请输入备注信息",
        remarkHint: "可选的描述信息",

        sortOrder: "排序",
        sortOrderHint: "数字越小排序越靠前",

        cacheTtl: "缓存时间(秒)",
        cacheTtlHint: "文件列表缓存时间，0表示不缓存",

        isActive: "启用状态",
        isActiveHint: "是否启用此挂载点",

        // S3配置相关
        s3Config: "S3存储配置",
        selectS3Config: "请选择S3存储配置",
        noS3Config: "暂无可用的S3存储配置",

        // 存储类型选项
        storageTypes: {
          s3: "S3存储",
        },

        // 占位符
        cacheTtlPlaceholder: "默认300秒",
        sortOrderPlaceholder: "0",

        // 按钮
        save: "保存",
        saving: "保存中...",
        cancel: "取消",
        create: "创建",
        creating: "创建中...",
        update: "更新",
        updating: "更新中...",
      },

      // 操作按钮
      actions: {
        edit: "编辑",
        delete: "删除",
        enable: "启用",
        disable: "禁用",
        view: "查看",
        browse: "浏览",
      },

      // 确认对话框
      confirmDelete: {
        title: "确认删除",
        message: '确定要删除挂载点 "{name}" 吗？此操作不可撤销。',
        confirm: "删除",
        cancel: "取消",
      },

      // 成功消息
      success: {
        created: "挂载点创建成功",
        updated: "挂载点更新成功",
        deleted: "挂载点删除成功",
        enabled: "挂载点启用成功",
        disabled: "挂载点禁用成功",
        refreshed: "数据刷新成功",
      },

      // 错误消息
      error: {
        loadFailed: "加载挂载点列表失败",
        createFailed: "创建挂载点失败",
        updateFailed: "更新挂载点失败",
        deleteFailed: "删除挂载点失败",
        enableFailed: "启用挂载点失败",
        disableFailed: "禁用挂载点失败",
        loadS3ConfigsFailed: "加载S3配置失败",
        loadApiKeysFailed: "加载API密钥列表失败",
        noPermission: "没有权限执行此操作",
        apiKeyNoPermission: "API密钥用户无权限修改挂载点状态",
        apiKeyCannotDelete: "API密钥用户无权限删除挂载点",
        apiKeyCannotCreate: "API密钥用户无权限创建挂载点",
        apiKeyCannotManage: "API密钥用户无权限管理挂载点",
        saveFailed: "保存失败",
      },

      // 验证错误
      validation: {
        nameRequired: "挂载点名称不能为空",
        nameMinLength: "挂载点名称至少需要2个字符",
        nameMaxLength: "挂载点名称不能超过50个字符",
        storageConfigRequired: "请选择存储配置",
        mountPathInvalid: "挂载路径格式不正确",
        sortOrderInvalid: "排序必须是非负整数",
        cacheTtlInvalid: "缓存时间必须是非负整数",
      },

      // 空状态
      empty: {
        title: "暂无挂载点",
        description: "还没有创建任何挂载点",
        createFirst: "创建第一个挂载点",
      },

      // 搜索结果
      searchResults: {
        noResults: "没有找到匹配的挂载点",
        found: "找到 {count} 个挂载点",
        clearSearch: "清除搜索",
        tryDifferentTerms: "尝试使用不同的搜索条件",
      },

      // 创建者类型
      creators: {
        system: "系统",
        admin: "管理员",
        apiKey: "密钥",
      },

      // 其他
      currentApiKey: "当前密钥",
      unknownCreator: "未知创建者",
      noRemark: "无备注",
      unlimited: "无限制",
      seconds: "秒",
    },
  },

  // 仪表板
  dashboard: {
    // 页面标题和操作
    systemOverview: "系统概览",
    refresh: "刷新",
    refreshing: "刷新中...",

    // 统计卡片
    totalPastes: "文本分享",
    totalFiles: "文件上传",
    totalApiKeys: "API密钥",
    totalS3Configs: "存储配置",

    // 存储相关
    storageUsage: "存储使用情况",
    allBuckets: "全部存储桶",
    usedStorage: "已使用",
    totalStorage: "总容量",
    usagePercent: "使用率",
    selectBucket: "选择存储桶",

    // 活动统计
    activityOverview: "活动概览",
    weeklyActivity: "近7天活动",
    totalWeekPastes: "本周文本",
    totalWeekFiles: "本周文件",
    weeklyPastes: "本周文本",
    weeklyFiles: "本周文件",
    mostActiveDate: "最活跃日期",
    highestDailyActivity: "最高日活动",
    items: "项",

    // 存储桶分布
    storageBucketDistribution: "存储桶分布",
    otherStorage: "其他存储",

    // 图表切换
    switchToLineChart: "切换到折线图",
    switchToBarChart: "切换到柱状图",

    // 系统信息
    serverEnvironment: "服务器环境",
    dataStorage: "数据存储",

    // 图表相关
    chartType: "图表类型",
    barChart: "柱状图",
    lineChart: "折线图",
    toggleChart: "切换图表类型",

    // 错误和状态
    fetchError: "获取数据失败，请稍后重试",
    loadingData: "加载数据中...",
    noData: "暂无数据",

    // 时间相关
    lastUpdated: "最后更新",

    // 存储单位
    storageUnits: {
      bytes: "字节",
      kb: "KB",
      mb: "MB",
      gb: "GB",
      tb: "TB",
    },
  },

  // 挂载浏览
  mount: {
    title: "挂载浏览",
    permissionRequired: "需要管理员权限或有效的API密钥才能访问挂载浏览，请",
    loginAuth: "登录管理面板或配置API密钥",
    cancel: "取消",
    backToFileList: "返回文件列表",

    // 权限提示
    noPermissionForPath: "您没有权限访问此目录的内容。您只能访问 {path} 及其子目录。",

    // 批量删除对话框
    batchDelete: {
      title: "确认批量删除",
      message: "您确定要删除选中的 {count} 个项目吗？此操作不可撤销。",
      selectedItems: "选中的项目:",
      folder: "(文件夹)",
      moreItems: "... 等 {count} 个项目",
      confirmButton: "删除",
      cancelButton: "取消",
    },

    // 文件操作
    operations: {
      upload: "上传",
      createFolder: "新建文件夹",
      refresh: "刷新",
      viewMode: "视图模式",
      batchOperations: "批量操作",
      tasks: "任务管理",
    },

    // 新建文件夹对话框
    createFolder: {
      enterName: "请输入文件夹名称",
      folderName: "文件夹名称",
      placeholder: "新文件夹",
      cancel: "取消",
      create: "创建",
    },

    // 视图模式
    viewModes: {
      list: "列表视图",
      grid: "网格视图",
    },

    // 文件列表
    fileList: {
      loading: "加载中...",
      empty: "此目录为空",
      noMountPoints: "无可用挂载点",
      name: "名称",
      size: "大小",
      modifiedTime: "修改时间",
      type: "类型",
      actions: "操作",
      selectAll: "全选",
      deselectAll: "取消全选",
    },

    // 重命名对话框
    rename: {
      title: "重命名",
      enterNewName: "请输入新的名称",
      newName: "新名称",
      cancel: "取消",
      confirm: "确认",
    },

    // 删除确认对话框
    delete: {
      title: "确认删除",
      message: "您确定要删除{type} {name} 吗？",
      folderWarning: "此操作将删除文件夹及其所有内容。",
      cancel: "取消",
      confirm: "删除",
    },

    // 操作消息
    messages: {
      apiKeyInfoUpdated: "已更新API密钥信息",
      refreshSuccess: "刷新成功",
      refreshFailed: "刷新失败，请重试",
      getDirectoryContentFailed: "获取目录内容失败: {message}",
      getDirectoryContentFailedUnknown: "获取目录内容失败: {message}",
      fileUploadSuccess: "文件上传成功",
      fileUploadFailed: "文件上传失败: {message}",
      fileUploadFailedUnknown: "文件上传失败: {message}",
      uploadCancelling: "正在取消上传...",
      folderCreateSuccess: "文件夹创建成功",
      folderCreateFailed: "文件夹创建失败: {message}",
      folderCreateFailedUnknown: "文件夹创建失败: {message}",
      renameSuccess: "{type}重命名成功",
      renameFailed: "重命名失败: {message}",
      renameFailedUnknown: "重命名失败: {message}",
      deleteSuccess: "{type}删除成功",
      deleteFailed: "删除失败: {message}",
      deleteFailedUnknown: "删除失败: {message}",
      downloadPreparing: "准备下载文件...",
      downloadSuccess: "文件下载成功",
      downloadFailed: "文件下载失败: {message}",
      downloadFailedUnknown: "文件下载失败: {message}",
      previewLoadFailed: "加载文件预览失败: {message}",
      previewLoadFailedUnknown: "加载文件预览失败: {message}",
      previewError: "文件预览加载失败",
      uploadError: "上传失败: {message}",
      uploadErrorUnknown: "上传失败: {message}",
      batchDeleteInProgress: "正在删除选中的项目...",
      batchDeletePartialSuccess: "删除操作部分成功，{success} 个成功，{failed} 个失败",
      batchDeleteSuccess: "成功删除了 {count} 个项目",
      batchDeleteFailed: "批量删除失败: {message}",
      batchDeleteFailedUnknown: "批量删除失败: {message}",
      copySuccess: "{message}",
      copyFailed: "复制失败: {message}",
    },

    // 文件预览
    filePreview: {
      downloadFile: "下载文件",
      directPreview: "直链预览",
      generating: "生成中...",
      fileSize: "文件大小:",
      modifiedTime: "修改时间:",
      fileType: "文件类型:",
      unknown: "未知",
      editMode: "编辑模式",
      previewMode: "预览模式",
      saving: "保存中...",
      save: "保存",
      cancel: "取消",
      language: "语言:",
      autoDetect: "自动检测",
      configFile: "配置文件",
      loadingPreview: "正在加载Office预览...",
      previewError: "加载文件预览失败",
      retryLoad: "请尝试重新加载或下载文件查看",
      retry: "重试",
      cannotPreview: "文件无法预览",
      downloadToView: "当前文件类型不支持在线预览，请点击下载按钮下载查看",
      wordPreview: "Word文档预览",
      excelPreview: "Excel表格预览",
      powerpointPreview: "PowerPoint演示文稿预览",
      exitFullscreen: "退出全屏",
      fullscreen: "全屏",
      useMicrosoftPreview: "使用Microsoft预览",
      useGooglePreview: "使用Google预览",
      htmlPreview: "HTML预览",
      browserNotSupport: "您的浏览器不支持",
      videoTag: "视频标签",
      audioTag: "音频标签",
    },

    // 上传弹窗
    uploadModal: {
      title: "上传文件",
      uploadMethod: "上传方式:",
      presignedUpload: "预签名直传",
      recommended: "推荐",
      directUpload: "直接上传",
      multipartUpload: "分片上传",
      directMode: "直接模式",
      presignedMode: "直传模式",
      multipartMode: "分片模式",
      directModeDesc: "通过服务器直接上传，不显示进度条，适合小文件",
      presignedModeDesc: "直接上传到存储服务器，避免Worker CPU限制，速度更快",
      multipartModeDesc: "通过服务器分片上传，适合大文件或不稳定网络环境",
      dragDropHere: "拖放文件到这里",
      clickOrDragToUpload: "点击或拖动文件到这里上传",
      multiFileSupport: "支持多文件上传",
      pasteSupport: "支持 Ctrl+V 粘贴文件",
      selectedFiles: "已选择 {count} 个文件",
      clearAll: "清除全部",
      totalProgress: "总进度",
      uploadSpeed: "上传速度:",
      uploading: "正在上传 {current}/{total}: {fileName}",
      cancel: "取消",
      cancelUpload: "取消上传",
      startUpload: "开始上传",
      fileStatus: {
        pending: "待上传",
        uploading: "{progress}%",
        success: "上传成功",
        error: "上传失败",
      },
      cancelSingleUpload: "取消上传",
      retryUpload: "重试",
      removeFile: "移除",
      pasteFileAdded: "已从剪贴板添加文件",
      confirmCancelUpload: "正在上传文件，确定要取消并关闭吗？",
      confirmClearFiles: "确定要清除所有文件吗？",
      noFilesSelected: "请先选择要上传的文件",
      uploadStarted: "开始上传文件...",
      allFilesUploaded: "所有文件上传完成！",
      someFilesFailed: "部分文件上传失败，请检查错误信息",
      uploadCancelled: "上传已取消",
      noFilesToUpload: "没有可上传的文件",
      allFilesUploadFailed: "所有文件上传失败",
      checkFilesValid: "，请检查文件是否有效",
      partialUploadSuccess: "已上传 {success} 个文件，{failed} 个文件失败",
      allFilesUploadSuccess: "已成功上传 {count} 个文件",
      cancelUploadError: "取消上传失败: {message}",
      allUploadsCancelled: "已取消所有文件的上传",
      retryUploadSuccess: "文件 {fileName} 重新上传成功",
      retryUploadFailed: "文件 {fileName} 重新上传失败: {message}",
      retryUploadError: "文件 {fileName} 重新上传错误: {message}",
    },

    // 任务管理
    taskManager: {
      title: "任务管理",
      noTasks: "暂无任务",
      noTasksDescription: "当前没有正在进行或已完成的任务",
      activeTasks: "正在进行的任务 ({count})",
      completedTasks: "已完成的任务 ({count})",
      clearCompleted: "清除已完成",
      cancel: "取消",
      retry: "重试",
      details: "详情",
      hideDetails: "隐藏详情",

      // 任务状态
      status: {
        pending: "待处理",
        running: "运行中",
        completed: "已完成",
        failed: "失败",
        cancelled: "已取消",
      },

      // 任务类型
      types: {
        copy: "复制",
        upload: "上传",
        delete: "删除",
        download: "下载",
      },

      // 任务详情
      progress: "进度: {current}/{total}",
      timeElapsed: "耗时: {time}",
      createdAt: "创建时间: {time}",
      updatedAt: "更新时间: {time}",
      error: "错误: {message}",

      // 任务操作确认
      confirmCancel: "确定要取消这个任务吗？",
      confirmClearCompleted: "确定要清除所有已完成的任务吗？",

      // 任务阶段
      downloading: "下载中",
      uploading: "上传中",
      processing: "处理中",
      currentFile: "当前文件: {fileName}",
      processed: "已处理: {current}/{total}",
      completedAt: "完成时间: {time}",
      processedItems: "处理项目: {current}/{total}",

      // 统计信息
      success: "成功: {count}",
      skipped: "跳过: {count}",
      failed: "失败: {count}",
      partialComplete: "部分完成",

      // 任务类型名称
      copyTask: "复制任务",
      uploadTask: "上传任务",
      deleteTask: "删除任务",
      downloadTask: "下载任务",
      unknownTask: "未知任务",

      // 状态文本
      waiting: "等待中",
      unknown: "未知",

      // 任务创建和启动消息
      copyTaskName: "复制 {count} 个项目到 {path}",
      copyStarted: "开始复制 {count} 个项目到 {path}，可在任务管理中查看进度",
    },

    // 其他消息
    linkCopied: "文件直链已复制到剪贴板",

    // 文件项操作
    fileItem: {
      download: "下载",
      getLink: "获取直链",
      rename: "重命名",
      delete: "删除",
      preview: "预览",
      copy: "复制",
      move: "移动",
      properties: "属性",
    },

    // 文件类型
    fileTypes: {
      folder: "文件夹",
      file: "文件",
      image: "图片",
      video: "视频",
      audio: "音频",
      document: "文档",
      archive: "压缩包",
      code: "代码",
      unknown: "未知类型",
    },

    // 文件大小单位
    sizeUnits: {
      bytes: "字节",
      kb: "KB",
      mb: "MB",
      gb: "GB",
      tb: "TB",
    },
  },

  // 语言选择器
  language: {
    toggle: "切换语言",
    zh: "中文",
    en: "English",
  },

  // Markdown编辑器模块
  markdown: {
    // 主编辑器
    title: "Markdown编辑器",
    switchToMarkdown: "切换到Markdown",
    switchToPlainText: "切换到纯文本",

    // 权限管理
    permissionRequired: "需要管理员权限或有效的API密钥才能创建分享，请",
    loginOrAuth: "登录管理后台或配置API密钥",

    // 编辑器表单
    form: {
      remark: "备注",
      remarkPlaceholder: "为这个分享添加备注（可选）",
      customLink: "自定义链接后缀",
      customLinkPlaceholder: "自定义链接后缀（可选）",
      password: "访问密码",
      passwordPlaceholder: "设置访问密码（可选）",
      expiryTime: "过期时间",
      expiryNever: "永不过期",
      expiryHour: "小时后过期",
      expiryDay: "天后过期",
      expiryWeek: "周后过期",
      expiryMonth: "月后过期",
      maxViews: "最大查看次数",
      maxViewsPlaceholder: "限制查看次数（0为不限制）",
      createShare: "创建分享",
      creating: "创建中...",
    },

    // 分享链接
    shareLink: "分享链接:",
    copyLink: "复制链接",
    copyRawLink: "复制原始文本直链",
    showQRCode: "显示二维码",
    linkCopied: "链接已复制到剪贴板",
    rawLinkCopied: "原始文本直链已复制到剪贴板",
    copyFailed: "复制失败，请手动复制",
    linkExpireIn: "链接将在 {seconds} 秒后隐藏",

    // 二维码弹窗
    qrCodeTitle: "分享二维码",
    qrCodeGenerating: "生成中...",
    qrCodeScanToAccess: "扫描二维码访问分享内容",
    downloadQRCode: "下载二维码",
    qrCodeDownloaded: "二维码已下载",

    // 复制格式菜单
    copyFormats: "复制格式",
    copyAsMarkdown: "复制为Markdown",
    copyAsHTML: "复制为HTML",
    copyAsPlainText: "复制为纯文本",
    exportAsWord: "导出为Word文档",
    exportAsPng: "导出为PNG图片",
    exportDocumentTitle: "Markdown导出文档",
    markdownCopied: "已复制为Markdown格式",
    htmlCopied: "已复制为HTML格式",
    plainTextCopied: "已复制为纯文本格式",

    // 编辑器相关
    editorPlaceholder: "在此输入Markdown内容...",
    plainTextPlaceholder: "在此输入纯文本内容...",

    // 编辑器工具栏
    toolbar: {
      importFile: "导入文件",
      clearContent: "清空内容",
      copyFormats: "复制格式",
    },

    // 状态消息
    messages: {
      noPermission: "没有权限创建分享",
      contentEmpty: "内容不能为空",
      creating: "正在创建分享...",
      createSuccess: "分享创建成功！",
      createFailed: "保存失败",
      linkOccupied: "链接后缀已被占用，请更换其他后缀",
      permissionDenied: "权限不足，无法创建分享",
      contentTooLarge: "内容过大，请减少内容长度",
      unknownError: "未知错误",
      editorNotReady: "编辑器未准备就绪",
      autoSaveFailed: "自动保存失败",
      restoreContentFailed: "恢复内容失败",
      qrCodeGenerateFailed: "生成二维码失败",
      confirmClearContent: "确定要清空所有内容吗？",
      generatingWord: "正在生成Word文档...",
      wordExported: "Word文档已生成并下载",
      wordExportFailed: "导出失败，请稍后重试",
      exportingPng: "正在导出PNG图片...",
      pngExported: "PNG图片已导出并下载",
      pngExportFailed: "导出PNG失败，请稍后重试",
      corsImageError: "由于跨域限制，部分图片可能无法正确显示在导出图片中",
    },

    // 表单验证
    validation: {
      slugInvalid: "链接后缀只能包含字母、数字、连字符和下划线",
      slugTooLong: "链接后缀不能超过50个字符",
      slugReserved: "此链接后缀为系统保留，请使用其他后缀",
    },
  },

  // 文件上传模块
  file: {
    // 页面标题和导航
    uploadPageTitle: "文件上传",

    // 权限管理
    permissionRequired: "需要管理员权限或有效的API密钥才能上传文件，请",
    loginOrAuth: "登录管理后台或配置API密钥",

    // 文件上传器
    uploadTabs: {
      fileUpload: "文件上传",
      urlUpload: "URL直链上传",
    },

    // 拖拽上传区域
    dragDropTitle: "拖拽文件到此处或点击选择",
    dragDropSubtitle: "支持多文件上传",
    dragDropHint: "最大文件大小: {size}",
    selectFiles: "选择文件",
    drag: "拖拽文件到此处",
    select: "拖拽文件到此处或点击选择",
    maxSizeExceeded: "最大文件大小: {size}",
    multipleFilesSupported: "支持多文件上传",

    // 文件选择和管理
    selectedFiles: "已选择 {count} 个文件",
    clearAll: "清空全部",
    pending: "等待中",
    success: "成功",
    error: "失败",
    retry: "重试",
    clearSelected: "移除",
    cancelUpload: "取消上传",

    // 文件信息
    fileName: "文件名",
    fileSize: "大小",
    fileType: "类型",
    password: "密码",
    createdAt: "创建时间",
    actions: "操作",
    remainingViewsLabel: "剩余次数",
    unlimited: "无限制",
    usedUp: "已用完",
    unknownSize: "未知大小",

    // 表单字段
    form: {
      s3Config: "存储配置",
      selectS3Config: "选择存储配置",
      customSlug: "自定义链接",
      customSlugPlaceholder: "自定义文件访问链接（可选）",
      path: "存储路径",
      pathPlaceholder: "文件存储路径（可选）",
      remark: "备注",
      remarkPlaceholder: "为文件添加备注（可选）",
      password: "访问密码",
      passwordPlaceholder: "设置访问密码（可选）",
      expiryTime: "过期时间",
      expiryNever: "永不过期",
      expiryHour: "小时后过期",
      expiryDay: "天后过期",
      expiryWeek: "周后过期",
      expiryMonth: "月后过期",
      maxViews: "最大查看次数",
      maxViewsPlaceholder: "限制查看次数（0为不限制）",
      uploadButton: "开始上传",
      uploading: "上传中...",
      cancelUpload: "取消上传",
    },

    // 存储和设置
    storage: "存储配置",
    selectStorage: "选择存储配置",
    noStorage: "暂无可用存储配置",
    path: "存储路径",
    pathPlaceholder: "文件存储路径（可选）",
    shareSettings: "分享设置",
    remark: "备注",
    remarkPlaceholder: "为文件添加备注（可选）",
    customLink: "自定义链接",
    customLinkPlaceholder: "自定义文件访问链接（可选）",
    passwordProtection: "密码保护",
    passwordPlaceholder: "设置访问密码（可选）",
    expireTime: "过期时间",
    maxViews: "最大查看次数",
    maxViewsPlaceholder: "限制查看次数（0为不限制）",
    onlyAllowedChars: "只能包含字母、数字、连字符和下划线",

    // 过期时间选项
    expireOptions: {
      hour1: "1小时后过期",
      day1: "1天后过期",
      day7: "7天后过期",
      day30: "30天后过期",
      never: "永不过期",
    },

    // 按钮和操作
    upload: "开始上传",
    loading: "上传中...",
    cancel: "取消",

    // URL上传
    urlUpload: {
      urlInput: "文件URL",
      urlInputPlaceholder: "输入要上传的文件URL地址",
      analyzeUrl: "分析URL",
      analyzing: "分析中...",
      customFilename: "自定义文件名",
      customFilenamePlaceholder: "自定义文件名（可选）",
      filePreview: "文件预览",
      uploadFromUrl: "从URL上传",
      urlUpload: "URL上传",
      urlAnalysisComplete: "URL分析完成",
      retryAnalysis: "重新分析",
    },

    // URL上传界面
    enterUrl: "输入文件URL地址",
    supportedUrlTypes: "支持HTTP和HTTPS链接",
    urlPlaceholder: "输入要上传的文件URL地址",
    analyze: "分析",
    analyzing: "分析中...",
    urlFileInfo: "文件信息",
    clear: "清除",
    customFileName: "自定义文件名",
    customFilename: "自定义文件名（可选）",

    // 上传方式
    uploadMethod: "上传方式",
    presignedUpload: "预签名上传",
    multipartUpload: "分片上传",
    presignedUploadDesc: "预签名URL直传到存储",
    multipartUploadDesc: "分片直传到存储",

    // 上传阶段
    starting: "准备中...",
    downloading: "下载中...",
    downloadingProxy: "代理下载中...",
    preparing: "准备中...",
    initializing: "初始化...",
    uploading: "上传中...",
    finalizing: "完成中...",
    completed: "已完成",
    cancelled: "已取消",

    // 文件列表
    recentUploads: "最近上传",
    showingRecent: "显示最近3条记录",
    noFiles: "暂无文件",
    noFilesUploaded: "暂无上传文件",
    uploadToShow: "上传文件后将在此显示",
    loading: "加载中...",

    // 文件操作
    open: "打开",
    delete: "删除",
    qrCode: "二维码",
    encrypted: "已加密",
    noPassword: "无密码",
    fileQrCode: "文件二维码",
    deleting: "删除中...",
    confirmDeleteBtn: "确认删除",
    deletedSuccess: "文件删除成功",
    qrCodeDownloadSuccess: "二维码下载成功",
    noValidLink: "无有效链接",
    cannotGetProxyLink: "无法获取代理链接",
    copyPermanentLinkFailed: "复制永久链接失败",
    getPasswordFromSessionError: "从会话存储获取密码失败",

    // 文件操作
    copyLink: "复制链接",
    copyDirectLink: "复制直链",
    downloadFile: "下载文件",
    deleteFile: "删除文件",
    showQRCode: "显示二维码",
    downloadQrCode: "下载二维码",

    // 状态消息
    uploadSuccessful: "文件上传成功",
    urlUploadSuccess: "URL文件上传成功",
    multipleUploadsSuccessful: "成功上传 {count} 个文件",
    retrySuccessful: "重试上传成功",
    allSlugConflicts: "所有文件的链接后缀都已被占用，请更换其他后缀",
    allPermissionErrors: "没有权限使用此存储配置",
    allUploadsFailed: "所有文件上传失败",
    someSlugConflicts: "{count} 个文件的链接后缀已被占用",
    someUploadsFailed: "{count} 个文件上传失败",
    singleFileCancelMessage: "文件上传已取消",
    insufficientStorageDetailed: "存储空间不足：文件大小({fileSize})超过剩余空间({remainingSpace})，总容量限制为{totalCapacity}",
    linkCopied: "链接已复制到剪贴板",
    directLinkCopied: "直链已复制到剪贴板",
    copyFailed: "复制失败，请手动复制",
    qrCodeDownloaded: "二维码已下载",

    // 错误消息
    messages: {
      noS3Config: "请选择存储配置",
      noFilesSelected: "请选择要上传的文件",
      fileTooLarge: "文件大小超过限制",
      uploadFailed: "上传失败",
      uploadCancelled: "上传已取消",
      deleteFailed: "删除失败",
      getFileDetailFailed: "获取文件详情失败",
      cannotGetDirectLink: "无法获取直链，请稍后重试",
      invalidUrl: "请输入有效的URL地址",
      urlAnalysisFailed: "URL分析失败",
      negativeMaxViews: "最大查看次数不能为负数",
      getPresignedUrlFailed: "获取预签名URL失败",
      slugInvalid: "自定义链接只能包含字母、数字、连字符和下划线",
      slugTooLong: "自定义链接不能超过50个字符",
      slugReserved: "此链接为系统保留，请使用其他链接",
      slugConflict: "链接后缀已被占用，请更换其他后缀",
      permissionError: "没有权限使用此存储配置",
      initMultipartUploadFailed: "初始化分片上传失败",
      uploadCancelled: "上传已取消",
      networkError: "网络错误，请检查网络连接",
      serverError: "服务器错误，请稍后重试",
      unknownError: "未知错误",
    },

    // 确认对话框
    confirmDelete: "确认删除",
    confirmDeleteMessage: "确定要删除这个文件吗？此操作不可撤销。",
    confirm: "确认",
    cancel: "取消",

    // 二维码弹窗
    qrCodeTitle: "文件二维码",
    qrCodeGenerating: "生成中...",
    qrCodeScanToAccess: "扫描二维码访问文件",

    // 上传进度
    uploadProgress: "上传进度",
    uploadSpeed: "上传速度",
    uploadStage: {
      starting: "准备上传...",
      initializing: "初始化...",
      uploading: "上传中...",
      processing: "处理中...",
      completing: "完成中...",
      completed: "上传完成",
    },
  },
};
