//! The server address: cleaning up what was typed, remembering it, and
//! finding out whether a Kaizoku server answers there.
//!
//! Everything here uses the standard library only. The probe is a dozen lines
//! of HTTP over a `TcpStream`, which is all a reachability check needs and
//! saves pulling an HTTP client into the installer.

use std::fs;
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream, ToSocketAddrs};
use std::path::PathBuf;
use std::time::Duration;

use tauri::{AppHandle, Manager, Url};

const CONNECT_TIMEOUT: Duration = Duration::from_secs(3);
const READ_TIMEOUT: Duration = Duration::from_secs(5);
/// The login page is about 9 KB. Reading stops here so a server that streams
/// forever cannot hold the probe open.
const MAX_RESPONSE: usize = 256 * 1024;

pub enum Probe {
    /// The login page came back and names Kaizoku.
    Kaizoku,
    /// Something answers, and it could not be checked further: an `https`
    /// address (no TLS here) or a redirect. Accepted, because refusing a
    /// working server is worse than accepting an unverified one; the window
    /// shows what is there either way.
    Unverified,
    /// Something answers and it is some other web server.
    NotKaizoku,
    Unreachable(String),
}

/// Cleans up what somebody typed into the address field.
///
/// Accepts `192.168.1.20:3000` as readily as a full URL, because that is
/// what people type. Only the origin is kept: a pasted
/// `http://host:3000/library` means the server at `host:3000`.
pub fn normalize(input: &str) -> Option<Url> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return None;
    }
    let with_scheme = if trimmed.contains("://") {
        trimmed.to_string()
    } else {
        format!("http://{trimmed}")
    };
    let url = Url::parse(&with_scheme).ok()?;
    if !matches!(url.scheme(), "http" | "https") {
        return None;
    }
    let host = url.host_str()?;
    let origin = match url.port() {
        Some(port) => format!("{}://{}:{}/", url.scheme(), host, port),
        None => format!("{}://{}/", url.scheme(), host),
    };
    Url::parse(&origin).ok()
}

/// The origin as people write it: no trailing slash.
pub fn display(origin: &Url) -> String {
    origin.as_str().trim_end_matches('/').to_string()
}

pub fn same_origin(a: &Url, b: &Url) -> bool {
    a.scheme() == b.scheme()
        && a.host_str() == b.host_str()
        && a.port_or_known_default() == b.port_or_known_default()
}

/// One line of text in the app's config directory. It is an address, not a
/// secret, and a file a person can read and fix beats a store that needs a
/// tool to open.
fn file(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join("server.txt"))
}

pub fn load(app: &AppHandle) -> Option<Url> {
    let text = fs::read_to_string(file(app)?).ok()?;
    normalize(&text)
}

pub fn save(app: &AppHandle, origin: &Url) -> Result<(), String> {
    let path = file(app).ok_or_else(|| "No config directory is available.".to_string())?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|error| error.to_string())?;
    }
    fs::write(&path, display(origin)).map_err(|error| error.to_string())
}

fn resolve(origin: &Url) -> Result<SocketAddr, String> {
    let host = origin.host_str().ok_or("no host in the address")?;
    let port = origin
        .port_or_known_default()
        .ok_or("no port in the address")?;
    (host, port)
        .to_socket_addrs()
        .map_err(|_| format!("the name {host} could not be looked up"))?
        .next()
        .ok_or_else(|| format!("the name {host} has no address"))
}

/// Whether anything accepts a connection at the address, within `timeout`.
/// The cheap check, for use where a full probe would be too slow.
pub fn accepts_connections(origin: &Url, timeout: Duration) -> bool {
    resolve(origin)
        .ok()
        .is_some_and(|address| TcpStream::connect_timeout(&address, timeout).is_ok())
}

/// Asks for the login page and looks for Kaizoku's name in it.
pub fn probe(origin: &Url) -> Probe {
    let address = match resolve(origin) {
        Ok(address) => address,
        Err(why) => return Probe::Unreachable(why),
    };
    let mut stream = match TcpStream::connect_timeout(&address, CONNECT_TIMEOUT) {
        Ok(stream) => stream,
        Err(error) => return Probe::Unreachable(describe(&error)),
    };
    if origin.scheme() == "https" {
        return Probe::Unverified;
    }

    let _ = stream.set_read_timeout(Some(READ_TIMEOUT));
    let _ = stream.set_write_timeout(Some(READ_TIMEOUT));
    let host = match origin.port() {
        Some(port) => format!("{}:{}", origin.host_str().unwrap_or_default(), port),
        None => origin.host_str().unwrap_or_default().to_string(),
    };
    let request = format!(
        "GET /login HTTP/1.1\r\nHost: {host}\r\nAccept: text/html\r\nConnection: close\r\n\r\n"
    );
    if let Err(error) = stream.write_all(request.as_bytes()) {
        return Probe::Unreachable(describe(&error));
    }

    let mut response = Vec::new();
    let mut chunk = [0u8; 8192];
    while response.len() < MAX_RESPONSE {
        match stream.read(&mut chunk) {
            Ok(0) => break,
            Ok(read) => {
                response.extend_from_slice(&chunk[..read]);
                // Stop as soon as the answer is known. The server does not
                // close the connection when asked to, so reading to the end
                // means sitting out the whole read timeout on every start.
                if is_complete(&response) {
                    break;
                }
            }
            // A timeout after some bytes arrived still leaves a response to
            // judge; with none, the server accepted and then said nothing.
            Err(error) if response.is_empty() => return Probe::Unreachable(describe(&error)),
            Err(_) => break,
        }
    }

    let text = String::from_utf8_lossy(&response);
    let status = text
        .strip_prefix("HTTP/1.")
        .and_then(|rest| rest.split_whitespace().nth(1))
        .and_then(|code| code.parse::<u16>().ok());
    match status {
        Some(200..=299) if text.contains("Kaizoku") => Probe::Kaizoku,
        // A fresh install sends /login to /setup before any page names itself.
        Some(300..=399) => Probe::Unverified,
        _ => Probe::NotKaizoku,
    }
}

/// True once enough of the response has arrived to judge it: Kaizoku's name
/// has been seen, or the headers are in and the body they announce is too.
fn is_complete(response: &[u8]) -> bool {
    let text = String::from_utf8_lossy(response);
    if text.contains("Kaizoku") {
        return true;
    }
    let Some(headers_end) = text.find("\r\n\r\n") else {
        return false;
    };
    let headers = &text[..headers_end];
    // A redirect or an error is judged on its status line alone.
    if !headers.starts_with("HTTP/1.1 2") && !headers.starts_with("HTTP/1.0 2") {
        return true;
    }
    headers
        .lines()
        .find_map(|line| {
            let (name, value) = line.split_once(':')?;
            name.eq_ignore_ascii_case("content-length")
                .then(|| value.trim().parse::<usize>().ok())?
        })
        .is_some_and(|length| response.len() >= headers_end + 4 + length)
}

fn describe(error: &std::io::Error) -> String {
    use std::io::ErrorKind;
    match error.kind() {
        ErrorKind::ConnectionRefused => "nothing is listening on that port".into(),
        ErrorKind::TimedOut | ErrorKind::WouldBlock => "no answer in time".into(),
        _ => error.to_string(),
    }
}

/// Hands a link to the default browser.
///
/// `rundll32 url.dll,FileProtocolHandler` takes the URL as one argument and
/// involves no shell, so nothing in the URL is interpreted as a command.
/// `cmd /c start` would parse `&` and `^`.
pub fn open_in_browser(url: &Url) {
    #[cfg(windows)]
    {
        let _ = std::process::Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", url.as_str()])
            .spawn();
    }
    #[cfg(not(windows))]
    {
        let _ = url;
    }
}
