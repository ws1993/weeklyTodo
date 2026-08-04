//! WebDAV 同步密码存储：Windows 上使用系统凭据管理器（keyring）。

const KEYRING_SERVICE: &str = "weeklytodo";

fn entry(username: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, username)
        .map_err(|error| format!("创建凭据条目失败：{error}"))
}

/// Save (or overwrite) the password for a WebDAV username.
pub fn save_password(username: &str, password: &str) -> Result<(), String> {
    entry(username)?
        .set_password(password)
        .map_err(|error| format!("保存凭据失败：{error}"))
}

/// Load the stored password for a WebDAV username.
pub fn load_password(username: &str) -> Result<Option<String>, String> {
    match entry(username)?.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(format!("读取凭据失败：{error}")),
    }
}

/// Whether a password is already stored for the username.
pub fn has_password(username: &str) -> Result<bool, String> {
    Ok(load_password(username)?.is_some())
}

/// Remove the stored password for a WebDAV username.
pub fn delete_password(username: &str) -> Result<(), String> {
    entry(username)?
        .delete_credential()
        .map_err(|error| format!("清除凭据失败：{error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    // keyring 依赖系统凭据存储，单元测试只验证 service 名稳定，避免触碰真实凭据。
    #[test]
    fn service_name_is_stable() {
        assert_eq!(KEYRING_SERVICE, "weeklytodo");
    }
}
