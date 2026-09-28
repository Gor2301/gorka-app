// gorka-shared::storage
//
// Storage abstraction shared by both GORKA desktop applications.
//
// The binary constructs an AppStorage for its own identity and places
// it into Tauri-managed state. The shared code consumes that state
// to resolve paths.
//
// This module does NOT know "client" or "agent".
// It knows only about an app_data_dir, a db_filename, and a
// files_subdir. The binary supplies those three values.

use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct AppStorage {
    /// The application data root for this binary.
    /// Supplied by the binary, from Tauri's app_data_dir().
    /// On Windows, e.g. %APPDATA%\com.gorka.client
    /// or %APPDATA%\com.gorka.agent
    pub app_data_dir: PathBuf,

    /// The database filename.
    /// e.g. "gorka-client.db" or "gorka-agent.db"
    pub db_filename: String,

    /// The files subdirectory, relative to app_data_dir.
    /// e.g. "data/files"
    pub files_subdir: String,
}

impl AppStorage {
    pub fn new(
        app_data_dir: PathBuf,
        db_filename: impl Into<String>,
        files_subdir: impl Into<String>,
    ) -> Self {
        Self {
            app_data_dir,
            db_filename: db_filename.into(),
            files_subdir: files_subdir.into(),
        }
    }

    /// The GORKA data subdirectory under the application root.
    /// <app_data_dir>\data
    pub fn data_dir(&self) -> PathBuf {
        self.app_data_dir.join("data")
    }

    /// The SQLCipher database file path.
    /// <app_data_dir>\data\<db_filename>
    pub fn db_path(&self) -> PathBuf {
        self.data_dir().join(&self.db_filename)
    }

    /// The root of debtor file storage.
    /// <app_data_dir>\data\files
    pub fn files_root(&self) -> PathBuf {
        self.app_data_dir.join(&self.files_subdir)
    }

    /// The root of per-debtor file subdirectories.
    /// <app_data_dir>\data\files\debtors
    pub fn debtor_files_dir(&self) -> PathBuf {
        self.files_root().join("debtors")
    }

    /// The directory for a specific debtor's files.
    /// <app_data_dir>\data\files\debtors\<debtor_id>
    pub fn debtor_dir(&self, debtor_id: &str) -> PathBuf {
        self.debtor_files_dir().join(debtor_id)
    }

    /// Create the directories this storage needs, if missing.
    pub fn ensure_dirs(&self) -> Result<(), String> {
        std::fs::create_dir_all(self.debtor_files_dir())
            .map_err(|e| format!("Failed to create debtor files directory: {}", e))?;
        Ok(())
    }
}