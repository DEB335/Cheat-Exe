import http.server
import socketserver
import urllib.request
import json
import os

PORT = 8000
API_URL = "https://auth.terminalx999.online/api_admin.php"

class ProxyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        if self.path == '/api/db':
            db_path = 'db.json'
            if not os.path.exists(db_path):
                default_db = {
                    "cheatExeUsers": {},
                    "cheatExeKeyHistory": [],
                    "cheatExeAuditLogs": [],
                    "cheatExeDevices": [],
                    "cheatExeBannedUsers": [],
                    "adminUser": "JACK",
                    "adminPass": "22153310"
                }
                with open(db_path, 'w', encoding='utf-8') as f:
                    json.dump(default_db, f, indent=4)
            
            try:
                with open(db_path, 'r', encoding='utf-8') as f:
                    db_data = json.load(f)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(db_data).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "message": str(e)}).encode('utf-8'))
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/db':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                payload = json.loads(post_data.decode('utf-8'))
                with open('db.json', 'w', encoding='utf-8') as f:
                    json.dump(payload, f, indent=4)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "message": "Database saved successfully"}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "message": str(e)}).encode('utf-8'))
        elif self.path == '/api':
            # read the body
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            # proxy the request
            content_type = self.headers.get('Content-Type', 'application/x-www-form-urlencoded')
            req = urllib.request.Request(API_URL, data=post_data, headers={'Content-Type': content_type})
            try:
                response = urllib.request.urlopen(req, timeout=10)
                data = response.read()
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(data)
            except urllib.error.HTTPError as e:
                error_body = e.read()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(error_body)
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "message": str(e)}).encode())
        else:
            super().do_POST()

Handler = ProxyHTTPRequestHandler

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print("Serving at port", PORT)
    httpd.serve_forever()
