import http.server
import urllib.request
import urllib.error
import json
import os
import sys

# SUPABASE CONFIG
# Read from environment/.dev.vars; do not hard-code keys in source.
URL = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL") or "https://vblyqilhmkybzbakcyyl.supabase.co"
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY") or os.environ.get("SUPABASE_ANON_KEY") or ""

class RuntimeHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        print(f"POST {self.path}")
        if self.path == "/api/login":
            # Proxy to the production-style login endpoint so this helper never
            # embeds plaintext-password Supabase queries.
            content_len = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_len)
            target = "https://lis-one.pages.dev/api/login"
            req = urllib.request.Request(target, data=body, headers={'Content-Type': 'application/json'})
            try:
                with urllib.request.urlopen(req) as resp:
                    self.send_response(resp.status)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(resp.read())
            except urllib.error.HTTPError as e:
                self.send_response(e.code)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(e.read())
        
        elif self.path == "/api/data":
            # Pass-through to production data proxy for local testing
            content_len = int(self.headers.get('Content-Length', 0))
            payload = self.rfile.read(content_len)
            target = "https://lis-one.pages.dev/api/data"
            req = urllib.request.Request(target, data=payload, headers={'Content-Type': 'application/json'})
            try:
                with urllib.request.urlopen(req) as resp:
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(resp.read())
            except:
                self.send_response(500)
                self.end_headers()

    def do_OPTIONS(self):
        # Handle Preflight
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

http.server.HTTPServer(('', 3000), RuntimeHandler).serve_forever()
