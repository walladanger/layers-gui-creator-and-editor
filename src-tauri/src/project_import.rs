use std::{
    fs,
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex},
    time::Duration,
};
use serde::Serialize;
use tauri::{AppHandle, Manager, State};
use percent_encoding::percent_decode_str;

#[derive(Default)]
pub struct ProjectServers {
    children: Arc<Mutex<Vec<Child>>>,
}

impl Drop for ProjectServers {
    fn drop(&mut self) {
        if let Ok(mut children) = self.children.lock() {
            for child in children.iter_mut() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFile {
    path: String,
    content: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeProjectScan {
    root: String,
    name: String,
    files: Vec<ProjectFile>,
    package_json: Option<String>,
    has_node_modules: bool,
}

fn error(message: impl Into<String>) -> String { message.into() }

fn safe_repo(repo: &str) -> Result<(String, String), String> {
    let input = repo.trim();
    let input = input.strip_prefix("https://github.com/").unwrap_or(input);
    let input = input.trim_end_matches('/').strip_suffix(".git").unwrap_or(input.trim_end_matches('/'));
    let parts: Vec<&str> = input.split('/').collect();
    if parts.len() != 2 || parts.iter().any(|part| {
        part.is_empty() || part.len() > 100 || *part == "." || *part == ".." ||
        !part.bytes().all(|byte| byte.is_ascii_alphanumeric() || b"-_.".contains(&byte))
    }) {
        return Err(error("Enter a public GitHub repository URL or owner/repo. Branch URLs and other hosts are not supported."));
    }
    Ok((parts[0].to_owned(), parts[1].to_owned()))
}

fn inspect_project(root: &Path) -> Result<NativeProjectScan, String> {
    let root = root.canonicalize().map_err(|e| error(format!("Cannot open project folder: {e}")))?;
    if !root.is_dir() { return Err(error("Select a project folder, not an individual file.")); }
    let name = root.file_name().and_then(|name| name.to_str()).unwrap_or("Project").to_owned();
    let package_json = fs::read_to_string(root.join("package.json")).ok().filter(|value| value.len() <= 262_144);
    let has_node_modules = root.join("node_modules").is_dir();
    let mut files = Vec::new();
    let mut dirs = vec![root.clone()];
    let mut scanned = 0usize;
    while let Some(dir) = dirs.pop() {
        if scanned >= 12_000 || files.len() >= 400 { break; }
        let entries = fs::read_dir(dir).map_err(|e| error(format!("Could not scan project: {e}")))?;
        for entry in entries.flatten() {
            scanned += 1;
            if scanned >= 12_000 || files.len() >= 400 { break; }
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().into_owned();
            if name.starts_with('.') || ["node_modules", "dist", "build", "target", "coverage", ".next", "vendor", "src-tauri"].contains(&name.as_str()) { continue; }
            // Avoid crossing through symlinked directories or files.
            let Ok(meta) = entry.file_type() else { continue };
            if meta.is_symlink() { continue; }
            if meta.is_dir() { dirs.push(path); continue; }
            if !meta.is_file() || !["html", "tsx", "jsx", "vue", "svelte"].contains(&path.extension().and_then(|s| s.to_str()).unwrap_or("")) { continue; }
            if name.contains(".test.") || name.contains(".spec.") || name.contains(".stories.") { continue; }
            if let Ok(info) = entry.metadata() { if info.len() > 524_288 { continue; } }
            let Ok(content) = fs::read_to_string(&path) else { continue };
            let relative = path.strip_prefix(&root).map_err(|e| error(e.to_string()))?.to_string_lossy().replace('\\', "/");
            files.push(ProjectFile { path: relative, content });
        }
    }
    Ok(NativeProjectScan { root: root.to_string_lossy().into_owned(), name, files, package_json, has_node_modules })
}

#[tauri::command]
pub async fn select_project_folder() -> Result<Option<NativeProjectScan>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let chosen = rfd::FileDialog::new().set_title("Select a project folder").pick_folder();
        chosen.map(|path| inspect_project(&path)).transpose()
    }).await.map_err(|_| error("The folder picker could not complete."))?
}

#[tauri::command]
pub async fn inspect_project_path(path: String) -> Result<NativeProjectScan, String> {
    tauri::async_runtime::spawn_blocking(move || inspect_project(Path::new(&path)))
        .await.map_err(|_| error("The local project could not be inspected."))?
}

#[tauri::command]
pub async fn clone_github_project(app: AppHandle, repo: String) -> Result<NativeProjectScan, String> {
    let (owner, project) = safe_repo(&repo)?;
    let data = app.path().app_local_data_dir().map_err(|e| error(e.to_string()))?;
    tauri::async_runtime::spawn_blocking(move || {
        let parent = data.join("projects").join(&owner);
        fs::create_dir_all(&parent).map_err(|e| error(format!("Unable to create local projects folder: {e}")))?;
        let target = parent.join(&project);
        if target.exists() {
            if !target.join(".git").exists() {
                return Err(error("The local project folder exists but is not a Git clone. Choose a different repository or resolve the folder conflict."));
            }
            return inspect_project(&target);
        }
        let url = format!("https://github.com/{owner}/{project}.git");
        let output = Command::new("git")
            .arg("-c").arg("protocol.file.allow=never")
            .arg("clone").arg("--depth").arg("1").arg("--").arg(&url).arg(&target)
            .env("GIT_TERMINAL_PROMPT", "0")
            .output().map_err(|_| error("Git is required to clone GitHub repositories. Install Git for Windows and reopen Layers."))?;
        if !output.status.success() {
            let _ = fs::remove_dir_all(&target);
            return Err(error(format!("GitHub clone failed: {}", String::from_utf8_lossy(&output.stderr).chars().take(400).collect::<String>())));
        }
        inspect_project(&target)
    }).await.map_err(|_| error("GitHub import was interrupted."))?
}

fn safe_static_file(root: &Path, request: &str) -> Option<PathBuf> {
    let request = request.split('?').next()?.split('#').next()?;
    let decoded = percent_decode_str(request).decode_utf8().ok()?;
    if decoded.contains('\\') || decoded.contains('\0') || decoded.contains(':') { return None; }
    let relative = decoded.trim_start_matches('/');
    if relative.split('/').any(|s| s == ".." || s.starts_with('.')) { return None; }
    let relative = if relative.is_empty() { "index.html" } else { relative };
    let candidate = root.join(relative);
    let candidate = if candidate.exists() { candidate } else { root.join("public").join(relative) };
    let canonical = candidate.canonicalize().ok()?;
    if canonical.starts_with(root) && canonical.is_file() { Some(canonical) } else { None }
}

fn mime_type(path: &Path) -> &'static str {
    match path.extension().and_then(|s| s.to_str()).unwrap_or("") {
        "html" => "text/html; charset=utf-8", "css" => "text/css; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8", "json" => "application/json",
        "svg" => "image/svg+xml", "png" => "image/png", "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif", "webp" => "image/webp", "woff2" => "font/woff2",
        _ => "application/octet-stream",
    }
}

fn serve_static(mut stream: TcpStream, root: &Path) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
    let mut buf = [0u8; 8192];
    let Ok(size) = stream.read(&mut buf) else { return };
    let request = String::from_utf8_lossy(&buf[..size]);
    let Some(first) = request.lines().next() else { return };
    let mut parts = first.split_whitespace();
    let method = parts.next().unwrap_or("");
    let url = parts.next().unwrap_or("/");
    let valid_method = method == "GET" || method == "HEAD";
    let file = if valid_method { safe_static_file(root, url) } else { None };
    let (status, body, kind) = match file {
        Some(path) => match fs::read(&path) {
            Ok(bytes) if bytes.len() <= 20_000_000 => ("200 OK", bytes, mime_type(&path)),
            _ => ("404 Not Found", b"Not found".to_vec(), "text/plain"),
        },
        None => ("404 Not Found", b"Not found".to_vec(), "text/plain"),
    };
    let header = format!("HTTP/1.1 {status}\r\nContent-Type: {kind}\r\nContent-Length: {}\r\nX-Content-Type-Options: nosniff\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n", body.len());
    let _ = stream.write_all(header.as_bytes());
    if method != "HEAD" { let _ = stream.write_all(&body); }
}

fn static_preview(root: PathBuf, entry: Option<String>) -> Result<String, String> {
    let path = entry.unwrap_or_else(|| "/index.html".to_owned());
    if safe_static_file(&root, &path).is_none() { return Err(error("The selected HTML page was not found in the imported project.")); }
    let listener = TcpListener::bind(("127.0.0.1", 0)).map_err(|e| error(format!("Could not start local preview: {e}")))?;
    let port = listener.local_addr().map_err(|e| error(e.to_string()))?.port();
    std::thread::spawn(move || {
        for incoming in listener.incoming() {
            if let Ok(stream) = incoming { serve_static(stream, &root); }
        }
    });
    Ok(format!("http://127.0.0.1:{port}{path}"))
}

fn vite_preview(root: &Path, servers: Arc<Mutex<Vec<Child>>>) -> Result<String, String> {
    if !root.join("node_modules").is_dir() {
        // Installation is triggered only by the user's explicit Preview click.
        // Disable install lifecycle scripts to avoid silently executing package hooks.
        let npm = if cfg!(windows) { "npm.cmd" } else { "npm" };
        if root.join("pnpm-lock.yaml").exists() || root.join("yarn.lock").exists() {
            return Err(error("This project uses pnpm or Yarn. Automatic dependency setup currently supports npm projects only."));
        }
        let command = if root.join("package-lock.json").exists() { "ci" } else { "install" };
        let install = Command::new(npm).arg(command).arg("--ignore-scripts").arg("--no-audit").arg("--no-fund")
            .current_dir(root).stdin(Stdio::null()).output()
            .map_err(|_| error("Install Node.js/npm to prepare this Vite project."))?;
        if !install.status.success() {
            let tail = String::from_utf8_lossy(&install.stderr).chars().rev().take(500).collect::<String>();
            return Err(error(format!("Dependency installation failed: {}", tail.chars().rev().collect::<String>())));
        }
    }
    let package = fs::read_to_string(root.join("package.json")).map_err(|_| error("No package.json found."))?;
    // Only run a declared 'dev' script identified as Vite. Other scripts are not launched.
    let parsed: serde_json::Value = serde_json::from_str(&package).map_err(|_| error("Invalid package.json."))?;
    let dev = parsed.pointer("/scripts/dev").and_then(|v| v.as_str()).unwrap_or("");
    if !dev.split_whitespace().any(|part| part == "vite" || part == "vite.cmd") {
        return Err(error("Automatic launch currently supports Vite. Other project runtimes require a dedicated adapter."));
    }
    let listener = TcpListener::bind(("127.0.0.1", 0)).map_err(|e| error(e.to_string()))?;
    let port = listener.local_addr().map_err(|e| error(e.to_string()))?.port();
    drop(listener);
    let cmd = if cfg!(windows) { "npm.cmd" } else { "npm" };
    let mut child = Command::new(cmd)
        .arg("run").arg("dev").arg("--").arg("--host").arg("127.0.0.1")
        .arg("--port").arg(port.to_string()).arg("--strictPort")
        .current_dir(root).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null())
        .spawn().map_err(|_| error("Node.js/npm is required to run this Vite app. Install Node.js to enable previews."))?;
    for _ in 0..50 {
        if TcpStream::connect_timeout(&format!("127.0.0.1:{port}").parse().map_err(|e: std::net::AddrParseError| error(e.to_string()))?, Duration::from_millis(100)).is_ok() {
            let mut active = servers.lock().map_err(|_| error("Preview manager unavailable."))?;
            active.push(child);
            return Ok(format!("http://127.0.0.1:{port}/"));
        }
        if child.try_wait().map_err(|e| error(e.to_string()))?.is_some() {
            return Err(error("The Vite server exited before opening. Check the project's dev script and installed dependencies."));
        }
        std::thread::sleep(Duration::from_millis(200));
    }
    let _ = child.kill();
    let _ = child.wait();
    Err(error("The app did not start its preview server. Check the project's dev script and dependencies."))
}

#[tauri::command]
pub async fn start_project_preview(
    root: String,
    entry: Option<String>,
    state: State<'_, ProjectServers>,
) -> Result<String, String> {
    let root = PathBuf::from(root).canonicalize().map_err(|_| error("The imported project folder is missing."))?;
    if !root.is_dir() { return Err(error("Project folder is missing.")); }
    // Local, confirmed project. Running code is only triggered by the explicit Start Preview action.
    if let Some(entry) = entry { return static_preview(root, Some(entry)); }
    let children = state.children.clone();
    tauri::async_runtime::spawn_blocking(move || vite_preview(&root, children))
        .await.map_err(|_| error("The preview operation was interrupted."))?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn github_path_validation_blocks_other_hosts_and_path_traversal() {
        assert_eq!(safe_repo("https://github.com/walladanger/Layers.git").unwrap(), ("walladanger".to_string(), "Layers".to_string()));
        assert!(safe_repo("https://evil.example/a/b").is_err());
        assert!(safe_repo("../other").is_err());
        assert!(safe_repo("owner/repo/extra").is_err());
    }
    #[test]
    fn static_preview_rejects_traversal() {
        let tmp = std::env::temp_dir();
        assert!(safe_static_file(&tmp, "/%2e%2e/secrets.txt").is_none());
    }
}
