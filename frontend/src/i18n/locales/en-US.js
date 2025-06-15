export default {
  // Common
  common: {
    unknown: "Unknown",
    loading: "Loading...",
    confirm: "Confirm",

    // Pagination component
    pagination: {
      // Mobile
      previousPage: "Previous",
      nextPage: "Next",
      pageInfo: "{current}/{total}",

      // Desktop
      showingRange: "Showing {start} to {end} of {total} results",
      firstPage: "First Page",
      lastPage: "Last Page",

      // Accessibility text
      ariaLabel: "Pagination Navigation",
      srFirstPage: "First Page",
      srPreviousPage: "Previous Page",
      srNextPage: "Next Page",
      srLastPage: "Last Page",
    },

    // Error toast component
    errorToast: {
      defaultTitle: "Operation Failed",
      close: "Close",
      srClose: "Close",
    },
  },

  // App title
  app: {
    title: "CloudPaste",
  },

  // Page titles
  pageTitle: {
    home: "CloudPaste - Online Clipboard",
    upload: "File Upload - CloudPaste",
    admin: "Admin Panel - CloudPaste",
    pasteView: "View Share - CloudPaste",
    fileView: "File Preview - CloudPaste",
    mountExplorer: "Mount Explorer - CloudPaste",
    notFound: "Page Not Found - CloudPaste",
    // Admin module titles
    adminModules: {
      dashboard: "Dashboard",
      textManagement: "Text Management",
      fileManagement: "File Management",
      storageConfig: "S3 Storage Config",
      mountManagement: "Mount Management",
      keyManagement: "Key Management",
      settings: "System Settings",
    },
  },

  // Navigation
  nav: {
    home: "Home",
    upload: "File Upload",
    mountExplorer: "Mount Explorer",
    admin: "Admin Panel",
    menu: "Main Menu",
  },

  // Theme toggle
  theme: {
    toggle: "Toggle theme",
    light: "Light mode",
    dark: "Dark mode",
    auto: "Auto mode",
  },

  // Footer copyright
  footer: {
    copyright: "© {year} CloudPaste. All rights reserved.",
  },

  // Breadcrumb navigation
  breadcrumb: {
    navigation: "Breadcrumb Navigation",
    root: "Root Directory",
    batchOperations: "Batch Operations",
    enableSelection: "Enable Selection",
    exitSelection: "Exit Selection",
    copySelected: "Copy Selected",
    deleteSelected: "Delete Selected",
    selectedCount: "({count})",
  },

  // Admin panel
  admin: {
    title: {
      admin: "Admin Panel",
      user: "User Panel",
    },
    sidebar: {
      dashboard: "Dashboard",
      textManagement: "Text Management",
      fileManagement: "File Management",
      storageConfig: "S3 Storage Config",
      mountManagement: "Mount Management",
      keyManagement: "Key Management",
      settings: "System Settings",
      logout: "Logout",
      logoutAuth: "Logout Auth",
      openMenu: "Open Menu",
      closeMenu: "Close Menu",
      menuTitle: {
        admin: "Admin Panel",
        user: "User Panel",
      },
    },
    permissionDenied: {
      title: "Permission Denied",
      message: "You don't have permission to access this feature.",
      suggestion: "Please contact the administrator for appropriate permissions.",
    },

    // Login panel
    login: {
      // Titles
      adminLogin: "Admin Login",
      apiKeyAuth: "API Key Authentication",

      // Form fields
      username: "Username",
      password: "Password",
      apiKey: "API Key",

      // Buttons
      loginButton: "Login",
      loggingIn: "Logging in...",
      useApiKey: "Use API Key Login",
      useAdminAccount: "Use Admin Account Login",

      // Input validation
      inputRequired: {
        usernamePassword: "Please enter username and password",
        apiKey: "Please enter API key",
      },

      // Error messages
      errors: {
        invalidToken: "Invalid login token",
        invalidCredentials: "Invalid username or password",
        loginFailed: "Login failed",
        invalidResponse: "Invalid server response format",
        serverError: "Server error",
        keyValidationFailed: "API key validation failed",
        permissionInfo: "Unable to get permission information",
        invalidApiKey: "Invalid or unauthorized API key",
        insufficientPermissions: "Insufficient API key permissions",
      },
    },

    // System Settings
    settings: {
      title: "System Settings",
      description: "Manage system configuration and administrator account information",

      // Upload Settings
      uploadSettings: {
        title: "Upload Limit Settings",
        description: "Configure file upload size limits and WebDAV upload mode",
        maxUploadSizeLabel: "Maximum Upload File Size",
        maxUploadSizePlaceholder: "Enter number",
        maxUploadSizeHint: "Set the maximum upload size limit for individual files",
        unitKB: "KB",
        unitMB: "MB",
        unitGB: "GB",
        footerHint: "Changes will take effect immediately and affect all users' file uploads",
      },

      // WebDAV Settings
      webdavSettings: {
        uploadModeLabel: "WebDAV Upload Mode",
        uploadModeHint: "Select the upload handling method for WebDAV clients",
        modes: {
          auto: "Auto Mode (Recommended)",
          proxy: "Presigned Upload",
          multipart: "Multipart Upload",
          direct: "Direct Upload",
        },
      },

      // Admin Settings
      adminSettings: {
        title: "Administrator Information Modification",
        description: "Modify administrator username and password",
        newUsernameLabel: "New Username",
        newUsernamePlaceholder: "Enter new username",
        newUsernameHint: "Leave blank to keep current username",
        currentPasswordLabel: "Current Password",
        currentPasswordPlaceholder: "Enter current password",
        currentPasswordHint: "Current password required for identity verification",
        newPasswordLabel: "New Password",
        newPasswordPlaceholder: "Enter new password",
        newPasswordHint: "Leave blank to keep current password",
        footerHint: "You will be automatically logged out after modification and need to log in again",
      },

      // Status Messages
      status: {
        success: "Settings updated successfully",
        processing: "Processing...",
        updateSettings: "Update Settings",
        updateAccount: "Update Account",
        adminUpdateSuccess: "Administrator information updated successfully, logging out automatically",

        // Error Messages
        errors: {
          maxUploadSizeError: "Maximum upload size must be greater than 0",
          updateSettingsError: "Failed to update system settings",
          currentPasswordRequired: "Please enter current password",
          newFieldRequired: "Please fill in at least one of new username or new password",
          passwordSame: "New password cannot be the same as current password",
          updateInfoError: "Failed to update administrator information",
        },
      },
    },

    // Key Management
    keyManagement: {
      title: "API Key Management",
      refresh: "Refresh",
      bulkDelete: "Bulk Delete",
      delete: "Delete",
      create: "Create New Key",
      createShort: "Create",
      lastRefreshed: "Last Refreshed",

      // Table column headers
      table: {
        select: "Select",
        name: "Name",
        key: "Key",
        permissions: "Permissions",
        basicPath: "Basic Path",
        expires: "Expires",
        lastUsed: "Last Used",
        actions: "Actions",
        noData: "No API keys available",
        loading: "Loading...",
      },

      // Table field names (for compatibility)
      keyName: "Name",
      key: "Key",
      permissions: "Permissions",
      permissionsColumn: "Permissions",
      basicPath: "Basic Path",
      createdAt: "Created At",
      expiresAt: "Expires At",
      lastUsed: "Last Used",
      actions: "Actions",
      loading: "Loading...",
      loadingKeys: "Loading keys...",
      neverUsed: "Never Used",

      // Empty state
      noKeysTitle: "No API Keys",
      noKeysDescription: "You haven't created any API keys yet. Click the button above to create your first key.",

      // Permission labels
      textPermissionFull: "Text",
      filePermissionFull: "File",
      mountPermissionFull: "Mount",
      noPermission: "No Permission",

      // Permission display
      permissions: {
        text: "Text",
        file: "File",
        mount: "Mount",
        readOnly: "Read Only",
        none: "None",
      },

      // Action buttons
      copyKey: "Copy",
      copyKeyFull: "Copy Full Key",
      edit: "Edit",
      deleteKey: "Delete",
      neverExpires: "Never Expires",

      // Create key modal
      createModal: {
        title: "Create New API Key",
        tabs: {
          basic: "Basic Information",
          path: "Path Selection",
        },
        keyName: "Key Name",
        keyNamePlaceholder: "Enter key name",
        keyNameHelp: "Set an easily recognizable name for your API key",
        useCustomKey: "Use Custom Key",
        customKey: "Custom Key",
        customKeyPlaceholder: "Enter custom key (optional)",
        customKeyHelp: "Only letters, numbers, underscores and hyphens allowed",
        expiration: "Expiration",
        expirationOptions: {
          "1d": "1 Day",
          "7d": "7 Days",
          "30d": "30 Days",
          never: "Never Expires",
          custom: "Custom",
        },
        customExpiration: "Custom Expiration Time",
        customExpirationPlaceholder: "Enter number of days",
        permissions: "Permission Settings",
        permissions: {
          text: "Text Permission",
          file: "File Permission",
          mount: "Mount Permission",
        },
        textPermission: "Text Permission",
        filePermission: "File Permission",
        mountPermission: "Mount Permission",
        readOnlyMount: "Read-only Mount",
        basicPath: "Basic Path",
        basicPathPlaceholder: "/",
        basicPathHelp: "Set the basic path that the API key can access, defaults to root path",
        selectPath: "Select Path",
        securityTip: "Security Tip",
        securityMessage: "Please keep your API key safe and do not use it in public places or insecure environments.",
        pathSelector: {
          title: "Select Basic Path",
          rootDirectory: "Root Directory",
          selectDirectory: "Select Directory",
          currentPath: "Current Selection",
          confirm: "Confirm Path",
          cancel: "Cancel",
          loading: "Loading...",
          loadError: "Load Failed",
          noDirectories: "No subdirectories in this directory",
        },
        create: "Create",
        creating: "Creating...",
        processing: "Creating...",
        cancel: "Cancel",

        // Error messages
        errors: {
          nameRequired: "Key name cannot be empty",
          customKeyRequired: "Custom key cannot be empty",
          customKeyFormat: "Custom key format is incorrect, only letters, numbers, underscores and hyphens allowed",
          expirationRequired: "Custom expiration time cannot be empty",
          invalidExpiration: "Invalid expiration time",
          createFailed: "Failed to create key",
        },
      },

      // Edit key modal
      editModal: {
        title: "Edit API Key",
        tabs: {
          basic: "Basic Information",
          path: "Path Selection",
        },
        keyName: "Key Name",
        keyNamePlaceholder: "Enter key name",
        keyNameHelp: "Set an easily recognizable name for your API key",
        expiration: "Expiration",
        expirationOptions: {
          "1d": "1 Day",
          "7d": "7 Days",
          "30d": "30 Days",
          never: "Never Expires",
          custom: "Custom",
        },
        customExpiration: "Custom Expiration Time",
        customExpirationPlaceholder: "Enter number of days",
        permissions: "Permission Settings",
        permissions: {
          text: "Text Permission",
          file: "File Permission",
          mount: "Mount Permission",
        },
        textPermission: "Text Permission",
        filePermission: "File Permission",
        mountPermission: "Mount Permission",
        basicPath: "Basic Path",
        basicPathPlaceholder: "/",
        basicPathHelp: "Set the basic path that the API key can access, defaults to root path",
        selectPath: "Select Path",
        securityTip: "Security Tip",
        securityMessage: "Please keep your API key safe and do not use it in public places or insecure environments.",
        pathSelector: {
          title: "Select Basic Path",
          rootDirectory: "Root Directory",
          selectDirectory: "Select Directory",
          currentPath: "Current Selection",
          confirm: "Confirm Path",
          cancel: "Cancel",
          loading: "Loading...",
          loadError: "Load Failed",
          noDirectories: "No subdirectories in this directory",
        },
        update: "Update",
        updating: "Updating...",
        processing: "Updating...",
        cancel: "Cancel",

        // Error messages
        errors: {
          nameRequired: "Key name cannot be empty",
          expirationRequired: "Custom expiration time cannot be empty",
          invalidExpiration: "Invalid expiration time",
          updateFailed: "Failed to update key",
        },
      },

      // Success messages
      success: {
        created: "API key created successfully",
        createdAndCopied: "Key created and copied to clipboard",
        updated: "API key updated successfully",
        deleted: "API key deleted successfully",
        bulkDeleted: "Bulk delete successful, deleted {count} keys",
        copied: "Key copied to clipboard",
      },

      // Error messages
      error: {
        cannotLoadList: "Cannot load key list",
        loadFailed: "Failed to load API keys",
        copyFailed: "Failed to copy to clipboard",
        deleteFailed: "Failed to delete key",
        bulkDeleteFailed: "Bulk delete failed",
        noKeysSelected: "Please select keys to delete",
      },

      // Confirmation dialogs
      confirmDelete: 'Are you sure you want to delete key "{name}"? This action cannot be undone.',
      confirmBulkDelete: "Are you sure you want to delete the selected {count} keys? This action cannot be undone.",
      selectKeysFirst: "Please select keys to delete first",
      bulkDeleteConfirm: "Are you sure you want to delete the selected {count} keys? This action cannot be undone.",
    },

    // Mount Management
    mount: {
      // Page title and actions
      title: "Mount Management",
      accessibleMounts: "Accessible Mount Points",
      createMount: "Create Mount Point",
      editMount: "Edit Mount Point",
      refresh: "Refresh",
      refreshing: "Refreshing...",
      search: "Search mount points...",

      // Mount point status
      status: {
        active: "Active",
        inactive: "Inactive",
        enabled: "Enabled",
        disabled: "Disabled",
      },

      // Mount point information
      info: {
        name: "Mount Name",
        path: "Mount Path",
        storageType: "Storage Type",
        storageConfig: "Storage Config",
        remark: "Remark",
        sortOrder: "Sort Order",
        cacheTtl: "Cache TTL",
        createdBy: "Created By",
        createdAt: "Created At",
        updatedAt: "Updated At",
        lastRefresh: "Last Refresh",
      },

      // Form fields
      form: {
        name: "Mount Point Name",
        namePlaceholder: "Enter mount point name",
        nameHint: "Name to identify the mount point",

        storageType: "Storage Type",
        storageTypeHint: "Select storage backend type",

        storageConfig: "Storage Configuration",
        storageConfigPlaceholder: "Select storage configuration",
        storageConfigHint: "Choose the S3 storage configuration to use",

        mountPath: "Mount Path",
        mountPathPlaceholder: "Enter mount path",
        mountPathHint: "Path in storage, leave empty for root directory",

        remark: "Remark",
        remarkPlaceholder: "Enter remark information",
        remarkHint: "Optional description",

        sortOrder: "Sort Order",
        sortOrderHint: "Lower numbers appear first",

        cacheTtl: "Cache TTL (seconds)",
        cacheTtlHint: "File list cache time, 0 means no cache",

        isActive: "Active Status",
        isActiveHint: "Whether to enable this mount point",

        // S3 configuration related
        s3Config: "S3 Storage Configuration",
        selectS3Config: "Please select S3 storage configuration",
        noS3Config: "No S3 storage configurations available",

        // Storage type options
        storageTypes: {
          s3: "S3 Storage",
        },

        // Placeholders
        cacheTtlPlaceholder: "Default 300 seconds",
        sortOrderPlaceholder: "0",

        // Buttons
        save: "Save",
        saving: "Saving...",
        cancel: "Cancel",
        create: "Create",
        creating: "Creating...",
        update: "Update",
        updating: "Updating...",
      },

      // Action buttons
      actions: {
        edit: "Edit",
        delete: "Delete",
        enable: "Enable",
        disable: "Disable",
        view: "View",
        browse: "Browse",
      },

      // Confirm dialog
      confirmDelete: {
        title: "Confirm Delete",
        message: 'Are you sure you want to delete mount point "{name}"? This action cannot be undone.',
        confirm: "Delete",
        cancel: "Cancel",
      },

      // Success messages
      success: {
        created: "Mount point created successfully",
        updated: "Mount point updated successfully",
        deleted: "Mount point deleted successfully",
        enabled: "Mount point enabled successfully",
        disabled: "Mount point disabled successfully",
        refreshed: "Data refreshed successfully",
      },

      // Error messages
      error: {
        loadFailed: "Failed to load mount point list",
        createFailed: "Failed to create mount point",
        updateFailed: "Failed to update mount point",
        deleteFailed: "Failed to delete mount point",
        enableFailed: "Failed to enable mount point",
        disableFailed: "Failed to disable mount point",
        loadS3ConfigsFailed: "Failed to load S3 configurations",
        loadApiKeysFailed: "Failed to load API key list",
        noPermission: "No permission to perform this action",
        apiKeyNoPermission: "API key users have no permission to modify mount point status",
        apiKeyCannotDelete: "API key users have no permission to delete mount points",
        apiKeyCannotCreate: "API key users have no permission to create mount points",
        apiKeyCannotManage: "API key users have no permission to manage mount points",
        saveFailed: "Save failed",
      },

      // Validation errors
      validation: {
        nameRequired: "Mount point name is required",
        nameMinLength: "Mount point name must be at least 2 characters",
        nameMaxLength: "Mount point name cannot exceed 50 characters",
        storageConfigRequired: "Please select a storage configuration",
        mountPathInvalid: "Mount path format is invalid",
        sortOrderInvalid: "Sort order must be a non-negative integer",
        cacheTtlInvalid: "Cache TTL must be a non-negative integer",
      },

      // Empty state
      empty: {
        title: "No Mount Points",
        description: "No mount points have been created yet",
        createFirst: "Create the first mount point",
      },

      // Search results
      searchResults: {
        noResults: "No matching mount points found",
        found: "Found {count} mount points",
        clearSearch: "Clear Search",
        tryDifferentTerms: "Try using different search terms",
      },

      // Creator types
      creators: {
        system: "System",
        admin: "Admin",
        apiKey: "API Key",
      },

      // Others
      currentApiKey: "Current Key",
      unknownCreator: "Unknown Creator",
      noRemark: "No remark",
      unlimited: "Unlimited",
      seconds: "seconds",
    },
  },

  // Dashboard
  dashboard: {
    // Page title and actions
    systemOverview: "System Overview",
    refresh: "Refresh",
    refreshing: "Refreshing...",

    // Statistics cards
    totalPastes: "Text Shares",
    totalFiles: "File Uploads",
    totalApiKeys: "API Keys",
    totalS3Configs: "Storage Configs",

    // Storage related
    storageUsage: "Storage Usage",
    allBuckets: "All Buckets",
    usedStorage: "Used",
    totalStorage: "Total",
    usagePercent: "Usage",
    selectBucket: "Select Bucket",

    // Activity statistics
    activityOverview: "Activity Overview",
    weeklyActivity: "Last 7 Days Activity",
    totalWeekPastes: "This Week Texts",
    totalWeekFiles: "This Week Files",
    weeklyPastes: "This Week Texts",
    weeklyFiles: "This Week Files",
    mostActiveDate: "Most Active Date",
    highestDailyActivity: "Highest Daily Activity",
    items: "items",

    // Storage bucket distribution
    storageBucketDistribution: "Storage Bucket Distribution",
    otherStorage: "Other Storage",

    // Chart toggle
    switchToLineChart: "Switch to Line Chart",
    switchToBarChart: "Switch to Bar Chart",

    // System information
    serverEnvironment: "Server Environment",
    dataStorage: "Data Storage",

    // Chart related
    chartType: "Chart Type",
    barChart: "Bar Chart",
    lineChart: "Line Chart",
    toggleChart: "Toggle Chart Type",

    // Errors and status
    fetchError: "Failed to fetch data, please try again later",
    loadingData: "Loading data...",
    noData: "No data available",

    // Time related
    lastUpdated: "Last Updated",

    // Storage units
    storageUnits: {
      bytes: "Bytes",
      kb: "KB",
      mb: "MB",
      gb: "GB",
      tb: "TB",
    },
  },

  // Mount Explorer
  mount: {
    title: "Mount Explorer",
    permissionRequired: "Admin privileges or a valid API key are required to access mount explorer, please",
    loginAuth: "login to admin panel or configure API key",
    cancel: "Cancel",
    backToFileList: "Back to File List",

    // Permission hints
    noPermissionForPath: "You don't have permission to access this directory. You can only access {path} and its subdirectories.",

    // Batch delete dialog
    batchDelete: {
      title: "Confirm Batch Delete",
      message: "Are you sure you want to delete the selected {count} items? This action cannot be undone.",
      selectedItems: "Selected items:",
      folder: "(Folder)",
      moreItems: "... and {count} more items",
      confirmButton: "Delete",
      cancelButton: "Cancel",
    },

    // File operations
    operations: {
      upload: "Upload",
      createFolder: "Create Folder",
      refresh: "Refresh",
      viewMode: "View Mode",
      batchOperations: "Batch Operations",
      tasks: "Task Management",
    },

    // Create folder dialog
    createFolder: {
      enterName: "Please enter folder name",
      folderName: "Folder Name",
      placeholder: "New Folder",
      cancel: "Cancel",
      create: "Create",
    },

    // View modes
    viewModes: {
      list: "List View",
      grid: "Grid View",
    },

    // File list
    fileList: {
      loading: "Loading...",
      empty: "This directory is empty",
      noMountPoints: "No mount points available",
      name: "Name",
      size: "Size",
      modifiedTime: "Modified Time",
      type: "Type",
      actions: "Actions",
      selectAll: "Select All",
      deselectAll: "Deselect All",
    },

    // Rename dialog
    rename: {
      title: "Rename",
      enterNewName: "Please enter new name",
      newName: "New Name",
      cancel: "Cancel",
      confirm: "Confirm",
    },

    // Delete confirmation dialog
    delete: {
      title: "Confirm Delete",
      message: "Are you sure you want to delete {type} {name}?",
      folderWarning: "This operation will delete the folder and all its contents.",
      cancel: "Cancel",
      confirm: "Delete",
    },

    // Operation messages
    messages: {
      apiKeyInfoUpdated: "API key information updated",
      refreshSuccess: "Refresh successful",
      refreshFailed: "Refresh failed, please try again",
      getDirectoryContentFailed: "Failed to get directory content: {message}",
      getDirectoryContentFailedUnknown: "Failed to get directory content: {message}",
      fileUploadSuccess: "File upload successful",
      fileUploadFailed: "File upload failed: {message}",
      fileUploadFailedUnknown: "File upload failed: {message}",
      uploadCancelling: "Cancelling upload...",
      folderCreateSuccess: "Folder created successfully",
      folderCreateFailed: "Folder creation failed: {message}",
      folderCreateFailedUnknown: "Folder creation failed: {message}",
      renameSuccess: "{type} renamed successfully",
      renameFailed: "Rename failed: {message}",
      renameFailedUnknown: "Rename failed: {message}",
      deleteSuccess: "{type} deleted successfully",
      deleteFailed: "Delete failed: {message}",
      deleteFailedUnknown: "Delete failed: {message}",
      downloadPreparing: "Preparing to download file...",
      downloadSuccess: "File download successful",
      downloadFailed: "File download failed: {message}",
      downloadFailedUnknown: "File download failed: {message}",
      previewLoadFailed: "Failed to load file preview: {message}",
      previewLoadFailedUnknown: "Failed to load file preview: {message}",
      previewError: "File preview loading failed",
      uploadError: "Upload failed: {message}",
      uploadErrorUnknown: "Upload failed: {message}",
      batchDeleteInProgress: "Deleting selected items...",
      batchDeletePartialSuccess: "Delete operation partially successful, {success} succeeded, {failed} failed",
      batchDeleteSuccess: "Successfully deleted {count} items",
      batchDeleteFailed: "Batch delete failed: {message}",
      batchDeleteFailedUnknown: "Batch delete failed: {message}",
      copySuccess: "{message}",
      copyFailed: "Copy failed: {message}",
    },

    // File preview
    filePreview: {
      downloadFile: "Download File",
      directPreview: "Direct Preview",
      generating: "Generating...",
      fileSize: "File Size:",
      modifiedTime: "Modified Time:",
      fileType: "File Type:",
      unknown: "Unknown",
      editMode: "Edit",
      previewMode: "Preview",
      saving: "Saving...",
      save: "Save",
      cancel: "Cancel",
      language: "Language:",
      autoDetect: "Auto Detect",
      configFile: "Config File",
      loadingPreview: "Loading Office preview...",
      previewError: "Failed to load file preview",
      retryLoad: "Please try reloading or download the file to view",
      retry: "Retry",
      cannotPreview: "File cannot be previewed",
      downloadToView: "Current file type does not support online preview, please click download button to download and view",
      wordPreview: "Word Document Preview",
      excelPreview: "Excel Spreadsheet Preview",
      powerpointPreview: "PowerPoint Presentation Preview",
      exitFullscreen: "Exit Fullscreen",
      fullscreen: "Fullscreen",
      useMicrosoftPreview: "Use Microsoft Preview",
      useGooglePreview: "Use Google Preview",
      htmlPreview: "HTML Preview",
      browserNotSupport: "Your browser does not support",
      videoTag: "video tag",
      audioTag: "audio tag",
    },

    // Upload modal
    uploadModal: {
      title: "Upload Files",
      uploadMethod: "Upload Method:",
      presignedUpload: "Presigned Direct Upload",
      recommended: "Recommended",
      directUpload: "Direct Upload",
      multipartUpload: "Multipart Upload",
      directMode: "Direct Mode",
      presignedMode: "Presigned Mode",
      multipartMode: "Multipart Mode",
      directModeDesc: "Upload directly through server, no progress bar, suitable for small files",
      presignedModeDesc: "Upload directly to storage server, avoid Worker CPU limits, faster speed",
      multipartModeDesc: "Upload through server in chunks, suitable for large files or unstable network",
      dragDropHere: "Drop files here",
      clickOrDragToUpload: "Click or drag files here to upload",
      multiFileSupport: "Multi-file upload supported",
      pasteSupport: "Support Ctrl+V paste files",
      selectedFiles: "Selected {count} files",
      clearAll: "Clear All",
      totalProgress: "Total Progress",
      uploadSpeed: "Upload Speed:",
      uploading: "Uploading {current}/{total}: {fileName}",
      cancel: "Cancel",
      cancelUpload: "Cancel Upload",
      startUpload: "Start Upload",
      fileStatus: {
        pending: "Pending",
        uploading: "{progress}%",
        success: "Upload Success",
        error: "Upload Failed",
      },
      cancelSingleUpload: "Cancel Upload",
      retryUpload: "Retry",
      removeFile: "Remove",
      pasteFileAdded: "Files added from clipboard",
      confirmCancelUpload: "Files are being uploaded, are you sure you want to cancel and close?",
      confirmClearFiles: "Are you sure you want to clear all files?",
      noFilesSelected: "Please select files to upload first",
      uploadStarted: "Starting file upload...",
      allFilesUploaded: "All files uploaded successfully!",
      someFilesFailed: "Some files failed to upload, please check error messages",
      uploadCancelled: "Upload cancelled",
      noFilesToUpload: "No files to upload",
      allFilesUploadFailed: "All files upload failed",
      checkFilesValid: ", please check if files are valid",
      partialUploadSuccess: "Uploaded {success} files, {failed} files failed",
      allFilesUploadSuccess: "Successfully uploaded {count} files",
      cancelUploadError: "Cancel upload failed: {message}",
      allUploadsCancelled: "Cancelled all file uploads",
      retryUploadSuccess: "File {fileName} retry upload successful",
      retryUploadFailed: "File {fileName} retry upload failed: {message}",
      retryUploadError: "File {fileName} retry upload error: {message}",
    },

    // Task Manager
    taskManager: {
      title: "Task Manager",
      noTasks: "No tasks",
      noTasksDescription: "No active or completed tasks currently",
      activeTasks: "Active tasks ({count})",
      completedTasks: "Completed tasks ({count})",
      clearCompleted: "Clear Completed",
      cancel: "Cancel",
      retry: "Retry",
      details: "Details",
      hideDetails: "Hide Details",

      // Task status
      status: {
        pending: "Pending",
        running: "Running",
        completed: "Completed",
        failed: "Failed",
        cancelled: "Cancelled",
      },

      // Task types
      types: {
        copy: "Copy",
        upload: "Upload",
        delete: "Delete",
        download: "Download",
      },

      // Task details
      progress: "Progress: {current}/{total}",
      timeElapsed: "Time elapsed: {time}",
      createdAt: "Created at: {time}",
      updatedAt: "Updated at: {time}",
      error: "Error: {message}",

      // Task operation confirmations
      confirmCancel: "Are you sure you want to cancel this task?",
      confirmClearCompleted: "Are you sure you want to clear all completed tasks?",

      // Task phases
      downloading: "Downloading",
      uploading: "Uploading",
      processing: "Processing",
      currentFile: "Current file: {fileName}",
      processed: "Processed: {current}/{total}",
      completedAt: "Completed at: {time}",
      processedItems: "Processed items: {current}/{total}",

      // Statistics
      success: "Success: {count}",
      skipped: "Skipped: {count}",
      failed: "Failed: {count}",
      partialComplete: "Partial Complete",

      // Task type names
      copyTask: "Copy Task",
      uploadTask: "Upload Task",
      deleteTask: "Delete Task",
      downloadTask: "Download Task",
      unknownTask: "Unknown Task",

      // Status text
      waiting: "Waiting",
      unknown: "Unknown",

      // Task creation and start messages
      copyTaskName: "Copy {count} items to {path}",
      copyStarted: "Started copying {count} items to {path}, check progress in task manager",
    },

    // Other messages
    linkCopied: "File direct link copied to clipboard",

    // File item operations
    fileItem: {
      download: "Download",
      getLink: "Get Direct Link",
      rename: "Rename",
      delete: "Delete",
      preview: "Preview",
      copy: "Copy",
      move: "Move",
      properties: "Properties",
    },

    // File types
    fileTypes: {
      folder: "Folder",
      file: "File",
      image: "Image",
      video: "Video",
      audio: "Audio",
      document: "Document",
      archive: "Archive",
      code: "Code",
      unknown: "Unknown Type",
    },

    // File size units
    sizeUnits: {
      bytes: "Bytes",
      kb: "KB",
      mb: "MB",
      gb: "GB",
      tb: "TB",
    },
  },

  // Language selector
  language: {
    toggle: "Toggle language",
    zh: "中文",
    en: "English",
  },

  // Markdown editor module
  markdown: {
    // Main editor
    title: "Markdown Editor",
    switchToMarkdown: "Switch to Markdown",
    switchToPlainText: "Switch to Plain Text",

    // Permission management
    permissionRequired: "Admin privileges or a valid API key are required to create shares, please",
    loginOrAuth: "login to admin panel or configure API key",

    // Editor form
    form: {
      remark: "Remark",
      remarkPlaceholder: "Add a remark for this share (optional)",
      customLink: "Custom Link Suffix",
      customLinkPlaceholder: "Custom link suffix (optional)",
      password: "Access Password",
      passwordPlaceholder: "Set access password (optional)",
      expiryTime: "Expiry Time",
      expiryNever: "Never expires",
      expiryHour: "hours",
      expiryDay: "days",
      expiryWeek: "weeks",
      expiryMonth: "months",
      maxViews: "Max Views",
      maxViewsPlaceholder: "Limit view count (0 for unlimited)",
      createShare: "Create Share",
      creating: "Creating...",
    },

    // Share link
    shareLink: "Share Link:",
    copyLink: "Copy Link",
    copyRawLink: "Copy Raw Text Link",
    showQRCode: "Show QR Code",
    linkCopied: "Link copied to clipboard",
    rawLinkCopied: "Raw text link copied to clipboard",
    copyFailed: "Copy failed, please copy manually",
    linkExpireIn: "Link will be hidden in {seconds} seconds",

    // QR Code modal
    qrCodeTitle: "Share QR Code",
    qrCodeGenerating: "Generating...",
    qrCodeScanToAccess: "Scan QR code to access shared content",
    downloadQRCode: "Download QR Code",
    qrCodeDownloaded: "QR code downloaded",

    // Copy format menu
    copyFormats: "Copy Formats",
    copyAsMarkdown: "Copy as Markdown",
    copyAsHTML: "Copy as HTML",
    copyAsPlainText: "Copy as Plain Text",
    exportAsWord: "Export as Word Document",
    exportAsPng: "Export as PNG Image",
    exportDocumentTitle: "Markdown Export Document",
    markdownCopied: "Copied as Markdown format",
    htmlCopied: "Copied as HTML format",
    plainTextCopied: "Copied as plain text format",

    // Editor related
    editorPlaceholder: "Enter Markdown content here...",
    plainTextPlaceholder: "Enter plain text content here...",

    // Editor toolbar
    toolbar: {
      importFile: "Import File",
      clearContent: "Clear Content",
      copyFormats: "Copy Formats",
    },

    // Status messages
    messages: {
      noPermission: "No permission to create share",
      contentEmpty: "Content cannot be empty",
      creating: "Creating share...",
      createSuccess: "Share created successfully!",
      createFailed: "Save failed",
      linkOccupied: "Link suffix is already taken, please use another one",
      permissionDenied: "Insufficient permissions to create share",
      contentTooLarge: "Content too large, please reduce content length",
      unknownError: "Unknown error",
      editorNotReady: "Editor not ready",
      autoSaveFailed: "Auto-save failed",
      restoreContentFailed: "Failed to restore content",
      qrCodeGenerateFailed: "Failed to generate QR code",
      confirmClearContent: "Are you sure you want to clear all content?",
      generatingWord: "Generating Word document...",
      wordExported: "Word document generated and downloaded",
      wordExportFailed: "Export failed, please try again later",
      exportingPng: "Exporting PNG image...",
      pngExported: "PNG image exported and downloaded",
      pngExportFailed: "PNG export failed, please try again later",
      corsImageError: "Due to CORS restrictions, some images may not display correctly in the exported image",
    },

    // Form validation
    validation: {
      slugInvalid: "Link suffix can only contain letters, numbers, hyphens and underscores",
      slugTooLong: "Link suffix cannot exceed 50 characters",
      slugReserved: "This link suffix is reserved by the system, please use another one",
    },
  },

  // File upload module
  file: {
    // Page title and navigation
    uploadPageTitle: "File Upload",

    // Permission management
    permissionRequired: "Admin privileges or a valid API key are required to upload files, please",
    loginOrAuth: "login to admin panel or configure API key",

    // File uploader
    uploadTabs: {
      fileUpload: "File Upload",
      urlUpload: "URL Direct Link Upload",
    },

    // Drag and drop area
    dragDropTitle: "Drag files here or click to select",
    dragDropSubtitle: "Multiple file upload supported",
    dragDropHint: "Maximum file size: {size}",
    selectFiles: "Select Files",
    drag: "Drag files here",
    select: "Drag files here or click to select",
    maxSizeExceeded: "Maximum file size: {size}",
    multipleFilesSupported: "Multiple file upload supported",

    // File selection and management
    selectedFiles: "{count} files selected",
    clearAll: "Clear All",
    pending: "Pending",
    success: "Success",
    error: "Error",
    retry: "Retry",
    clearSelected: "Remove",
    cancelUpload: "Cancel Upload",

    // File information
    fileName: "File Name",
    fileSize: "Size",
    fileType: "Type",
    password: "Password",
    createdAt: "Created At",
    actions: "Actions",
    remainingViewsLabel: "Remaining Views",
    unlimited: "Unlimited",
    usedUp: "Used Up",
    unknownSize: "Unknown Size",

    // Form fields
    form: {
      s3Config: "Storage Config",
      selectS3Config: "Select Storage Config",
      customSlug: "Custom Link",
      customSlugPlaceholder: "Custom file access link (optional)",
      path: "Storage Path",
      pathPlaceholder: "File storage path (optional)",
      remark: "Remark",
      remarkPlaceholder: "Add a remark for this file (optional)",
      password: "Access Password",
      passwordPlaceholder: "Set access password (optional)",
      expiryTime: "Expiry Time",
      expiryNever: "Never expires",
      expiryHour: "hours",
      expiryDay: "days",
      expiryWeek: "weeks",
      expiryMonth: "months",
      maxViews: "Max Views",
      maxViewsPlaceholder: "Limit view count (0 for unlimited)",
      uploadButton: "Start Upload",
      uploading: "Uploading...",
      cancelUpload: "Cancel Upload",
    },

    // Storage and settings
    storage: "Storage Config",
    selectStorage: "Select Storage Config",
    noStorage: "No storage config available",
    path: "Storage Path",
    pathPlaceholder: "File storage path (optional)",
    shareSettings: "Share Settings",
    remark: "Remark",
    remarkPlaceholder: "Add a remark for this file (optional)",
    customLink: "Custom Link",
    customLinkPlaceholder: "Custom file access link (optional)",
    passwordProtection: "Password Protection",
    passwordPlaceholder: "Set access password (optional)",
    expireTime: "Expiry Time",
    maxViews: "Max Views",
    maxViewsPlaceholder: "Limit view count (0 for unlimited)",
    onlyAllowedChars: "Only letters, numbers, hyphens and underscores allowed",

    // Expiry options
    expireOptions: {
      hour1: "Expires in 1 hour",
      day1: "Expires in 1 day",
      day7: "Expires in 7 days",
      day30: "Expires in 30 days",
      never: "Never expires",
    },

    // Buttons and actions
    upload: "Start Upload",
    loading: "Uploading...",
    cancel: "Cancel",

    // URL upload
    urlUpload: {
      urlInput: "File URL",
      urlInputPlaceholder: "Enter the URL of the file to upload",
      analyzeUrl: "Analyze URL",
      analyzing: "Analyzing...",
      customFilename: "Custom Filename",
      customFilenamePlaceholder: "Custom filename (optional)",
      filePreview: "File Preview",
      uploadFromUrl: "Upload from URL",
      urlUpload: "URL Upload",
      urlAnalysisComplete: "URL analysis complete",
      retryAnalysis: "Retry Analysis",
    },

    // URL upload interface
    enterUrl: "Enter file URL",
    supportedUrlTypes: "Support HTTP and HTTPS links",
    urlPlaceholder: "Enter the URL of the file to upload",
    analyze: "Analyze",
    analyzing: "Analyzing...",
    urlFileInfo: "File Information",
    clear: "Clear",
    customFileName: "Custom Filename",
    customFilename: "Custom filename (optional)",

    // Upload methods
    uploadMethod: "Upload Method",
    presignedUpload: "Presigned Upload",
    multipartUpload: "Multipart Upload",
    presignedUploadDesc: "Pre-signed URL direct upload to storage",
    multipartUploadDesc: "Direct upload of shards to storage",

    // Upload stages
    starting: "Starting...",
    downloading: "Downloading...",
    downloadingProxy: "Proxy downloading...",
    preparing: "Preparing...",
    initializing: "Initializing...",
    uploading: "Uploading...",
    finalizing: "Finalizing...",
    completed: "Completed",
    cancelled: "Cancelled",

    // File list
    recentUploads: "Recent Uploads",
    showingRecent: "Showing recent 3 records",
    noFiles: "No files",
    noFilesUploaded: "No files uploaded",
    uploadToShow: "Upload files to display here",
    loading: "Loading...",

    // File operations
    open: "Open",
    delete: "Delete",
    qrCode: "QR Code",
    encrypted: "Encrypted",
    noPassword: "No Password",
    fileQrCode: "File QR Code",
    deleting: "Deleting...",
    confirmDeleteBtn: "Confirm Delete",
    deletedSuccess: "File deleted successfully",
    qrCodeDownloadSuccess: "QR code downloaded successfully",
    noValidLink: "No valid link",
    cannotGetProxyLink: "Cannot get proxy link",
    copyPermanentLinkFailed: "Failed to copy permanent link",
    getPasswordFromSessionError: "Failed to get password from session storage",

    // File operations
    copyLink: "Copy Link",
    copyDirectLink: "Copy Direct Link",
    downloadFile: "Download File",
    deleteFile: "Delete File",
    showQRCode: "Show QR Code",
    downloadQrCode: "Download QR Code",

    // Status messages
    uploadSuccessful: "File uploaded successfully",
    urlUploadSuccess: "URL file uploaded successfully",
    multipleUploadsSuccessful: "Successfully uploaded {count} files",
    retrySuccessful: "Retry upload successful",
    allSlugConflicts: "All file link suffixes are already taken, please use different ones",
    allPermissionErrors: "No permission to use this storage configuration",
    allUploadsFailed: "All file uploads failed",
    someSlugConflicts: "{count} file link suffixes are already taken",
    someUploadsFailed: "{count} file uploads failed",
    singleFileCancelMessage: "File upload cancelled",
    insufficientStorageDetailed: "Insufficient storage: file size({fileSize}) exceeds remaining space({remainingSpace}), total capacity limit is {totalCapacity}",
    linkCopied: "Link copied to clipboard",
    directLinkCopied: "Direct link copied to clipboard",
    copyFailed: "Copy failed, please copy manually",
    qrCodeDownloaded: "QR code downloaded",

    // Error messages
    messages: {
      noS3Config: "Please select a storage configuration",
      noFilesSelected: "Please select files to upload",
      fileTooLarge: "File size exceeds limit",
      uploadFailed: "Upload failed",
      uploadCancelled: "Upload cancelled",
      deleteFailed: "Delete failed",
      getFileDetailFailed: "Failed to get file details",
      cannotGetDirectLink: "Cannot get direct link, please try again later",
      invalidUrl: "Please enter a valid URL",
      urlAnalysisFailed: "URL analysis failed",
      negativeMaxViews: "Maximum views cannot be negative",
      getPresignedUrlFailed: "Failed to get presigned URL",
      slugInvalid: "Custom link can only contain letters, numbers, hyphens and underscores",
      slugTooLong: "Custom link cannot exceed 50 characters",
      slugReserved: "This link is reserved by the system, please use another one",
      slugConflict: "Link suffix is already taken, please use another one",
      permissionError: "No permission to use this storage configuration",
      initMultipartUploadFailed: "Failed to initialize multipart upload",
      uploadCancelled: "Upload cancelled",
      networkError: "Network error, please check your connection",
      serverError: "Server error, please try again later",
      unknownError: "Unknown error",
    },

    // Confirmation dialogs
    confirmDelete: "Confirm Delete",
    confirmDeleteMessage: "Are you sure you want to delete this file? This action cannot be undone.",
    confirm: "Confirm",
    cancel: "Cancel",

    // QR Code modal
    qrCodeTitle: "File QR Code",
    qrCodeGenerating: "Generating...",
    qrCodeScanToAccess: "Scan QR code to access file",

    // Upload progress
    uploadProgress: "Upload Progress",
    uploadSpeed: "Upload Speed",
    uploadStage: {
      starting: "Preparing upload...",
      initializing: "Initializing...",
      uploading: "Uploading...",
      processing: "Processing...",
      completing: "Completing...",
      completed: "Upload completed",
    },
  },
};
