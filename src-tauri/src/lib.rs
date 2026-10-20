use std::{fs, io::ErrorKind, path::PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};

#[derive(Debug, Serialize)]
struct NativeCommandError {
    code: &'static str,
    message: String,
}

impl NativeCommandError {
    fn invalid(message: impl Into<String>) -> Self {
        Self { code: "invalid-request", message: message.into() }
    }

    fn native(message: impl Into<String>) -> Self {
        Self { code: "native-window-error", message: message.into() }
    }

    fn persistence(message: impl Into<String>) -> Self {
        Self { code: "persistence-failed", message: message.into() }
    }

    fn not_found(message: impl Into<String>) -> Self {
        Self { code: "window-not-found", message: message.into() }
    }

}

type CommandResult<T> = Result<T, NativeCommandError>;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExternalWindowRequest {
    feature_id: String,
    label: String,
    title: String,
    width: f64,
    height: f64,
    min_width: f64,
    min_height: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExternalWindowOperationResult {
    created: bool,
}

fn is_safe_feature_id(feature_id: &str) -> bool {
    !feature_id.is_empty()
        && feature_id.len() <= 80
        && feature_id.chars().all(|character| character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-')
}

fn is_safe_external_label(label: &str) -> bool {
    label.strip_prefix("ember-feature-").is_some_and(is_safe_feature_id)
}

fn validate_external_request(request: &ExternalWindowRequest) -> CommandResult<()> {
    if !is_safe_feature_id(&request.feature_id) || request.label != format!("ember-feature-{}", request.feature_id) {
        return Err(NativeCommandError::invalid("The external feature label is invalid."));
    }
    let dimensions = [request.width, request.height, request.min_width, request.min_height];
    if dimensions.iter().any(|dimension| !dimension.is_finite() || *dimension <= 0.0) {
        return Err(NativeCommandError::invalid("Window dimensions must be finite positive numbers."));
    }
    Ok(())
}

#[tauri::command]
fn open_external_feature_window(app: AppHandle, request: ExternalWindowRequest) -> CommandResult<ExternalWindowOperationResult> {
    validate_external_request(&request)?;
    if let Some(window) = app.get_webview_window(&request.label) {
        window.show().map_err(|error| NativeCommandError::native(error.to_string()))?;
        window.set_focus().map_err(|error| NativeCommandError::native(error.to_string()))?;
        return Ok(ExternalWindowOperationResult { created: false });
    }

    let url = format!("/?window=external&feature={}", request.feature_id);
    let closed_app = app.clone();
    let closed_label = request.label.clone();
    let window = WebviewWindowBuilder::new(&app, &request.label, WebviewUrl::App(url.into()))
        .title(&request.title)
        .decorations(false)
        .transparent(false)
        .resizable(true)
        .inner_size(request.width, request.height)
        .min_inner_size(request.min_width, request.min_height)
        .build()
        .map_err(|error| NativeCommandError::native(error.to_string()))?;
    window.on_window_event(move |event| {
        if matches!(event, WindowEvent::Destroyed) {
            let _ = closed_app.emit("ember://external-window-closed", closed_label.clone());
        }
    });

    Ok(ExternalWindowOperationResult { created: true })
}

#[tauri::command]
fn focus_external_feature_window(app: AppHandle, label: String) -> CommandResult<()> {
    if !is_safe_external_label(&label) { return Err(NativeCommandError::invalid("The requested external window label is invalid.")); }
    let window = app.get_webview_window(&label).ok_or_else(|| NativeCommandError::not_found("The requested external window does not exist."))?;
    window.show().map_err(|error| NativeCommandError::native(error.to_string()))?;
    window.set_focus().map_err(|error| NativeCommandError::native(error.to_string()))
}

#[tauri::command]
fn close_external_feature_window(app: AppHandle, label: String) -> CommandResult<()> {
    if !is_safe_external_label(&label) { return Err(NativeCommandError::invalid("The requested external window label is invalid.")); }
    let window = app.get_webview_window(&label).ok_or_else(|| NativeCommandError::not_found("The requested external window does not exist."))?;
    window.close().map_err(|error| NativeCommandError::native(error.to_string()))
}

fn app_settings_path(app: &AppHandle) -> CommandResult<PathBuf> {
    app.path().app_data_dir()
        .map(|directory| directory.join("settings.json"))
        .map_err(|error| NativeCommandError::persistence(error.to_string()))
}

#[tauri::command]
async fn load_settings(app: AppHandle) -> CommandResult<Option<String>> {
    let path = app_settings_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || match fs::read_to_string(path) {
        Ok(value) => Ok(Some(value)),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error),
    })
    .await
    .map_err(|_| NativeCommandError::persistence("The settings operation did not complete."))?
    .map_err(|error| NativeCommandError::persistence(error.to_string()))
}

#[tauri::command]
async fn save_settings(app: AppHandle, content: String) -> CommandResult<()> {
    let path = app_settings_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        if let Some(directory) = path.parent() { fs::create_dir_all(directory)?; }
        fs::write(path, content)
    })
    .await
    .map_err(|_| NativeCommandError::persistence("The settings operation did not complete."))?
    .map_err(|error| NativeCommandError::persistence(error.to_string()))
}

#[tauri::command]
async fn clear_settings(app: AppHandle) -> CommandResult<()> {
    let path = app_settings_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error),
    })
    .await
    .map_err(|_| NativeCommandError::persistence("The settings operation did not complete."))?
    .map_err(|error| NativeCommandError::persistence(error.to_string()))
}

/// Read-only git for the Git window. All parsing lives in `src/git/gitCore.js`; this only runs
/// an allowlisted inspection command in a repository and returns its output.
const GIT_ALLOWED: [&str; 8] = ["log", "show", "status", "rev-parse", "for-each-ref", "diff", "rev-list", "describe"];

fn git_args_allowed(args: &[String]) -> Result<(), String> {
    let Some(first) = args.first() else { return Err("Missing git command".into()) };
    if !GIT_ALLOWED.contains(&first.as_str()) {
        return Err(format!("git {first} is not allowed (read-only)"));
    }
    for arg in &args[1..] {
        if arg == "--" {
            break;
        }
        let blocked = arg.starts_with("--output")
            || arg == "-o"
            || arg.starts_with("--ext-diff")
            || arg.starts_with("--textconv")
            || arg.starts_with("--exec-path")
            || arg.starts_with("--git-dir")
            || arg.starts_with("--work-tree")
            || arg.starts_with("--upload-pack")
            || arg == "-c"
            || arg.starts_with("--config");
        if blocked {
            return Err(format!("git flag {arg} is not allowed"));
        }
    }
    Ok(())
}

fn run_git(repo: &str, args: &[String]) -> Result<String, String> {
    git_args_allowed(args)?;
    let mut command = std::process::Command::new("git");
    command
        .args(args)
        .current_dir(repo)
        .env("GIT_OPTIONAL_LOCKS", "0")
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("LC_ALL", "C");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    let output = command.output().map_err(|error| format!("Could not run git: {error}"))?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    } else {
        let message = String::from_utf8_lossy(&output.stderr);
        Err(message.lines().next().unwrap_or("git failed").trim().to_string())
    }
}

#[tauri::command]
async fn git_run(repo: String, args: Vec<String>) -> CommandResult<String> {
    tauri::async_runtime::spawn_blocking(move || run_git(&repo, &args))
        .await
        .map_err(|error| NativeCommandError::native(error.to_string()))?
        .map_err(NativeCommandError::invalid)
}

/// Top-level folder of the repository that contains `dir`.
#[tauri::command]
async fn git_toplevel(dir: String) -> CommandResult<String> {
    tauri::async_runtime::spawn_blocking(move || run_git(&dir, &["rev-parse".into(), "--show-toplevel".into()]))
        .await
        .map_err(|error| NativeCommandError::native(error.to_string()))?
        .map(|top| top.trim().to_string())
        .map_err(|_| NativeCommandError::invalid("That folder is not inside a git repository."))
}

#[cfg(test)]
mod git_tests {
    use super::git_args_allowed;

    fn args(list: &[&str]) -> Vec<String> {
        list.iter().map(|item| item.to_string()).collect()
    }

    #[test]
    fn allows_inspection_commands() {
        assert!(git_args_allowed(&args(&["log", "--max-count=5", "--format=%H"])).is_ok());
        assert!(git_args_allowed(&args(&["show", "--numstat", "abc123", "--", "a.txt"])).is_ok());
        assert!(git_args_allowed(&args(&["status", "--porcelain=v1", "-b"])).is_ok());
    }

    #[test]
    fn refuses_anything_that_writes_or_runs_programs() {
        for bad in [
            vec!["commit", "-m", "x"],
            vec!["push"],
            vec!["checkout", "main"],
            vec!["config", "user.name", "x"],
            vec!["log", "--output=/tmp/x"],
            vec!["diff", "--ext-diff"],
            vec!["show", "--textconv", "abc"],
        ] {
            assert!(git_args_allowed(&args(&bad)).is_err(), "{bad:?} should be refused");
        }
        assert!(git_args_allowed(&[]).is_err());
    }

    #[test]
    fn paths_after_double_dash_are_not_flags() {
        assert!(git_args_allowed(&args(&["log", "--", "--output"])).is_ok());
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            open_external_feature_window,
            focus_external_feature_window,
            close_external_feature_window,
            load_settings,
            save_settings,
            clear_settings,
            git_run,
            git_toplevel,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Ember Studio");
}
