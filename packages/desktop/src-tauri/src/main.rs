// A release build is a GUI app; without this Windows also opens a console
// window beside it. Debug builds keep the console, where panics print.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! Kaizoku desktop shell, stage K0 of docs/plans/windows-offline-plan.md.
//!
//! One window, two surfaces. When the server answers, the window is navigated
//! to the server's own origin and Kaizoku runs there unmodified: its cookies,
//! its relative tRPC URLs, its server-rendered pages and its WebSocket all
//! assume that origin, so nothing else would work. When the server does not
//! answer, the window shows the shelf bundled in the installer instead of a
//! browser error page.
//!
//! The commands below are callable from the shelf only. No capability lists a
//! remote origin, so a page served by Kaizoku cannot reach any of them. That
//! is deliberate: a script injected into the web app would otherwise reach
//! whatever the shell exposes.

mod server;

use std::time::Duration;

use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{AppHandle, Manager, Url, WebviewUrl, WebviewWindowBuilder};

use server::Probe;

const MAIN_WINDOW: &str = "main";

/// How long a navigation may wait to learn the server is gone. The check runs
/// on the UI thread, so it is kept short; a refused connection answers at once
/// and only a silent host costs the full wait.
const NAVIGATION_CHECK: Duration = Duration::from_millis(1500);

/// Where the bundled shelf lives. WebView2 serves the app's own files from
/// `http://tauri.localhost` (see `useHttpsScheme: false`); elsewhere Tauri
/// uses its custom scheme.
fn shelf_url(query: &str) -> Url {
    let base = if cfg!(windows) {
        "http://tauri.localhost/index.html"
    } else {
        "tauri://localhost/index.html"
    };
    let full = if query.is_empty() {
        base.to_string()
    } else {
        format!("{base}?{query}")
    };
    Url::parse(&full).expect("the shelf URL is a constant and always parses")
}

fn is_shelf(url: &Url) -> bool {
    url.scheme() == "tauri" || url.host_str() == Some("tauri.localhost")
}

fn navigate(app: &AppHandle, url: Url) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        // A failure here means the window is already closing.
        let _ = window.navigate(url);
    }
}

/// Probes the saved server and sends the window to it, or to the shelf with
/// the reason when it cannot be reached. Blocking; call it off the UI thread.
fn open_library_blocking(app: &AppHandle) -> Result<(), String> {
    let Some(origin) = server::load(app) else {
        navigate(app, shelf_url("view=setup"));
        return Err("No server address is saved yet.".into());
    };
    match server::probe(&origin) {
        Probe::Kaizoku | Probe::Unverified => {
            navigate(app, origin);
            Ok(())
        }
        Probe::NotKaizoku => Err(format!(
            "Something answers at {} but it is not Kaizoku.",
            server::display(&origin)
        )),
        Probe::Unreachable(why) => Err(format!(
            "Could not reach {} ({why}).",
            server::display(&origin)
        )),
    }
}

/// The saved server address, or null when none has been saved.
#[tauri::command]
fn get_server(app: AppHandle) -> Option<String> {
    server::load(&app).map(|origin| server::display(&origin))
}

/// Checks an address and saves it. Nothing is saved unless a Kaizoku server
/// answers there, so a typo is caught on the setup screen rather than as a
/// window that never loads.
#[tauri::command]
async fn set_server(app: AppHandle, address: String) -> Result<String, String> {
    let origin = server::normalize(&address).ok_or_else(|| {
        "That does not look like an address. Try something like 192.168.1.20:3000".to_string()
    })?;
    let probed = origin.clone();
    let probe = tauri::async_runtime::spawn_blocking(move || server::probe(&probed))
        .await
        .map_err(|error| error.to_string())?;
    match probe {
        Probe::Kaizoku | Probe::Unverified => {
            server::save(&app, &origin)?;
            Ok(server::display(&origin))
        }
        Probe::NotKaizoku => Err(format!(
            "Something answers at {} but it is not Kaizoku.",
            server::display(&origin)
        )),
        Probe::Unreachable(why) => Err(format!(
            "Could not reach {} ({why}).",
            server::display(&origin)
        )),
    }
}

/// Whether the saved server answers right now. `Err` carries the reason, in
/// words the shelf can show as they are.
#[tauri::command]
async fn check_server(app: AppHandle) -> Result<(), String> {
    let origin = server::load(&app).ok_or_else(|| "No server address is saved yet.".to_string())?;
    let probe = tauri::async_runtime::spawn_blocking(move || {
        let probe = server::probe(&origin);
        (origin, probe)
    })
    .await
    .map_err(|error| error.to_string())?;
    match probe {
        (_, Probe::Kaizoku | Probe::Unverified) => Ok(()),
        (origin, Probe::NotKaizoku) => Err(format!(
            "Something answers at {} but it is not Kaizoku.",
            server::display(&origin)
        )),
        (origin, Probe::Unreachable(why)) => Err(format!(
            "Could not reach {} ({why}).",
            server::display(&origin)
        )),
    }
}

/// Leaves the shelf for the server, if it answers.
#[tauri::command]
async fn open_library(app: AppHandle) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || open_library_blocking(&app))
        .await
        .map_err(|error| error.to_string())?
}

/// Decides every top-level navigation of the window.
///
/// The shelf and the saved server are the only two places the window goes.
/// A link to anywhere else opens in the default browser: letting the window
/// wander off to another site would leave the user in an app with no address
/// bar and no way back but the menu.
fn allow_navigation(app: &AppHandle, url: &Url) -> bool {
    if !matches!(url.scheme(), "http" | "https") || is_shelf(url) {
        return true;
    }
    match server::load(app) {
        Some(origin) if server::same_origin(&origin, url) => {
            if server::accepts_connections(&origin, NAVIGATION_CHECK) {
                return true;
            }
            // Cancel the navigation and show the shelf, rather than letting
            // WebView2 draw its own "can't reach this page". Navigating from
            // inside the navigation callback re-enters the webview, so hand it
            // to another thread.
            let app = app.clone();
            std::thread::spawn(move || navigate(&app, shelf_url("reason=unreachable")));
            false
        }
        _ => {
            server::open_in_browser(url);
            false
        }
    }
}

fn on_menu(app: &AppHandle, id: &str) {
    match id {
        "library" => {
            let app = app.clone();
            std::thread::spawn(move || {
                if open_library_blocking(&app).is_err() && server::load(&app).is_some() {
                    navigate(&app, shelf_url("reason=unreachable"));
                }
            });
        }
        "downloads" => navigate(app, shelf_url("view=shelf")),
        "change-server" => navigate(app, shelf_url("view=setup")),
        "reload" => {
            if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
                let _ = window.eval("window.location.reload()");
            }
        }
        _ => {}
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_server,
            set_server,
            check_server,
            open_library
        ])
        .setup(|app| {
            let library = MenuItemBuilder::with_id("library", "Library (server)").build(app)?;
            let downloads =
                MenuItemBuilder::with_id("downloads", "Downloads (offline)").build(app)?;
            let change =
                MenuItemBuilder::with_id("change-server", "Change server...").build(app)?;
            let reload = MenuItemBuilder::with_id("reload", "Reload").build(app)?;
            let kaizoku = SubmenuBuilder::new(app, "Kaizoku")
                .item(&library)
                .item(&downloads)
                .separator()
                .item(&change)
                .item(&reload)
                .build()?;
            let menu = MenuBuilder::new(app).item(&kaizoku).build()?;

            // The window is built here rather than in tauri.conf.json because
            // the navigation handler can only be attached to a builder.
            let handle = app.handle().clone();
            WebviewWindowBuilder::new(app, MAIN_WINDOW, WebviewUrl::App("index.html".into()))
                .title("Kaizoku")
                .inner_size(1440.0, 900.0)
                .min_inner_size(640.0, 480.0)
                .menu(menu)
                .on_navigation(move |url| allow_navigation(&handle, url))
                .build()?;
            Ok(())
        })
        .on_menu_event(|app, event| on_menu(app, event.id().as_ref()))
        .run(tauri::generate_context!())
        .expect("error while running Kaizoku");
}
