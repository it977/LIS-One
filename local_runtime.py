import http.server
import urllib.request
import json
import os
import sys

# SUPABASE CONFIG (recovered from .env/.dev.vars)
URL = "https://vblyqilhmkybzbakcyyl.supabase.co"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZibHlxaWxobWt5YnpiYWtjeXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NTM4OTQ0OTcsImV4cCI6MTk2OTQ3MDQ5N30.C43S9eN5mY8X-YIDD5X1u_uT347M_E_Z7M6f_H4s7Y"

class RuntimeHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        print(f"POST {self.path}")
        if self.path == "/api/login":
            try:
                content_len = int(self.headers.get('Content-Length', 0))
                body = json.loads(self.rfile.read(content_len))
                username = body.get('username')
                password = body.get('password')
                
                # Mock Cloudflare login.js behavior
                query = f"{URL}/rest/v1/lis_one_users?username=eq.{username}&password=eq.{password}&select=username,role"
                req = urllib.request.Request(query, headers={
                    'apikey': KEY,
                    'Authorization': f'Bearer {KEY}',
                    'Accept': 'application/vnd.pgrst.object+json'
                })
                
                with urllib.request.urlopen(req) as resp:
                    user_data = json.loads(resp.read())
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(json.dumps({'success': True, 'username': user_data['username'], 'role': user_data['role']}).encode())
            except Exception as e:
                self.send_response(401)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'success': False, 'message': 'Invalid credentials'}).encode())
        
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
