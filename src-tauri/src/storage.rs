use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::db;

const CONFIG_FILE_NAME: &str = "weeklytodo-config.json";
const DB_BACKUP_SUFFIX: &str = ".pre-migration.bak";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StorageConfig {
    pub data_dir: String,
    pub schema_version: i32,
}

/// Where the app executable lives (used to propose a portable `data` folder).
fn executable_dir() -> Option<PathBuf> {
    std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(|parent| parent.to_path_buf()))
}

/// Default portable location next to the executable when it is writable.
fn default_data_dir() -> Result<PathBuf, String> {
    if let Some(exe_dir) = executable_dir() {
        let candidate = exe_dir.join("data");
        if probe_writable(&candidate) {
            return Ok(candidate);
        }
    }
    // Fall back to a stable per-user location.
    if let Some(app_data) = std::env::var_os("APPDATA") {
        return Ok(PathBuf::from(app_data).join("weeklytodo").join("data"));
    }
    Err("无法确定默认数据目录".to_string())
}

/// Check that a directory can be created/written.
fn probe_writable(dir: &Path) -> bool {
    if std::fs::create_dir_all(dir).is_err() {
        return false;
    }
    let probe = dir.join(".write-test");
    std::fs::write(&probe, b"ok").is_ok() && std::fs::remove_file(probe).is_ok()
}

fn config_path() -> Result<PathBuf, String> {
    let app_data =
        std::env::var_os("APPDATA").ok_or_else(|| "无法确定应用配置目录".to_string())?;
    let dir = PathBuf::from(app_data).join("weeklytodo");
    std::fs::create_dir_all(&dir)
        .map_err(|error| format!("创建配置目录失败：{error}"))?;
    Ok(dir.join(CONFIG_FILE_NAME))
}

/// Load the storage configuration from the app config file.
pub fn load_config() -> Result<Option<StorageConfig>, String> {
    let path = config_path()?;
    if !path.exists() {
        return Ok(None);
    }
    let content = std::fs::read_to_string(&path)
        .map_err(|error| format!("读取配置文件失败：{error}"))?;
    let config: StorageConfig = serde_json::from_str(&content)
        .map_err(|error| format!("解析配置文件失败：{error}"))?;
    Ok(Some(config))
}

fn save_config(config: &StorageConfig) -> Result<(), String> {
    let path = config_path()?;
    let content = serde_json::to_string_pretty(config)
        .map_err(|error| format!("序列化配置失败：{error}"))?;
    std::fs::write(&path, content).map_err(|error| format!("写入配置文件失败：{error}"))
}

/// First-run resolution of the storage directory.
pub fn ensure_storage(config: Option<StorageConfig>) -> Result<StorageConfig, String> {
    if let Some(config) = config {
        // Validate the stored directory is still usable before trusting it.
        if Path::new(&config.data_dir).is_dir() {
            return Ok(config);
        }
    }

    let data_dir = default_data_dir()?;
    let config = StorageConfig {
        data_dir: data_dir.to_string_lossy().to_string(),
        schema_version: db::SCHEMA_VERSION,
    };
    save_config(&config)?;
    Ok(config)
}

/// Switch storage to a new directory. Returns the migrated config.
pub fn migrate_storage(
    current: &StorageConfig,
    new_data_dir: PathBuf,
) -> Result<StorageConfig, String> {
    if current.data_dir == new_data_dir.to_string_lossy() {
        return Ok(current.clone());
    }

    // Destination must be writable and empty of our database (avoid clobbering).
    if !probe_writable(&new_data_dir) {
        return Err("目标目录不可写".to_string());
    }
    let target_db = new_data_dir.join(db::DB_FILE_NAME);
    if target_db.exists() {
        return Err("目标目录已包含数据文件，为避免覆盖请选择空目录".to_string());
    }

    let source_db = Path::new(&current.data_dir).join(db::DB_FILE_NAME);
    if !source_db.exists() {
        return Err(format!("源数据文件不存在：{}", source_db.display()));
    }

    // Validate the source database before moving anything.
    let _validation_conn = db::open_database(&new_data_dir)?;
    std::fs::remove_file(&target_db).ok();

    // Backup the source then copy.
    let backup_path = PathBuf::from(&current.data_dir).join(format!(
        "{}{DB_BACKUP_SUFFIX}",
        db::DB_FILE_NAME
    ));
    std::fs::copy(&source_db, &backup_path)
        .map_err(|error| format!("备份源数据库失败：{error}"))?;
    std::fs::copy(&source_db, &target_db).map_err(|error| format!("复制数据库失败：{error}"))?;

    let new_config = StorageConfig {
        data_dir: new_data_dir.to_string_lossy().to_string(),
        schema_version: db::SCHEMA_VERSION,
    };
    save_config(&new_config)?;
    Ok(new_config)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    static COUNTER: AtomicUsize = AtomicUsize::new(0);

    fn temp_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "weeklytodo-test-{}-{}",
            std::process::id(),
            COUNTER.fetch_add(1, Ordering::SeqCst)
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn migrate_moves_database_and_saves_config() {
        let source = temp_dir();
        let target = temp_dir();
        db::open_database(&source).unwrap();
        let source_db = source.join(db::DB_FILE_NAME);
        assert!(source_db.exists());

        let config = StorageConfig {
            data_dir: source.to_string_lossy().to_string(),
            schema_version: db::SCHEMA_VERSION,
        };
        let migrated = migrate_storage(&config, target.clone()).unwrap();
        assert_eq!(migrated.data_dir, target.to_string_lossy().to_string());
        assert!(target.join(db::DB_FILE_NAME).exists());
        // Backup retained at the source.
        assert!(source_db.exists());

        // Cleanup.
        let _ = std::fs::remove_dir_all(&source);
        let _ = std::fs::remove_dir_all(&target);
    }

    #[test]
    fn migrate_rejects_existing_target_db() {
        let source = temp_dir();
        let target = temp_dir();
        db::open_database(&source).unwrap();
        db::open_database(&target).unwrap();

        let config = StorageConfig {
            data_dir: source.to_string_lossy().to_string(),
            schema_version: db::SCHEMA_VERSION,
        };
        let result = migrate_storage(&config, target.clone());
        assert!(result.is_err());

        let _ = std::fs::remove_dir_all(&source);
        let _ = std::fs::remove_dir_all(&target);
    }
}
