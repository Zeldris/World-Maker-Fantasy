# Copiado de galivelop-image-generator (MIT), ver image-generator/interfaz/ui/LICENSE-GVIG. Cambio: GIMG_TEST_* pasa a WMF_TEST_*.
"""A minimal browser driver on the standard library (D6): a hand-made websocket over ``socket``, a headless launcher and
a collector of everything the page reports as wrong (exceptions, console errors, CSP violations and failed loads).
Two protocols behind one API (``Browser``, ``Page``): Chrome over the DevTools protocol (CDP) and Firefox over
WebDriver BiDi. Used by ``test_interfaz_ui.py`` (IMG-41).

Which browser (``find_browser()`` returns ``(kind, command)``, ``kind`` being ``"firefox"`` or ``"chrome"``, or ``None``
and the tests then skip), in order: ``WMF_TEST_BROWSER`` (a full command, split with ``shlex``; the kind comes from its
text), ``WMF_TEST_CHROME`` (legacy: a Chrome command), the system's default browser (``xdg-settings``/``xdg-mime``,
through ``flatpak-spawn --host`` inside a flatpak sandbox) when it is Firefox or Chrome/Chromium, else whichever of
Firefox or Chrome is installed (PATH or the host's flatpak).
"""
import base64
import json
import os
import re
import select
import shlex
import shutil
import signal
import socket
import struct
import subprocess
import tempfile
import threading
import time


def _sandboxed():
    return os.path.exists("/.flatpak-info") or bool(os.environ.get("FLATPAK_ID"))


def _host(argv):
    """``argv`` prefixed to run on the host when we live inside a flatpak sandbox."""
    return ["flatpak-spawn", "--host"] + argv if _sandboxed() and shutil.which("flatpak-spawn") else argv


def _run(argv):
    try:
        done = subprocess.run(argv, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, timeout=20)
    except (OSError, subprocess.SubprocessError):
        return None
    return done.stdout.strip() if done.returncode == 0 else None


def kind_of(text):
    """``"firefox"`` / ``"chrome"`` for a desktop file name or a command, ``None`` when it is neither."""
    t = text.lower()
    if "firefox" in t:
        return "firefox"
    if "chrome" in t or "chromium" in t:
        return "chrome"
    return None


def default_desktop():
    """The desktop file of the system's default web browser (``org.mozilla.firefox.desktop``) or ``None``."""
    for argv in (["xdg-settings", "get", "default-web-browser"],
                 ["xdg-mime", "query", "default", "x-scheme-handler/http"]):
        out = _run(_host(argv))
        if out:
            return out.splitlines()[0]
    return None


def _flatpak_has(app):
    return bool(shutil.which("flatpak") or (_sandboxed() and shutil.which("flatpak-spawn"))) and \
        _run(_host(["flatpak", "info", app])) is not None


def find_firefox():
    path = shutil.which("firefox")
    if path:
        return [path]
    if _flatpak_has("org.mozilla.firefox"):
        return _host(["flatpak", "run", "org.mozilla.firefox"])
    return None


def find_chrome():
    custom = os.environ.get("WMF_TEST_CHROME", "").strip()
    if custom:
        return shlex.split(custom)
    for name in ("google-chrome", "chromium", "chromium-browser", "google-chrome-stable"):
        path = shutil.which(name)
        if path:
            return [path]
    if _flatpak_has("com.google.Chrome"):
        return _host(["flatpak", "run", "com.google.Chrome"])
    return None


def find_browser():
    custom = os.environ.get("WMF_TEST_BROWSER", "").strip()
    if custom:
        return (kind_of(custom) or "chrome"), shlex.split(custom)
    if os.environ.get("WMF_TEST_CHROME", "").strip():
        return "chrome", shlex.split(os.environ["WMF_TEST_CHROME"])
    finders = {"firefox": find_firefox, "chrome": find_chrome}
    wanted = kind_of(default_desktop() or "")
    for kind in ([wanted] if wanted else []) + ["firefox", "chrome"]:
        command = finders[kind]()
        if command:
            return kind, command
    return None


def scratch_dir(prefix):
    """A fresh temporary folder that is never in a small tmpfs: ``WMF_TEST_TMP``, else ``~/.cache/wmf-tests``
    (Chrome and the test data can weigh hundreds of MB and /tmp is often a 1.5 GB tmpfs)."""
    base = os.environ.get("WMF_TEST_TMP", "").strip() or os.path.join(os.path.expanduser("~"), ".cache", "wmf-tests")
    os.makedirs(base, exist_ok=True)
    return tempfile.mkdtemp(prefix=prefix, dir=base)


class CdpError(Exception):
    pass


class WebSocket:
    """Client side of RFC 6455 for text messages: masked frames out, fragments in."""

    def __init__(self, url, timeout=30):
        m = re.match(r"ws://([^/:]+):(\d+)(/.*)$", url)
        if not m:
            raise CdpError("bad websocket url: %s" % url)
        host, port, path = m.group(1), int(m.group(2)), m.group(3)
        self.sock = socket.create_connection((host, port), timeout=timeout)
        key = base64.b64encode(os.urandom(16)).decode()
        self.sock.sendall(("GET %s HTTP/1.1\r\nHost: %s:%d\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                           "Sec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n" % (path, host, port, key)).encode())
        head = b""
        while b"\r\n\r\n" not in head:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise CdpError("websocket closed during the handshake")
            head += chunk
        head, self.buf = head.split(b"\r\n\r\n", 1)
        if b" 101 " not in head.split(b"\r\n")[0]:
            raise CdpError("handshake refused: %r" % head[:200])

    def _read(self, n):
        while len(self.buf) < n:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise CdpError("websocket closed")
            self.buf += chunk
        out, self.buf = self.buf[:n], self.buf[n:]
        return out

    def send(self, text):
        data = text.encode()
        n = len(data)
        head = bytearray([0x81])
        if n < 126:
            head.append(0x80 | n)
        elif n < 65536:
            head.append(0x80 | 126)
            head += struct.pack(">H", n)
        else:
            head.append(0x80 | 127)
            head += struct.pack(">Q", n)
        mask = os.urandom(4)
        head += mask
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(data)) if n < 4096 else _xor(data, mask)
        self.sock.sendall(bytes(head) + masked)

    def recv(self):
        """The next complete text message (None when the peer closed)."""
        message = b""
        while True:
            b0, b1 = self._read(2)
            opcode, n = b0 & 0x0F, b1 & 0x7F
            if n == 126:
                n = struct.unpack(">H", self._read(2))[0]
            elif n == 127:
                n = struct.unpack(">Q", self._read(8))[0]
            mask = self._read(4) if b1 & 0x80 else None
            payload = self._read(n)
            if mask:
                payload = _xor(payload, mask)
            if opcode == 0x8:
                return None
            if opcode in (0x9, 0xA):  # ping / pong: Chrome's DevTools server sends neither in practice
                continue
            message += payload
            if b0 & 0x80:  # FIN
                return message.decode()

    def readable(self, timeout):
        """True when a message may be waiting (data buffered or arriving within ``timeout``)."""
        if self.buf:
            return True
        return bool(select.select([self.sock], [], [], max(0, timeout))[0])

    def close(self):
        try:
            self.sock.close()
        except OSError:
            pass


def _xor(data, mask):
    key = (mask * (len(data) // 4 + 1))[:len(data)]
    return (int.from_bytes(data, "big") ^ int.from_bytes(key, "big")).to_bytes(len(data), "big") if data else b""


class CdpPage:
    """One Chrome tab: ``evaluate`` runs JS (awaiting promises) and returns the value; ``problems`` lists what went wrong."""

    def __init__(self, ws, session, problems):
        self.ws, self.session, self.problems = ws, session, problems
        self.next_id = 0
        self.events = []

    def call(self, method, params=None, timeout=30):
        self.next_id += 1
        mid = self.next_id
        self.ws.send(json.dumps({"id": mid, "method": method, "params": params or {}, "sessionId": self.session}))
        deadline = time.time() + timeout
        self.ws.sock.settimeout(timeout)
        while time.time() < deadline:
            raw = self.ws.recv()
            if raw is None:
                raise CdpError("browser closed")
            msg = json.loads(raw)
            if msg.get("id") == mid:
                if "error" in msg:
                    raise CdpError("%s: %s" % (method, msg["error"]))
                return msg.get("result", {})
            self._event(msg)
        raise CdpError("timeout waiting for %s" % method)

    def _event(self, msg):
        method, p = msg.get("method"), msg.get("params", {})
        if method == "Runtime.exceptionThrown":
            d = p["exceptionDetails"]
            self.problems.append("exception: %s" % ((d.get("exception") or {}).get("description") or d.get("text")))
        elif method == "Runtime.consoleAPICalled" and p.get("type") == "error":
            self.problems.append("console.error: %s" % " ".join(str(a.get("value", a.get("description", ""))) for a in p["args"]))
        elif method == "Log.entryAdded" and p["entry"].get("level") == "error":
            e = p["entry"]
            self.problems.append("log: %s %s" % (e.get("text"), e.get("url", "")))

    def pump(self, seconds=0.2):
        """Reads pending events for a moment (so problems that arrive after an action are noticed)."""
        end = time.time() + seconds
        while time.time() < end:
            if not self.ws.readable(end - time.time()):
                return
            self.ws.sock.settimeout(30)
            raw = self.ws.recv()
            if raw is None:
                return
            self._event(json.loads(raw))

    def evaluate(self, expression, timeout=30):
        res = self.call("Runtime.evaluate", {"expression": expression, "awaitPromise": True, "returnByValue": True,
                                             "userGesture": True}, timeout)
        if "exceptionDetails" in res:
            d = res["exceptionDetails"]
            raise CdpError("evaluate failed: %s" % ((d.get("exception") or {}).get("description") or d.get("text")))
        return res["result"].get("value")

    def goto(self, url):
        self.call("Page.navigate", {"url": url})
        self.wait("document.readyState === 'complete'")

    def wait(self, expression, timeout=15, step=0.1):
        """Waits until ``expression`` is truthy; returns its value."""
        end = time.time() + timeout
        last = None
        while time.time() < end:
            last = self.evaluate("(() => { try { return !!(%s) } catch (e) { return false } })()" % expression)
            if last:
                self.pump(0.05)
                return last
            self.pump(step)
        raise CdpError("timeout waiting for: %s (last %r)" % (expression, last))

    def key(self, key, **mods):
        """A real keyboard event through the protocol (``key`` is a DOM key name such as ``ArrowLeft`` or ``s``)."""
        text = key if len(key) == 1 else {"Enter": "\r"}.get(key, "")  # Chrome activates a button only on Enter's char
        params = {"key": key, "text": text, "windowsVirtualKeyCode": _VK.get(key, ord(key.upper()) if len(key) == 1 else 0),
                  "code": _CODE.get(key, "Key" + key.upper() if len(key) == 1 else key),
                  "modifiers": sum({"alt": 1, "ctrl": 2, "meta": 4, "shift": 8}[m] for m, v in mods.items() if v)}
        self.call("Input.dispatchKeyEvent", dict(params, type="keyDown" if text else "rawKeyDown"))
        self.call("Input.dispatchKeyEvent", dict(params, type="keyUp"))
        self.pump(0.1)


_VK = {"ArrowLeft": 37, "ArrowUp": 38, "ArrowRight": 39, "ArrowDown": 40, "Enter": 13, "Escape": 27, "Tab": 9}
_CODE = {"Enter": "Enter", "Escape": "Escape", "Tab": "Tab"}


class CdpBrowser:
    """Headless Chrome over CDP."""

    def __init__(self, command=None, lang=None):
        # the UI takes its language from `navigator.languages`: pinned, so the run does not depend on the machine's
        # locale (the CI runner is in English and the tests look buttons up by their Spanish text)
        lang = lang or os.environ.get("WMF_TEST_LANG") or "es"
        self.command = command or find_chrome()
        if not self.command:
            raise CdpError("no browser")
        self.profile = scratch_dir("wmf-chrome-")
        self.problems = []
        self.pages = []
        self.ws = None
        self.proc = None
        try:
            args = self.command + ["--headless=new", "--no-sandbox", "--disable-gpu", "--no-first-run",
                                   "--disable-extensions", "--disable-dev-shm-usage", "--disk-cache-size=1", "--disable-gpu-shader-disk-cache",
                                   "--lang=" + lang, "--accept-lang=" + lang,
                                   "--remote-debugging-port=0", "--user-data-dir=" + self.profile, "about:blank"]
            # Chrome's temporaries go inside the profile, so close() removes them too (the shared 1.5 GB tmpfs of the
            # Deck filled up on 2026-11-05 with what a flatpak Chrome left in its own temporary folder).
            tmp = os.path.join(self.profile, "tmp")
            os.makedirs(tmp, exist_ok=True)
            env = dict(os.environ, TMPDIR=tmp)
            self.proc = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True,
                                         start_new_session=True, env=env)
            self.ws_url = self._find_ws_url()
            self.ws = WebSocket(self.ws_url)
        except BaseException:
            self.close()
            raise

    def _find_ws_url(self):
        # Chrome prints «DevTools listening on ws://...» on stderr; the DevToolsActivePort file in the profile is the
        # fallback (under a flatpak/host browser the profile may live in another filesystem, so stderr comes first).
        found = []

        def reader():
            for line in self.proc.stderr:
                m = re.search(r"DevTools listening on (ws://\S+)", line)
                if m:
                    found.append(m.group(1))

        threading.Thread(target=reader, daemon=True).start()
        end = time.time() + 30
        active = os.path.join(self.profile, "DevToolsActivePort")
        while time.time() < end:
            if found:
                return found[0]
            if os.path.exists(active):
                lines = open(active).read().split()
                if len(lines) >= 2:
                    return "ws://127.0.0.1:%s%s" % (lines[0], lines[1])
            if self.proc.poll() is not None:
                raise CdpError("the browser exited (%s)" % self.proc.returncode)
            time.sleep(0.1)
        raise CdpError("the browser did not report its DevTools address")

    def new_page(self, width=1280, height=900):
        ws = WebSocket(self.ws_url)  # one connection per tab keeps events apart
        page_probe = CdpPage(ws, None, self.problems)
        page_probe.next_id = 0
        target = _browser_call(page_probe, "Target.createTarget", {"url": "about:blank"})["targetId"]
        session = _browser_call(page_probe, "Target.attachToTarget", {"targetId": target, "flatten": True})["sessionId"]
        page = CdpPage(ws, session, self.problems)
        page.next_id = 100
        page.target = target
        for method in ("Page.enable", "Runtime.enable", "Log.enable"):
            page.call(method)
        page.call("Emulation.setFocusEmulationEnabled", {"enabled": True})
        page.call("Emulation.setDeviceMetricsOverride", {"width": width, "height": height, "deviceScaleFactor": 1, "mobile": False})
        self.pages.append(page)
        return page

    def take_problems(self):
        out, self.problems[:] = list(self.problems), []
        return out

    def close(self):
        # Browser.close first: a flatpak or host Chrome lives outside our process group, so killpg alone left it
        # running (46 headless Chromes piled up on 2026-11-05 and later tests timed out).
        if self.ws:
            try:
                self.ws.send(json.dumps({"id": 1 << 30, "method": "Browser.close", "params": {}}))
                if self.proc:
                    self.proc.wait(timeout=5)
            except Exception:
                pass
        for page in self.pages:
            page.ws.close()
        if self.ws:
            self.ws.close()
        if self.proc:
            try:
                os.killpg(self.proc.pid, signal.SIGTERM)
            except (ProcessLookupError, PermissionError):
                pass
            try:
                self.proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(self.proc.pid, signal.SIGKILL)
                except (ProcessLookupError, PermissionError):
                    pass
        shutil.rmtree(self.profile, ignore_errors=True)


Page = CdpPage


def _flatpak_args(command, *extra):
    """``flatpak run`` commands get ``extra`` options right after ``run`` (the sandboxed browser sees only some host
    folders and has a temporary folder of its own); any other command is returned untouched."""
    if "flatpak" in [os.path.basename(c) for c in command] and "run" in command:
        i = command.index("run") + 1
        return command[:i] + list(extra) + command[i:]
    return command


_BIDI_KEYS = {"ArrowLeft": "\ue012", "ArrowUp": "\ue013", "ArrowRight": "\ue014", "ArrowDown": "\ue015",
              "Enter": "\ue006", "Escape": "\ue00c", "Tab": "\ue004", "Backspace": "\ue003", "Delete": "\ue017",
              "Home": "\ue011", "End": "\ue010"}
_BIDI_MODS = (("ctrl", "\ue009"), ("shift", "\ue008"), ("alt", "\ue00a"), ("meta", "\ue03d"))


def _bidi_value(v):
    """A BiDi RemoteValue as the plain Python value (what ``returnByValue`` gives in CDP)."""
    t, val = v.get("type"), v.get("value")
    if t in ("undefined", "null"):
        return None
    if t == "number":
        return float(val) if isinstance(val, str) else val
    if t in ("array", "set"):
        return [_bidi_value(x) for x in val or []]
    if t in ("object", "map"):
        return {(k if isinstance(k, str) else _bidi_value(k)): _bidi_value(x) for k, x in val or []}
    return val


class BidiConn:
    """The one WebDriver BiDi connection of a Firefox: commands by id, events handed to ``on_event``."""

    def __init__(self, url, on_event):
        self.ws, self.on_event, self.next_id = WebSocket(url), on_event, 0

    def call(self, method, params=None, timeout=30):
        self.next_id += 1
        mid = self.next_id
        self.ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
        end = time.time() + timeout
        self.ws.sock.settimeout(timeout)
        while time.time() < end:
            raw = self.ws.recv()
            if raw is None:
                raise CdpError("browser closed")
            msg = json.loads(raw)
            if msg.get("id") == mid:
                if msg.get("type") == "error" or "error" in msg:
                    raise CdpError("%s: %s %s" % (method, msg.get("error"), msg.get("message")))
                return msg.get("result", {})
            self.on_event(msg)
        raise CdpError("timeout waiting for %s" % method)

    def pump(self, seconds):
        end = time.time() + seconds
        while time.time() < end:
            if not self.ws.readable(end - time.time()):
                return
            self.ws.sock.settimeout(30)
            raw = self.ws.recv()
            if raw is None:
                return
            self.on_event(json.loads(raw))


class _PageHandle:
    """What ``page.ws`` is for BiDi: ``close()`` closes the tab (the connection is the browser's)."""

    def __init__(self, page):
        self.page = page

    def close(self):
        try:
            self.page.conn.call("browsingContext.close", {"context": self.page.context}, timeout=5)
        except Exception:
            pass


class BidiPage:
    """One Firefox tab (a browsing context) over WebDriver BiDi; same API as ``CdpPage``."""

    def __init__(self, conn, context, problems):
        self.conn, self.context, self.problems = conn, context, problems
        self.ws = _PageHandle(self)

    def pump(self, seconds=0.2):
        self.conn.pump(seconds)

    def evaluate(self, expression, timeout=30):
        res = self.conn.call("script.evaluate", {
            "expression": expression, "target": {"context": self.context}, "awaitPromise": True,
            "resultOwnership": "none", "userActivation": True}, timeout)
        if res.get("type") == "exception":
            d = res["exceptionDetails"]
            raise CdpError("evaluate failed: %s" % d.get("text"))
        return _bidi_value(res["result"])

    def goto(self, url):
        self.conn.call("browsingContext.navigate", {"context": self.context, "url": url, "wait": "complete"})
        self.wait("document.readyState === 'complete'")

    wait = CdpPage.wait

    def key(self, key, **mods):
        held = [code for name, code in _BIDI_MODS if mods.get(name)]
        value = _BIDI_KEYS.get(key, key)
        actions = ([{"type": "keyDown", "value": c} for c in held] + [{"type": "keyDown", "value": value},
                   {"type": "keyUp", "value": value}] + [{"type": "keyUp", "value": c} for c in reversed(held)])
        self.conn.call("input.performActions", {"context": self.context,
                                                "actions": [{"type": "key", "id": "kbd", "actions": actions}]})
        self.pump(0.1)


class BidiBrowser:
    """Headless Firefox over WebDriver BiDi, with a throwaway profile."""

    def __init__(self, command=None, lang=None):
        lang = lang or os.environ.get("WMF_TEST_LANG") or "es"
        self.command = command or find_firefox()
        if not self.command:
            raise CdpError("no browser")
        self.profile = scratch_dir("wmf-firefox-")
        self.problems = []
        self.pages = []
        self.conn = None
        self.proc = None
        try:
            tmp = os.path.join(self.profile, "tmp")
            prof = os.path.join(self.profile, "profile")
            os.makedirs(tmp)
            os.makedirs(prof)
            prefs = {"intl.accept_languages": lang, "intl.locale.requested": lang,
                     "browser.shell.checkDefaultBrowser": False, "browser.startup.homepage_override.mstone": "ignore",
                     "startup.homepage_welcome_url": "", "startup.homepage_welcome_url.additional": "",
                     "browser.aboutwelcome.enabled": False, "datareporting.policy.dataSubmissionEnabled": False,
                     "toolkit.telemetry.reportingpolicy.firstRun": False, "app.update.auto": False,
                     "app.update.enabled": False, "browser.cache.disk.enable": False,
                     "browser.tabs.warnOnClose": False, "focusmanager.testmode": True,
                     "browser.sessionstore.resume_from_crash": False,
                     # classic scrollbars (as Chrome, Windows): overlay ones have width 0 and hide 100vw bugs
                     "widget.gtk.overlay-scrollbars.enabled": False, "ui.useOverlayScrollbars": 0, "network.captive-portal-service.enabled": False}
            with open(os.path.join(prof, "user.js"), "w") as f:
                for k, v in prefs.items():
                    f.write("user_pref(%s, %s);\n" % (json.dumps(k), json.dumps(v)))
            # a flatpak Firefox sees only some host folders: ours is opened to it, and its temporaries stay inside
            args = _flatpak_args(self.command, "--filesystem=" + self.profile, "--env=TMPDIR=" + tmp) + [
                "--headless", "--no-remote", "--profile", prof, "--remote-debugging-port=0", "about:blank"]
            self.proc = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True,
                                         start_new_session=True, env=dict(os.environ, TMPDIR=tmp, MOZ_HEADLESS="1"))
            self.ws_url = self._find_ws_url() + "/session"
            self.conn = BidiConn(self.ws_url, self._event)
            self.conn.call("session.new", {"capabilities": {}})
            self.conn.call("session.subscribe", {"events": ["log.entryAdded"]})
        except BaseException:
            self.close()
            raise

    def _find_ws_url(self):
        found = []

        def reader():
            for line in self.proc.stderr:
                m = re.search(r"WebDriver BiDi listening on (ws://\S+)", line)
                if m:
                    found.append(m.group(1))

        threading.Thread(target=reader, daemon=True).start()
        end = time.time() + 60
        while time.time() < end:
            if found:
                return found[0]
            if self.proc.poll() is not None:
                raise CdpError("the browser exited (%s)" % self.proc.returncode)
            time.sleep(0.1)
        raise CdpError("the browser did not report its WebDriver BiDi address")

    def _event(self, msg):
        if msg.get("method") == "log.entryAdded":
            e = msg["params"]
            if e.get("level") == "error":
                self.problems.append("%s: %s" % ("exception" if e.get("type") == "javascript" else "console.error",
                                                 e.get("text")))

    def new_page(self, width=1280, height=900):
        context = self.conn.call("browsingContext.create", {"type": "tab"})["context"]
        page = BidiPage(self.conn, context, self.problems)
        try:
            self.conn.call("browsingContext.activate", {"context": context})
        except CdpError:
            pass  # older Firefox: the tab is already the front one
        self.conn.call("browsingContext.setViewport", {"context": context, "viewport": {"width": width, "height": height},
                                                       "devicePixelRatio": 1})
        self.pages.append(page)
        return page

    def take_problems(self):
        self.conn.pump(0.05)
        out, self.problems[:] = list(self.problems), []
        return out

    def close(self):
        if self.conn:
            try:
                self.conn.ws.send(json.dumps({"id": 1 << 30, "method": "browser.close", "params": {}}))
                if self.proc:
                    self.proc.wait(timeout=10)
            except Exception:
                pass
            self.conn.ws.close()
        if self.proc:
            try:
                os.killpg(self.proc.pid, signal.SIGTERM)
            except (ProcessLookupError, PermissionError):
                pass
            try:
                self.proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(self.proc.pid, signal.SIGKILL)
                except (ProcessLookupError, PermissionError):
                    pass
            # a flatpak Firefox outside our process group that ignored browser.close: by its profile path
            if "flatpak" in [os.path.basename(c) for c in self.command]:
                subprocess.run(_host(["pkill", "-f", self.profile]), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(3):  # Firefox may still be writing while it exits
            shutil.rmtree(self.profile, ignore_errors=True)
            if not os.path.exists(self.profile):
                break
            time.sleep(0.5)


def Browser(command=None, lang=None):
    """A headless browser: the given command, else ``find_browser()``'s. Raises when there is none."""
    if command:
        kind = kind_of(" ".join(command)) or "chrome"
    else:
        found = find_browser()
        if not found:
            raise CdpError("no browser")
        kind, command = found
    return (BidiBrowser if kind == "firefox" else CdpBrowser)(command, lang)


def _browser_call(page, method, params):
    """A command on the browser target (no session): Target.* on a connection of its own."""
    page.next_id += 1
    mid = page.next_id
    page.ws.send(json.dumps({"id": mid, "method": method, "params": params}))
    while True:
        raw = page.ws.recv()
        if raw is None:
            raise CdpError("browser closed")
        msg = json.loads(raw)
        if msg.get("id") == mid:
            if "error" in msg:
                raise CdpError("%s: %s" % (method, msg["error"]))
            return msg["result"]
