// Package main is the trusted demo gateway, not an arbitrary-project recorder.
package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"time"
)

const clientTimeout = 1500 * time.Millisecond
const retryDelay = 120 * time.Millisecond
const maxAttempts = 2

type Event struct {
	ID       string                 `json:"id"`
	Label    string                 `json:"label"`
	Symbol   string                 `json:"symbol"`
	Kind     string                 `json:"kind"`
	Service  string                 `json:"service"`
	Evidence string                 `json:"evidence"`
	TraceID  string                 `json:"trace_id"`
	Duration float64                `json:"duration_ms"`
	State    map[string]interface{} `json:"state"`
	Source   string                 `json:"source"`
}

func observe(label, symbol, kind, trace string, started time.Time, state map[string]interface{}) Event {
	return Event{fmt.Sprintf("g-%d", time.Now().UnixNano()), label, symbol, kind, "api", "observed", trace, float64(time.Since(started).Microseconds()) / 1000, state, "demo/api/main.go"}
}

type Gateway struct {
	storage string
	client  *http.Client
}

// callStorage retries GET only. The second attempt reuses the same trace identity.
func (g *Gateway) callStorage(r *http.Request, body []byte, trace string) (map[string]interface{}, int, []interface{}) {
	events := []interface{}{}
	attempts := 1
	if r.Method == http.MethodGet {
		attempts = maxAttempts
	}
	for attempt := 1; attempt <= attempts; attempt++ {
		start := time.Now()
		req, err := http.NewRequestWithContext(r.Context(), r.Method, g.storage+"/members", bytes.NewReader(body))
		if err != nil {
			return map[string]interface{}{"error": err.Error()}, 502, events
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Trace-ID", trace)
		req.Header.Set("X-Attempt", fmt.Sprint(attempt))
		req.Header.Set("X-Demo-Fail", r.Header.Get("X-Demo-Fail"))
		req.Header.Set("Idempotency-Key", r.Header.Get("Idempotency-Key"))
		response, err := g.client.Do(req)
		status := 502
		payload := map[string]interface{}{}
		if err == nil {
			raw, readErr := io.ReadAll(io.LimitReader(response.Body, 2<<20))
			response.Body.Close()
			status = response.StatusCode
			if readErr != nil || json.Unmarshal(raw, &payload) != nil {
				status = 502
				payload["error"] = "下游响应无法解析"
			}
		} else {
			payload["error"] = "下游连接失败或超时"
		}
		events = append(events, observe(fmt.Sprintf("StorageClient · 第 %d 次调用", attempt), "Gateway.callStorage", "client", trace, start, map[string]interface{}{"attempt": attempt, "timeout_ms": clientTimeout.Milliseconds(), "status": status}))
		if nested, ok := payload["events"].([]interface{}); ok {
			events = append(events, nested...)
		}
		delete(payload, "events")
		if status < 500 || attempt == attempts {
			return payload, status, events
		}
		waitStart := time.Now()
		select {
		case <-r.Context().Done():
			return map[string]interface{}{"error": "请求已取消"}, 499, events
		case <-time.After(retryDelay):
			events = append(events, observe("等待后重试", "Gateway.callStorage", "policy", trace, waitStart, map[string]interface{}{"backoff_ms": retryDelay.Milliseconds(), "next_attempt": attempt + 1, "jitter": false}))
		}
	}
	return map[string]interface{}{"error": "无可执行尝试"}, 502, events
}

func (g *Gateway) serveMembers(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if r.URL.Path != "/members" {
		w.WriteHeader(404)
		json.NewEncoder(w).Encode(map[string]string{"error": "Not found"})
		return
	}
	if r.Method != "GET" && r.Method != "POST" {
		w.WriteHeader(405)
		json.NewEncoder(w).Encode(map[string]string{"error": "Method not allowed"})
		return
	}
	started := time.Now()
	trace := r.Header.Get("X-Trace-ID")
	if trace == "" {
		trace = fmt.Sprintf("standalone-%d", time.Now().UnixNano())
	}
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 4096))
	if err != nil {
		w.WriteHeader(413)
		json.NewEncoder(w).Encode(map[string]string{"error": "请求过大"})
		return
	}
	events := []interface{}{observe("接收并检查请求", "Gateway.serveMembers", "handler", trace, started, map[string]interface{}{"method": r.Method, "path": r.URL.Path, "max_body_bytes": 4096})}
	payload, status, calls := g.callStorage(r, body, trace)
	events = append(events, calls...)
	events = append(events, observe("返回 HTTP 响应", "Gateway.serveMembers", "response", trace, started, map[string]interface{}{"status": status}))
	payload["events"] = events
	payload["trace_id"] = trace
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(payload)
}

func main() {
	started := time.Now()
	storage := flag.String("storage", "", "trusted loopback storage service URL")
	port := flag.Int("port", 0, "loopback listen port")
	flag.Parse()
	if *storage == "" {
		fmt.Fprintln(os.Stderr, "missing --storage")
		os.Exit(1)
	}
	g := &Gateway{storage: *storage, client: &http.Client{Timeout: clientTimeout}}
	mux := http.NewServeMux()
	mux.HandleFunc("/members", g.serveMembers)
	listener, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", *port))
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	startup := []Event{
		observe("读取网关配置", "main", "startup", "startup-api", started, map[string]interface{}{"storage": "loopback HTTP"}),
		observe("构造 StorageClient", "main", "startup", "startup-api", started, map[string]interface{}{"timeout_ms": clientTimeout.Milliseconds(), "max_attempts": maxAttempts, "connected": false}),
		observe("注册路由并开始监听", "main", "startup", "startup-api", started, map[string]interface{}{"route": "GET /members · POST /members", "port": listener.Addr().(*net.TCPAddr).Port}),
	}
	json.NewEncoder(os.Stdout).Encode(map[string]interface{}{"port": listener.Addr().(*net.TCPAddr).Port, "startup": startup})
	server := &http.Server{Handler: mux, ReadHeaderTimeout: 3 * time.Second}
	if err := server.Serve(listener); err != nil && err != http.ErrServerClosed {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
