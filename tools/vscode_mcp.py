"""通过 MCP 协议访问 VS Code MCP 服务端。

用法：
    python vscode_mcp.py <tool_name> [json_args]

服务端由 VS Code 扩展 juehangqin.vscode-mcp-server 提供，监听 127.0.0.1:3000/mcp。
WorkBuddy 会话的工具索引在启动时固定，服务晚启动时拿不到动态工具，
所以这里直接走 JSON-RPC，操作仍然全部经过 VS Code 的扩展宿主。
"""

import json
import sys
import urllib.request

URL = "http://127.0.0.1:3000/mcp"


def rpc(method, params, req_id=1):
    payload = {"jsonrpc": "2.0", "id": req_id, "method": method, "params": params}
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        URL,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = resp.read().decode("utf-8", "ignore")
    chunks = [ln[6:] for ln in raw.splitlines() if ln.startswith("data: ")]
    body = "\n".join(chunks) if chunks else raw
    return json.loads(body)


def call_tool(name, args):
    result = rpc("tools/call", {"name": name, "arguments": args})
    if "error" in result:
        return {"error": result["error"]}
    content = result.get("result", {}).get("content", [])
    texts = [c.get("text", "") for c in content if c.get("type") == "text"]
    return {"isError": result.get("result", {}).get("isError", False), "text": "\n".join(texts)}


def main():
    if len(sys.argv) < 2:
        listing = rpc("tools/list", {})
        for tool in listing.get("result", {}).get("tools", []):
            print(tool["name"])
        return
    name = sys.argv[1]
    args = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
    print(json.dumps(call_tool(name, args), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
