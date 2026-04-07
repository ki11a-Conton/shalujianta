#!/usr/bin/env python3
"""
自定义 HTTP 服务器，正确处理 ES6 模块的 MIME 类型
"""
import http.server
import socketserver
import os

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # 确保 .js 文件使用正确的 MIME 类型
        if self.path.endswith('.js'):
            self.send_header('Content-Type', 'application/javascript')
        super().end_headers()

    def guess_type(self, path):
        # 覆盖默认的 MIME 类型猜测
        if path.endswith('.js'):
            return 'application/javascript'
        return super().guess_type(path)

PORT = 8080
os.chdir(os.path.dirname(os.path.abspath(__file__)))

with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
    print(f"服务器运行在 http://localhost:{PORT}/")
    print("按 Ctrl+C 停止服务器")
    httpd.serve_forever()