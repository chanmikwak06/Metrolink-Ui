#!/usr/bin/env python3
"""Serve the prototype at http://localhost:4173 with caching off, so edits show on reload."""
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4173
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


print(f"Prototype:   http://localhost:{PORT}/\nStyle guide: http://localhost:{PORT}/styleguide/\nCtrl+C to stop.")
http.server.ThreadingHTTPServer(("127.0.0.1", PORT), NoCacheHandler).serve_forever()
