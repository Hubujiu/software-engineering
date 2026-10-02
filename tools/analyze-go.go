// Syntax-only adapter. Uploaded code is parsed, never built or executed.
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"go/ast"
	"go/parser"
	"go/printer"
	"go/token"
	"os"
	"strconv"
)

type Symbol struct {
	Name   string   `json:"name"`
	File   string   `json:"file"`
	Kind   string   `json:"kind"`
	Line   int      `json:"line"`
	End    int      `json:"end"`
	Doc    string   `json:"doc"`
	Calls  []string `json:"calls"`
	Inputs []string `json:"inputs"`
}

func text(n ast.Node, f *token.FileSet) string {
	var b bytes.Buffer
	printer.Fprint(&b, f, n)
	return b.String()
}
func main() {
	files := map[string]string{}
	if json.NewDecoder(os.Stdin).Decode(&files) != nil {
		os.Exit(2)
	}
	symbols := []Symbol{}
	imports := map[string][]string{}
	diagnostics := []string{}
	constants := map[string]map[string]string{}
	for path, code := range files {
		fs := token.NewFileSet()
		tree, err := parser.ParseFile(fs, path, code, parser.ParseComments)
		if err != nil {
			diagnostics = append(diagnostics, fmt.Sprintf("%s: %s", path, err))
			continue
		}
		imports[path] = []string{}
		constants[path] = map[string]string{}
		for _, i := range tree.Imports {
			name, _ := strconv.Unquote(i.Path.Value)
			imports[path] = append(imports[path], name)
		}
		for _, d := range tree.Decls {
			if gd, ok := d.(*ast.GenDecl); ok {
				for _, spec := range gd.Specs {
					if vs, ok := spec.(*ast.ValueSpec); ok {
						for idx, n := range vs.Names {
							if idx < len(vs.Values) {
								constants[path][n.Name] = text(vs.Values[idx], fs)
							}
						}
					}
					if ts, ok := spec.(*ast.TypeSpec); ok {
						symbols = append(symbols, Symbol{Name: ts.Name.Name, File: path, Kind: "type", Line: fs.Position(ts.Pos()).Line, End: fs.Position(ts.End()).Line, Doc: gd.Doc.Text()})
					}
				}
			}
			fn, ok := d.(*ast.FuncDecl)
			if !ok {
				continue
			}
			name := fn.Name.Name
			if fn.Recv != nil && len(fn.Recv.List) > 0 {
				name = text(fn.Recv.List[0].Type, fs) + "." + name
				if name[0] == '*' {
					name = name[1:]
				}
			}
			s := Symbol{Name: name, File: path, Kind: "function", Line: fs.Position(fn.Pos()).Line, End: fs.Position(fn.End()).Line, Doc: fn.Doc.Text(), Calls: []string{}, Inputs: []string{}}
			if fn.Type.Params != nil {
				for _, p := range fn.Type.Params.List {
					s.Inputs = append(s.Inputs, text(p, fs))
				}
			}
			if fn.Body != nil {
				ast.Inspect(fn.Body, func(n ast.Node) bool {
					if _, ok := n.(*ast.FuncLit); ok {
						return false
					}
					if c, ok := n.(*ast.CallExpr); ok {
						s.Calls = append(s.Calls, text(c.Fun, fs))
					}
					return true
				})
			}
			symbols = append(symbols, s)
		}
	}
	json.NewEncoder(os.Stdout).Encode(map[string]interface{}{"symbols": symbols, "imports": imports, "diagnostics": diagnostics, "constants": constants})
}
