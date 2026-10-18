"""
Discord Group & Server Cleaner - Backend & Local Web Server
Runs locally, with automatic token detection from local Discord / browsers.
"""

import sys
import io

# Ensure UTF-8 output on Windows consoles
if sys.platform == "win32":
    if hasattr(sys.stdout, "buffer"):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "buffer"):
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import http.server
import socketserver
import urllib.request
import urllib.error
import json
import os
import time
import socket
import threading
import webbrowser
import base64
import ctypes
import glob
import re
from datetime import datetime, timezone
from ctypes import wintypes

PORT = 5055
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.join(BASE_DIR, "web")

# Global state
CURRENT_SESSION = {
    "token": None,
    "user": None,
    "groups": [],
    "guilds": []
}

TASK_STATE = {
    "running": False,
    "stop_requested": False,
    "total": 0,
    "current": 0,
    "current_name": "",
    "success_count": 0,
    "error_count": 0,
    "status": "idle", # "idle", "running", "completed", "stopped"
    "logs": []
}

def log_event(level: str, text: str):
    timestamp = datetime.now().strftime("%H:%M:%S")
    entry = {"level": level, "text": text, "time": timestamp}
    TASK_STATE["logs"].append(entry)
    if len(TASK_STATE["logs"]) > 500:
        TASK_STATE["logs"] = TASK_STATE["logs"][-500:]
    print(f"[{timestamp}] [{level.upper()}] {text}")

def snowflake_to_timestamp(snowflake_str):
    if not snowflake_str:
        return None
    try:
        sf = int(snowflake_str)
        ms = (sf >> 22) + 1420070400000
        return ms / 1000.0
    except Exception:
        return None

def format_timestamp(ts):
    if not ts:
        return "Неизвестно"
    try:
        dt = datetime.fromtimestamp(ts)
        return dt.strftime("%d.%m.%Y %H:%M")
    except Exception:
        return "Неизвестно"

def discord_request(endpoint: str, token: str, method: str = "GET", data: dict = None):
    url = f"https://discord.com/api/v9/{endpoint.lstrip('/')}"
    headers = {
        "Authorization": token.strip("\"' "),
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
    }
    
    payload = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=payload, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode("utf-8")
            return {
                "status": resp.status,
                "data": json.loads(body) if body else {}
            }
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        try:
            err_json = json.loads(body)
        except Exception:
            err_json = {"raw": body}
        return {
            "status": e.code,
            "error": err_json
        }
    except Exception as e:
        return {
            "status": 0,
            "error": {"message": str(e)}
        }

def find_local_discord_tokens():
    """Extract and validate Discord tokens from local installations."""
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    except ImportError:
        return []

    appdata = os.getenv('APPDATA')
    localappdata = os.getenv('LOCALAPPDATA', '')
    if not appdata:
        return []

    search_dirs = [
        os.path.join(appdata, 'discord'),
        os.path.join(appdata, 'discordcanary'),
        os.path.join(appdata, 'discordptb'),
        os.path.join(localappdata, 'Google', 'Chrome', 'User Data', 'Default'),
        os.path.join(localappdata, 'Microsoft', 'Edge', 'User Data', 'Default'),
        os.path.join(localappdata, 'Yandex', 'YandexBrowser', 'User Data', 'Default'),
        os.path.join(appdata, 'Opera Software', 'Opera Stable'),
    ]

    candidate_tokens = []

    for s_path in search_dirs:
        local_state_path = os.path.join(s_path, 'Local State')
        if not os.path.exists(local_state_path):
            parent_ls = os.path.join(os.path.dirname(s_path), 'Local State')
            if os.path.exists(parent_ls):
                local_state_path = parent_ls
            else:
                continue

        try:
            with open(local_state_path, 'r', encoding='utf-8') as f:
                local_state = json.load(f)
            encrypted_key = base64.b64decode(local_state['os_crypt']['encrypted_key'])[5:]

            class DATA_BLOB(ctypes.Structure):
                _fields_ = [('cbData', wintypes.DWORD), ('pbData', ctypes.POINTER(ctypes.c_char))]

            blob_in = DATA_BLOB(len(encrypted_key), ctypes.create_string_buffer(encrypted_key))
            blob_out = DATA_BLOB()

            if ctypes.windll.crypt32.CryptUnprotectData(ctypes.byref(blob_in), None, None, None, None, 0, ctypes.byref(blob_out)):
                master_key = ctypes.string_at(blob_out.pbData, blob_out.cbData)
                ctypes.windll.kernel32.LocalFree(blob_out.pbData)

                leveldb_path = os.path.join(s_path, 'Local Storage', 'leveldb')
                if not os.path.exists(leveldb_path):
                    continue

                for f_path in glob.glob(os.path.join(leveldb_path, '*.ldb')) + glob.glob(os.path.join(leveldb_path, '*.log')):
                    try:
                        with open(f_path, 'r', encoding='utf-8', errors='ignore') as f:
                            content = f.read()
                            for enc_match in re.findall(r'dQw4w9WgXcQ:[^\"]*', content):
                                enc_clean = enc_match.split('dQw4w9WgXcQ:')[1].rstrip('\\').rstrip('"')
                                enc_bytes = base64.b64decode(enc_clean)
                                iv = enc_bytes[3:15]
                                payload = enc_bytes[15:]
                                aesgcm = AESGCM(master_key)
                                decrypted = aesgcm.decrypt(iv, payload, None).decode('utf-8', errors='ignore')
                                if decrypted and decrypted not in candidate_tokens:
                                    candidate_tokens.append(decrypted)
                    except Exception:
                        pass
        except Exception:
            pass

    # Verify each found token against Discord API
    valid_accounts = []
    seen_user_ids = set()
    for tok in candidate_tokens:
        res = discord_request("users/@me", tok)
        if res.get("status") == 200:
            user_data = res.get("data", {})
            u_id = user_data.get("id")
            if u_id not in seen_user_ids:
                seen_user_ids.add(u_id)
                avatar_hash = user_data.get("avatar")
                if avatar_hash:
                    avatar_url = f"https://cdn.discordapp.com/avatars/{u_id}/{avatar_hash}.png?size=128"
                else:
                    avatar_url = "https://cdn.discordapp.com/embed/avatars/0.png"
                
                valid_accounts.append({
                    "token": tok,
                    "id": u_id,
                    "username": user_data.get("username"),
                    "global_name": user_data.get("global_name") or user_data.get("username"),
                    "avatar_url": avatar_url
                })

    return valid_accounts

def process_leave_task(items: list, delay_sec: float, token: str):
    TASK_STATE["running"] = True
    TASK_STATE["stop_requested"] = False
    TASK_STATE["total"] = len(items)
    TASK_STATE["current"] = 0
    TASK_STATE["success_count"] = 0
    TASK_STATE["error_count"] = 0
    TASK_STATE["status"] = "running"
    
    log_event("info", f"Начало процесса выхода. Всего элементов: {len(items)}, задержка: {delay_sec} сек.")

    for index, item in enumerate(items, start=1):
        if TASK_STATE["stop_requested"]:
            log_event("warning", "Процесс выхода был остановлен пользователем.")
            TASK_STATE["status"] = "stopped"
            break
        
        TASK_STATE["current"] = index
        TASK_STATE["current_name"] = item.get("name", "Без названия")
        item_id = item["id"]
        item_type = item["type"]
        item_name = item.get("name", item_id)
        is_owner = item.get("is_owner", False)
        delete_owned = item.get("delete_owned", False)

        retries = 3
        while retries > 0 and not TASK_STATE["stop_requested"]:
            if item_type in ("group", "dm"):
                res = discord_request(f"channels/{item_id}?silent=false", token, method="DELETE")
            else:
                if is_owner:
                    if delete_owned:
                        res = discord_request(f"guilds/{item_id}", token, method="DELETE")
                    else:
                        res = {
                            "status": 400,
                            "error": {"message": "Вы владелец этого сервера. Чтобы удалить его, подтвердите удаление серверов владельца."}
                        }
                else:
                    res = discord_request(f"users/@me/guilds/{item_id}", token, method="DELETE")

            status = res.get("status")
            
            if status == 429:
                err_data = res.get("error", {})
                retry_after = float(err_data.get("retry_after", 3.0))
                log_event("warning", f"Rate limit от Discord. Ожидание {retry_after + 1:.1f} сек...")
                time.sleep(retry_after + 1.0)
                retries -= 1
                continue

            if status in (200, 204):
                if item_type == "guild" and is_owner:
                    action_text = "Удален сервер (владелец)"
                elif item_type == "guild":
                    action_text = "Покинут сервер"
                elif item_type == "dm":
                    action_text = "Закрыт личный диалог"
                else:
                    action_text = "Покинут групповой чат"
                log_event("success", f"[{index}/{len(items)}] {action_text}: \"{item_name}\"")
                TASK_STATE["success_count"] += 1
                break
            else:
                err_msg = res.get("error", {}).get("message", f"HTTP {status}")
                log_event("error", f"[{index}/{len(items)}] Ошибка при обработке \"{item_name}\": {err_msg}")
                TASK_STATE["error_count"] += 1
                break

        if index < len(items) and not TASK_STATE["stop_requested"]:
            time.sleep(delay_sec)

    if not TASK_STATE["stop_requested"]:
        TASK_STATE["status"] = "completed"
        log_event("info", f"Завершено! Успешно: {TASK_STATE['success_count']}, Ошибок: {TASK_STATE['error_count']}")
    
    TASK_STATE["running"] = False


class CleanerHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def do_GET(self):
        if self.path == "/api/status":
            self.send_json_response({
                "task": TASK_STATE,
                "user": CURRENT_SESSION["user"],
                "has_token": bool(CURRENT_SESSION["token"])
            })
            return

        if self.path == "/api/detected-accounts":
            # Auto-detect tokens from local PC
            accounts = find_local_discord_tokens()
            self.send_json_response({
                "success": True,
                "accounts": accounts
            })
            return

        if self.path == "/api/data":
            if not CURRENT_SESSION["token"]:
                self.send_json_response({"success": False, "error": "Не авторизован"}, status=401)
                return
            
            token = CURRENT_SESSION["token"]
            
            # Fetch channels (1-on-1 DMs and Group DMs)
            ch_res = discord_request("users/@me/channels", token)
            dms = []
            groups = []
            if ch_res.get("status") == 200:
                user_id = CURRENT_SESSION["user"]["id"]
                raw_channels = ch_res.get("data", [])
                for ch in raw_channels:
                    ch_type = ch.get("type")
                    ch_id = ch["id"]
                    recipients = ch.get("recipients", [])
                    last_msg_id = ch.get("last_message_id")
                    last_ts = snowflake_to_timestamp(last_msg_id)
                    last_time_str = format_timestamp(last_ts)

                    # Type 1: Direct Message (1-on-1 DM)
                    if ch_type == 1:
                        target_user = recipients[0] if recipients else {}
                        u_name = target_user.get("username", "Пользователь")
                        g_name = target_user.get("global_name") or u_name
                        u_avatar = target_user.get("avatar")
                        u_id = target_user.get("id", "")
                        if u_avatar and u_id:
                            avatar_url = f"https://cdn.discordapp.com/avatars/{u_id}/{u_avatar}.png?size=128"
                        else:
                            avatar_url = "https://cdn.discordapp.com/embed/avatars/0.png"

                        dms.append({
                            "id": ch_id,
                            "type": "dm",
                            "name": g_name,
                            "username": u_name,
                            "user_id": u_id,
                            "avatar_url": avatar_url,
                            "last_message_id": last_msg_id,
                            "last_activity_ts": last_ts,
                            "last_activity_str": last_time_str
                        })

                    # Type 3: Group DM
                    elif ch_type == 3:
                        custom_name = ch.get("name")
                        if custom_name and custom_name.strip():
                            display_name = custom_name.strip()
                        else:
                            names = [r.get("global_name") or r.get("username") for r in recipients]
                            display_name = ", ".join(filter(None, names)) or "Групповой чат"
                        
                        icon_hash = ch.get("icon")
                        icon_url = f"https://cdn.discordapp.com/channel-icons/{ch_id}/{icon_hash}.png?size=128" if icon_hash else None

                        groups.append({
                            "id": ch_id,
                            "name": display_name,
                            "type": "group",
                            "icon_url": icon_url,
                            "recipients_count": len(recipients) + 1,
                            "recipients": [r.get("global_name") or r.get("username") for r in recipients],
                            "owner_id": ch.get("owner_id"),
                            "is_owner": ch.get("owner_id") == user_id,
                            "last_message_id": last_msg_id,
                            "last_activity_ts": last_ts,
                            "last_activity_str": last_time_str
                        })

                # Sort by last activity descending (most recent first)
                dms.sort(key=lambda d: d["last_activity_ts"] or 0, reverse=True)
                groups.sort(key=lambda g: g["last_activity_ts"] or 0, reverse=True)

            # 2. Fetch Guilds
            guild_res = discord_request("users/@me/guilds?with_counts=true", token)
            guilds = []
            if guild_res.get("status") == 200:
                raw_guilds = guild_res.get("data", [])
                for g in raw_guilds:
                    g_id = g["id"]
                    icon_hash = g.get("icon")
                    icon_url = f"https://cdn.discordapp.com/icons/{g_id}/{icon_hash}.png?size=128" if icon_hash else None

                    guilds.append({
                        "id": g_id,
                        "name": g.get("name", "Без названия"),
                        "type": "guild",
                        "icon_url": icon_url,
                        "is_owner": bool(g.get("owner", False)),
                        "approx_members": g.get("approximate_member_count"),
                        "permissions": g.get("permissions")
                    })
                
                guilds.sort(key=lambda g: (not g["is_owner"], g["name"].lower()))

            CURRENT_SESSION["dms"] = dms
            CURRENT_SESSION["groups"] = groups
            CURRENT_SESSION["guilds"] = guilds

            self.send_json_response({
                "success": True,
                "dms": dms,
                "groups": groups,
                "guilds": guilds
            })
            return

        return super().do_GET()

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length)
        try:
            body = json.loads(post_data.decode("utf-8")) if post_data else {}
        except Exception:
            body = {}

        if self.path == "/api/login":
            token = body.get("token", "").strip("\"' ")
            if not token:
                self.send_json_response({"success": False, "error": "Токен не указан"}, status=400)
                return

            res = discord_request("users/@me", token)
            if res.get("status") == 200:
                user_data = res.get("data", {})
                user_id = user_data.get("id")
                avatar_hash = user_data.get("avatar")
                if avatar_hash:
                    avatar_url = f"https://cdn.discordapp.com/avatars/{user_id}/{avatar_hash}.png?size=128"
                else:
                    avatar_url = "https://cdn.discordapp.com/embed/avatars/0.png"

                user_info = {
                    "id": user_id,
                    "username": user_data.get("username"),
                    "global_name": user_data.get("global_name") or user_data.get("username"),
                    "avatar_url": avatar_url
                }

                CURRENT_SESSION["token"] = token
                CURRENT_SESSION["user"] = user_info
                
                log_event("info", f"Успешный вход в аккаунт: {user_info['global_name']} (@{user_info['username']})")
                self.send_json_response({"success": True, "user": user_info})
            else:
                err_msg = res.get("error", {}).get("message", "Неверный токен или ошибка авторизации Discord (401)")
                self.send_json_response({"success": False, "error": err_msg}, status=401)
            return

        if self.path == "/api/leave":
            if not CURRENT_SESSION["token"]:
                self.send_json_response({"success": False, "error": "Не авторизован"}, status=401)
                return

            if TASK_STATE["running"]:
                self.send_json_response({"success": False, "error": "Процесс очистки уже запущен!"}, status=400)
                return

            items = body.get("items", [])
            delay = float(body.get("delay", 1.5))
            if delay < 0.5:
                delay = 0.5

            if not items:
                self.send_json_response({"success": False, "error": "Не выбрано ни одной группы или сервера"}, status=400)
                return

            thread = threading.Thread(
                target=process_leave_task,
                args=(items, delay, CURRENT_SESSION["token"]),
                daemon=True
            )
            thread.start()

            self.send_json_response({"success": True, "message": "Процесс запущен"})
            return

        if self.path == "/api/stop":
            if TASK_STATE["running"]:
                TASK_STATE["stop_requested"] = True
                log_event("warning", "Получен сигнал остановки процесса...")
                self.send_json_response({"success": True, "message": "Остановка запрошена"})
            else:
                self.send_json_response({"success": True, "message": "Процесс не был активен"})
            return

        if self.path == "/api/logout":
            CURRENT_SESSION["token"] = None
            CURRENT_SESSION["user"] = None
            CURRENT_SESSION["groups"] = []
            CURRENT_SESSION["guilds"] = []
            self.send_json_response({"success": True})
            return

        self.send_json_response({"error": "Not Found"}, status=404)

    def send_json_response(self, data: dict, status: int = 200):
        response_bytes = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response_bytes)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(response_bytes)

    def log_message(self, format, *args):
        pass

def find_available_port(start_port=5055):
    port = start_port
    while port < start_port + 100:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", port)) != 0:
                return port
            port += 1
    return start_port

def main():
    port = find_available_port(PORT)
    server_address = ("127.0.0.1", port)
    
    print("=" * 60)
    print("  [+] Discord Group & Server Cleaner")
    print(f"  [>] Server started at: http://127.0.0.1:{port}")
    print("  [*] Opening interface in your default browser...")
    print("  (Press Ctrl + C to stop the server)")
    print("=" * 60)

    threading.Timer(1.0, lambda: webbrowser.open(f"http://127.0.0.1:{port}")).start()

    httpd = socketserver.TCPServer(server_address, CleanerHTTPRequestHandler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nСервер остановлен.")
    finally:
        httpd.server_close()

if __name__ == "__main__":
    main()
