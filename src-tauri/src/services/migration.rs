use crate::utils::file;
use crate::errors::AppResult;

pub fn migrate_legacy_data() -> AppResult<()> {
    let legacy_dir = match file::legacy_app_data_dir() {
        Some(d) if d.exists() => d,
        _ => return Ok(()),
    };

    let new_config_dir = file::app_config_dir()?;

    let migrations = [
        ("connections.properties", "connections.properties"),
        ("app.properties", "app.properties"),
        ("favorites.json", "favorites.json"),
    ];

    for (legacy_name, new_name) in &migrations {
        let legacy_path = legacy_dir.join(legacy_name);
        let new_path = new_config_dir.join(new_name);

        if legacy_path.exists() && !new_path.exists() {
            if let Some(parent) = new_path.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| crate::errors::AppError::Io(e))?;
            }
            std::fs::copy(&legacy_path, &new_path)
                .map_err(|e| crate::errors::AppError::Io(e))?;
            eprintln!(
                "[V2] Migrated legacy config: {} -> {}",
                legacy_path.display(),
                new_path.display()
            );
        }
    }

    Ok(())
}
