import { DbTables } from "../constants/index.js";
import crypto from "crypto";

/**
 * 初始化数据库表结构
 * @param {D1Database} db - D1数据库实例
 */
export async function initDatabase(db) {
  console.log("开始初始化数据库表结构...");

  // 创建pastes表 - 存储文本分享数据
  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS ${DbTables.PASTES} (
        id TEXT PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        content TEXT NOT NULL,
        remark TEXT,
        password TEXT,
        expires_at DATETIME,
        max_views INTEGER,
        views INTEGER DEFAULT 0,  
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `
    )
    .run();

  // 创建pastes表索引
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_pastes_slug ON ${DbTables.PASTES}(slug)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_pastes_created_at ON ${DbTables.PASTES}(created_at DESC)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_pastes_created_by ON ${DbTables.PASTES}(created_by)`).run();

  // 创建文本密码表
  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS ${DbTables.PASTE_PASSWORDS} (
        paste_id TEXT PRIMARY KEY,
        plain_password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (paste_id) REFERENCES ${DbTables.PASTES}(id) ON DELETE CASCADE
      )
    `
    )
    .run();

  // 创建admins表 - 存储管理员信息
  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS ${DbTables.ADMINS} (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `
    )
    .run();

  // 创建admin_tokens表 - 存储管理员认证令牌
  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS ${DbTables.ADMIN_TOKENS} (
        token TEXT PRIMARY KEY,
        admin_id TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (admin_id) REFERENCES ${DbTables.ADMINS}(id) ON DELETE CASCADE
      )
    `
    )
    .run();

  // 创建api_keys表 - 存储API密钥
  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS ${DbTables.API_KEYS} (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        key TEXT UNIQUE NOT NULL,
        text_permission BOOLEAN DEFAULT 0,
        file_permission BOOLEAN DEFAULT 0,
        mount_permission BOOLEAN DEFAULT 0,
        last_used DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME
      )
    `
    )
    .run();

  // 创建s3_configs表 - 存储S3配置信息
  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS ${DbTables.S3_CONFIGS} (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        provider_type TEXT NOT NULL,
        endpoint_url TEXT NOT NULL,
        bucket_name TEXT NOT NULL,
        region TEXT,
        access_key_id TEXT NOT NULL,
        secret_access_key TEXT NOT NULL,
        path_style BOOLEAN DEFAULT 0,
        default_folder TEXT DEFAULT '',
        is_public BOOLEAN DEFAULT 0,
        is_default BOOLEAN DEFAULT 0,
        total_storage_bytes BIGINT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used DATETIME,
        admin_id TEXT,
        FOREIGN KEY (admin_id) REFERENCES ${DbTables.ADMINS}(id) ON DELETE CASCADE
      )
    `
    )
    .run();

  // 创建files表 - 存储已上传文件的元数据
  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS ${DbTables.FILES} (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        storage_path TEXT NOT NULL,
        s3_url TEXT,
        mimetype TEXT NOT NULL,
        size INTEGER NOT NULL,
        s3_config_id TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        remark TEXT,
        password TEXT,
        expires_at DATETIME,
        max_views INTEGER,
        views INTEGER DEFAULT 0,
        use_proxy BOOLEAN DEFAULT 1,
        etag TEXT,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (s3_config_id) REFERENCES ${DbTables.S3_CONFIGS}(id) ON DELETE CASCADE
      )
    `
    )
    .run();

  // 创建files表索引
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_files_slug ON ${DbTables.FILES}(slug)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_files_s3_config_id ON ${DbTables.FILES}(s3_config_id)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_files_created_at ON ${DbTables.FILES}(created_at)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_files_expires_at ON ${DbTables.FILES}(expires_at)`).run();

  // 创建file_passwords表 - 存储文件密码
  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS ${DbTables.FILE_PASSWORDS} (
        file_id TEXT PRIMARY KEY,
        plain_password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (file_id) REFERENCES ${DbTables.FILES}(id) ON DELETE CASCADE
      )
    `
    )
    .run();

  // 创建system_settings表 - 存储系统设置
  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS ${DbTables.SYSTEM_SETTINGS} (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `
    )
    .run();

  // 创建storage_mounts表 - 存储挂载配置
  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS ${DbTables.STORAGE_MOUNTS} (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        storage_type TEXT NOT NULL,
        storage_config_id TEXT,
        mount_path TEXT NOT NULL,
        remark TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_by TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        cache_ttl INTEGER DEFAULT 300,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used DATETIME
      )
    `
    )
    .run();

  // 创建storage_mounts表索引
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_storage_mounts_mount_path ON ${DbTables.STORAGE_MOUNTS}(mount_path)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_storage_mounts_storage_config_id ON ${DbTables.STORAGE_MOUNTS}(storage_config_id)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_storage_mounts_created_by ON ${DbTables.STORAGE_MOUNTS}(created_by)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_storage_mounts_is_active ON ${DbTables.STORAGE_MOUNTS}(is_active)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_storage_mounts_sort_order ON ${DbTables.STORAGE_MOUNTS}(sort_order)`).run();

  // 检查是否已存在最大上传限制设置
  const maxUploadSize = await db
    .prepare(
      `
      SELECT value FROM ${DbTables.SYSTEM_SETTINGS}
      WHERE key = 'max_upload_size'
    `
    )
    .first();

  // 如果不存在，添加默认值
  if (!maxUploadSize) {
    await db
      .prepare(
        `
        INSERT INTO ${DbTables.SYSTEM_SETTINGS} (key, value, description)
        VALUES ('max_upload_size', '100', '单次最大上传文件大小限制(MB)')
      `
      )
      .run();
  }

  // 检查是否需要创建默认管理员账户
  const adminCount = await db.prepare(`SELECT COUNT(*) as count FROM ${DbTables.ADMINS}`).first();

  if (adminCount.count === 0) {
    const adminId = crypto.randomUUID();
    // 密码"admin123"的SHA-256哈希
    const defaultPassword = "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9";

    await db
      .prepare(
        `
        INSERT INTO ${DbTables.ADMINS} (id, username, password)
        VALUES (?, ?, ?)
      `
      )
      .bind(adminId, "admin", defaultPassword)
      .run();

    console.log("已创建默认管理员账户: admin/admin123");
  }

  console.log("数据库初始化完成");
}

/**
 * 执行数据库迁移,处理表结构变更，后续需要根据实际情况设置迁移脚本，待定
 * @param {D1Database} db - D1数据库实例
 * @param {number} currentVersion - 当前数据库版本
 * @param {number} targetVersion - 目标数据库版本
 */
async function migrateDatabase(db, currentVersion, targetVersion) {
  console.log(`开始数据库迁移,当前版本:${currentVersion},目标版本:${targetVersion}`);

  // 按版本号顺序执行迁移
  for (let version = currentVersion + 1; version <= targetVersion; version++) {
    console.log(`执行版本${version}的迁移...`);

    switch (version) {
      case 1:
        // 版本1的迁移脚本(初始版本,跳过)
        break;

      case 2:
        // 示例:添加新字段
        // await db
        //   .prepare(
        //     `ALTER TABLE ${DbTables.PASTES}
        //    ADD COLUMN category TEXT DEFAULT 'default'`
        //   )
        //   .run();
        break;

      // 在这里添加更多版本的迁移脚本
      // case 3:
      //   await db.prepare(`ALTER TABLE ...`).run();
      //   break;

      case 4:
        // 版本4：为API_KEYS表添加挂载权限字段
        try {
          console.log(`为${DbTables.API_KEYS}表添加mount_permission字段...`);

          // 检查字段是否已存在
          const columnInfo = await db.prepare(`PRAGMA table_info(${DbTables.API_KEYS})`).all();

          const mountPermissionExists = columnInfo.results.some((column) => column.name === "mount_permission");

          if (!mountPermissionExists) {
            // 如果字段不存在，添加它
            try {
              await db
                .prepare(
                  `ALTER TABLE ${DbTables.API_KEYS}
                   ADD COLUMN mount_permission BOOLEAN DEFAULT 0`
                )
                .run();
              console.log(`成功添加mount_permission字段到${DbTables.API_KEYS}表`);
            } catch (alterError) {
              console.error(`无法添加mount_permission字段到${DbTables.API_KEYS}表:`, alterError);
              console.log(`将继续执行迁移过程，但请手动检查${DbTables.API_KEYS}表结构`);
              // 不抛出错误，允许迁移继续进行
            }
          } else {
            console.log(`${DbTables.API_KEYS}表已存在mount_permission字段，跳过添加`);
          }
        } catch (error) {
          console.error(`为${DbTables.API_KEYS}表检查mount_permission字段时出错:`, error);
          console.log(`将继续执行迁移过程，但请手动检查${DbTables.API_KEYS}表结构`);
          // 不抛出错误，允许迁移继续进行
        }
        break;
    }

    // 记录迁移历史
    const now = new Date().toISOString();
    await db
      .prepare(
        `INSERT INTO ${DbTables.SYSTEM_SETTINGS} (key, value, description, updated_at)
       VALUES (?, ?, ?, ?)`
      )
      .bind(`migration_${version}`, "completed", `Version ${version} migration completed`, now)
      .run();
  }

  console.log("数据库迁移完成");
}

/**
 * 检查数据库是否需要初始化，并在需要时执行初始化
 * 通过检查系统设置表中是否存在特定标记来判断
 * @param {D1Database} db - D1数据库实例
 * @returns {Promise<boolean>} 是否执行了初始化操作
 */
export async function checkAndInitDatabase(db) {
  try {
    console.log("检查数据库状态...");

    // 获取所有现有表
    const existingTables = await db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all();
    const tableSet = new Set(existingTables.results.map((table) => table.name));

    // 检查每个表是否存在，不存在则创建
    let needsTablesCreation = false;

    // 检查pastes表
    if (!tableSet.has(DbTables.PASTES)) {
      console.log(`${DbTables.PASTES}表不存在，需要创建`);
      needsTablesCreation = true;
    }

    // 检查paste_passwords表
    if (!tableSet.has(DbTables.PASTE_PASSWORDS)) {
      console.log(`${DbTables.PASTE_PASSWORDS}表不存在，需要创建`);
      needsTablesCreation = true;
    }

    // 检查admins表
    if (!tableSet.has(DbTables.ADMINS)) {
      console.log(`${DbTables.ADMINS}表不存在，需要创建`);
      needsTablesCreation = true;
    }

    // 检查admin_tokens表
    if (!tableSet.has(DbTables.ADMIN_TOKENS)) {
      console.log(`${DbTables.ADMIN_TOKENS}表不存在，需要创建`);
      needsTablesCreation = true;
    }

    // 检查api_keys表
    if (!tableSet.has(DbTables.API_KEYS)) {
      console.log(`${DbTables.API_KEYS}表不存在，需要创建`);
      needsTablesCreation = true;
    }

    // 检查s3_configs表
    if (!tableSet.has(DbTables.S3_CONFIGS)) {
      console.log(`${DbTables.S3_CONFIGS}表不存在，需要创建`);
      needsTablesCreation = true;
    }

    // 检查files表
    if (!tableSet.has(DbTables.FILES)) {
      console.log(`${DbTables.FILES}表不存在，需要创建`);
      needsTablesCreation = true;
    }

    // 检查file_passwords表
    if (!tableSet.has(DbTables.FILE_PASSWORDS)) {
      console.log(`${DbTables.FILE_PASSWORDS}表不存在，需要创建`);
      needsTablesCreation = true;
    }

    // 检查system_settings表
    if (!tableSet.has(DbTables.SYSTEM_SETTINGS)) {
      console.log(`${DbTables.SYSTEM_SETTINGS}表不存在，需要创建`);
      needsTablesCreation = true;
    }

    // 检查storage_mounts表
    if (!tableSet.has(DbTables.STORAGE_MOUNTS)) {
      console.log(`${DbTables.STORAGE_MOUNTS}表不存在，需要创建`);
      needsTablesCreation = true;
    }

    // 如果有表不存在，执行表初始化
    if (needsTablesCreation) {
      console.log("检测到缺少表，执行表创建...");
      await initDatabase(db);
    }

    // 检查当前schema版本
    let currentVersion = 0;

    if (tableSet.has(DbTables.SYSTEM_SETTINGS)) {
      const schemaVersion = await db.prepare(`SELECT value FROM ${DbTables.SYSTEM_SETTINGS} WHERE key='schema_version'`).first();
      currentVersion = schemaVersion ? parseInt(schemaVersion.value) : 0;
    }

    // 如果要添加新表或修改现有表，请递增目标版本，修改后启动时自动更新数据库
    const targetVersion = 4; // 目标schema版本,每次修改表结构时递增

    if (currentVersion < targetVersion) {
      console.log(`需要更新数据库结构，当前版本:${currentVersion}，目标版本:${targetVersion}`);

      if (currentVersion === 0 && !needsTablesCreation) {
        // 如果版本为0但表已存在，表示是旧数据库，执行完整初始化确保所有表创建
        await initDatabase(db);
      } else if (currentVersion > 0) {
        // 执行迁移脚本
        await migrateDatabase(db, currentVersion, targetVersion);
      }

      // 更新schema版本
      const now = new Date().toISOString();
      if (tableSet.has(DbTables.SYSTEM_SETTINGS)) {
        const existingVersion = await db.prepare(`SELECT value FROM ${DbTables.SYSTEM_SETTINGS} WHERE key='schema_version'`).first();
        if (existingVersion) {
          await db
            .prepare(
              `UPDATE ${DbTables.SYSTEM_SETTINGS} 
               SET value = ?, updated_at = ?
               WHERE key = 'schema_version'`
            )
            .bind(targetVersion.toString(), now)
            .run();
        } else {
          await db
            .prepare(
              `INSERT INTO ${DbTables.SYSTEM_SETTINGS} (key, value, description, updated_at)
               VALUES ('schema_version', ?, '数据库Schema版本号', ?)`
            )
            .bind(targetVersion.toString(), now)
            .run();
        }
      }
    }

    // 检查初始化标记
    if (tableSet.has(DbTables.SYSTEM_SETTINGS)) {
      const initFlag = await db.prepare(`SELECT value FROM ${DbTables.SYSTEM_SETTINGS} WHERE key='db_initialized'`).first();

      if (!initFlag) {
        // 没有初始化标记，设置标记
        const now = new Date().toISOString();
        await db
          .prepare(
            `INSERT INTO ${DbTables.SYSTEM_SETTINGS} (key, value, updated_at) 
             VALUES ('db_initialized', ?, ?)`
          )
          .bind("true", now)
          .run();
        console.log("设置数据库初始化标记");
      } else {
        console.log("数据库已初始化，跳过初始化标记设置");
      }
    }

    return needsTablesCreation || currentVersion < targetVersion; // 如果创建了表或需要更新，说明执行了初始化
  } catch (error) {
    // 如果出错（例如表不存在），则执行初始化
    console.error("检查数据库状态出错，执行初始化:", error);
    await initDatabase(db);
    return true;
  }
}
